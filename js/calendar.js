// Google Calendar: sign in with chrome.identity.launchWebAuthFlow (works in Chrome,
// Edge, Brave and Arc), read upcoming events (read-only scope), show an "Up next" card.
// Tokens are short-lived (1h) and refreshed silently while you stay signed in to Google.

import { get, set } from './storage.js';
import { GOOGLE_CLIENT_ID, CALENDAR_DAYS_AHEAD, CALENDAR_MAX_EVENTS, CALENDAR_REFRESH_MIN } from './config.js';

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const API = 'https://www.googleapis.com/calendar/v3/';
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const identity = globalThis.chrome?.identity;

export const redirectUri = () => identity?.getRedirectURL?.() ?? '';

export function initCalendar({ card, list, settingsBox, visible = true, clock24 = false }) {
  let show = visible;
  let use24 = clock24;
  let status = 'idle';      // idle | loading | ok | reconnect | error
  let loading = null;

  const connected = () => !!get('calConnected', false);
  const configured = () => !!GOOGLE_CLIENT_ID && !!identity?.launchWebAuthFlow;

  // ---- auth -------------------------------------------------------------------
  // The browser allows only one sign-in window per extension at a time, so all
  // sign-in attempts go through this single in-flight promise.
  let authInFlight = null;
  async function authorize(interactive) {
    if (authInFlight) {
      if (!interactive) return authInFlight;
      try { await authInFlight; } catch { /* a silent attempt failed; go interactive */ }
    }
    authInFlight = doAuthorize(interactive).finally(() => { authInFlight = null; });
    return authInFlight;
  }

  async function doAuthorize(interactive) {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      response_type: 'token',
      redirect_uri: redirectUri(),
      scope: SCOPE,
      include_granted_scopes: 'true',
    });
    if (!interactive) params.set('prompt', 'none');
    const opts = { url: `${AUTH}?${params}`, interactive };
    if (!interactive) Object.assign(opts, { abortOnLoadForNonInteractive: false, timeoutMsForNonInteractive: 10000 });
    const back = await identity.launchWebAuthFlow(opts);
    const frag = new URLSearchParams(new URL(back).hash.slice(1));
    if (frag.get('error')) throw new Error(frag.get('error'));
    const token = frag.get('access_token');
    if (!token) throw new Error('no_token');
    const exp = Date.now() + (Number(frag.get('expires_in')) || 3600) * 1000 - 60_000;
    set('calToken', { token, exp }, { mirror: false });
    set('calConnected', true);
    return token;
  }

  async function token({ fresh = false } = {}) {
    const t = get('calToken', null);
    if (!fresh && t && t.exp > Date.now()) return t.token;
    return authorize(false); // silent; throws if Google needs you to sign in again
  }

  // ---- API ----------------------------------------------------------------------
  async function api(path, tok) {
    const res = await fetch(API + path, { headers: { Authorization: `Bearer ${tok}` } });
    if (res.status === 401) { const e = new Error('unauthorized'); e.status = 401; throw e; }
    if (!res.ok) throw new Error(`calendar ${res.status}`);
    return res.json();
  }

  function horizon() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + CALENDAR_DAYS_AHEAD);
    return d;
  }

  const parse = t => (t.dateTime ? new Date(t.dateTime) : (([y, m, d]) => new Date(y, m - 1, d))(t.date.split('-').map(Number)));

  async function fetchEvents(tok) {
    const cals = await api('users/me/calendarList?minAccessRole=reader&fields=items(id,selected,primary)', tok);
    const ids = (cals.items ?? []).filter(c => c.selected || c.primary).map(c => c.id).slice(0, 10);
    const q = new URLSearchParams({
      singleEvents: 'true', orderBy: 'startTime', maxResults: '15',
      timeMin: new Date().toISOString(), timeMax: horizon().toISOString(),
      fields: 'items(id,summary,start,end,htmlLink,status,eventType,attendees(self,responseStatus))',
    });
    const all = await Promise.all(ids.map(id =>
      api(`calendars/${encodeURIComponent(id)}/events?${q}`, tok).then(r => r.items ?? []).catch(() => [])));

    const seen = new Set();
    return all.flat()
      .filter(e => e.status !== 'cancelled' && e.eventType !== 'workingLocation')
      .filter(e => !e.attendees?.some(a => a.self && a.responseStatus === 'declined'))
      .map(e => ({
        title: e.summary || '(No title)',
        start: parse(e.start).getTime(),
        end: parse(e.end).getTime(),
        allDay: !e.start.dateTime,
        link: e.htmlLink,
      }))
      .filter(e => { const k = `${e.title}|${e.start}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => (a.allDay === b.allDay ? a.start - b.start : a.allDay ? -1 : 1) || a.start - b.start);
  }

  async function load({ force = false } = {}) {
    if (!configured() || !connected()) { status = 'idle'; render(); return; }
    const cached = get('calEvents', null);
    if (!force && cached && Date.now() - cached.at < CALENDAR_REFRESH_MIN * 60_000) { status = 'ok'; render(); return; }
    if (loading) return loading;
    loading = (async () => {
      try {
        let tok = await token();
        let items;
        try { items = await fetchEvents(tok); }
        catch (e) {
          if (e.status !== 401) throw e;
          tok = await token({ fresh: true });
          items = await fetchEvents(tok);
        }
        set('calEvents', { at: Date.now(), items }, { mirror: false });
        status = 'ok';
      } catch (e) {
        // Silent sign-in failed: Google wants you to click through again.
        const authFail = /interaction_required|login_required|consent_required|unauthorized|did not approve|could not be loaded|User interaction required/i.test(String(e.message));
        status = authFail ? 'reconnect' : (get('calEvents', null) ? 'ok' : 'error');
        if (!authFail) console.warn('[calendar]', e);
      } finally {
        loading = null;
        render();
      }
    })();
    return loading;
  }

  async function connect() {
    try {
      status = 'loading'; renderSettings();
      await authorize(true);
      await load({ force: true });
    } catch (e) {
      status = connected() ? 'reconnect' : 'idle';
      render();
      const msg = String(e.message);
      if (/only one web auth flow/i.test(msg)) settingsMsg('A Google sign-in window is already open. Close it, then try again.');
      else if (/access_denied/i.test(msg)) settingsMsg('Google blocked the sign-in. Check that your account is a test user on the OAuth consent screen.');
      else if (!/did not approve|cancel/i.test(msg)) settingsMsg(`Couldn’t connect: ${msg}`);
    }
  }

  function disconnect() {
    const t = get('calToken', null);
    if (t?.token) {
      fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `token=${encodeURIComponent(t.token)}`,
      }).catch(() => {});
    }
    set('calToken', null, { mirror: false });
    set('calEvents', null, { mirror: false });
    set('calConnected', false);
    status = 'idle';
    render();
  }

  // ---- rendering: card ------------------------------------------------------------
  const time = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !use24 });

  function rel(ms) {
    const m = Math.round((ms - Date.now()) / 60_000);
    if (m <= 0) return 'now';
    if (m < 60) return `in ${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r && h < 3 ? `in ${h} h ${r} min` : `in ${h} h`;
  }

  function dayLabel(ms) {
    const d = new Date(ms); d.setHours(0, 0, 0, 0);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((d - t) / 86_400_000);
    return diff <= 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'long' });
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render() {
    renderSettings();
    const on = show && configured() && connected();
    card.hidden = !on;
    if (!on) return;
    list.replaceChildren();

    if (status === 'reconnect') {
      const li = el('li', 'agenda__note', 'Google wants you to sign in again. ');
      const b = el('button', 'agenda__btn', 'Reconnect');
      b.type = 'button';
      b.addEventListener('click', connect);
      li.append(b);
      list.append(li);
      return;
    }

    const now = Date.now();
    const items = (get('calEvents', null)?.items ?? [])
      .filter(e => e.end > now && e.start < horizon().getTime())
      .slice(0, CALENDAR_MAX_EVENTS);

    if (!items.length) {
      list.append(el('li', 'agenda__note', status === 'error' ? 'Couldn’t load your calendar.' : 'Nothing coming up. Enjoy the quiet.'));
      return;
    }

    let lastDay = '';
    let relShown = false; // countdown on the next upcoming event only
    for (const e of items) {
      const day = dayLabel(Math.max(e.start, now));
      if (day !== lastDay) { list.append(el('li', 'agenda__day', day)); lastDay = day; }
      const li = el('li');
      const a = el('a', 'agenda__item');
      a.href = e.link;
      const isNow = !e.allDay && e.start <= now;
      if (isNow) a.classList.add('is-now');
      a.append(el('span', 'agenda__time', e.allDay ? 'All day' : time(e.start)));
      const body = el('span', 'agenda__body');
      body.append(el('span', 'agenda__title', e.title));
      if (isNow) body.append(el('span', 'agenda__rel', `now · until ${time(e.end)}`));
      else if (!e.allDay && !relShown) { body.append(el('span', 'agenda__rel', rel(e.start))); relShown = true; }
      a.append(body);
      li.append(a);
      list.append(li);
    }
  }

  // ---- rendering: settings section ----------------------------------------------------
  const sx = {
    status: settingsBox.querySelector('#cal-status'),
    connect: settingsBox.querySelector('#cal-connect'),
    setup: settingsBox.querySelector('#cal-setup'),
    redirect: settingsBox.querySelector('#cal-redirect'),
    copy: settingsBox.querySelector('#cal-copy'),
    msg: settingsBox.querySelector('#cal-msg'),
  };
  function settingsMsg(text) { sx.msg.textContent = text; }

  function renderSettings() {
    sx.msg.textContent = '';
    if (!identity?.launchWebAuthFlow) {
      sx.status.textContent = 'Available when loaded as an extension.';
      sx.connect.hidden = true; sx.setup.hidden = true;
      return;
    }
    sx.redirect.textContent = redirectUri();
    if (!GOOGLE_CLIENT_ID) {
      sx.status.textContent = 'Not set up yet. Add your client ID to js/config.js.';
      sx.connect.hidden = true; sx.setup.hidden = false;
      return;
    }
    sx.setup.hidden = true;
    sx.connect.hidden = false;
    if (status === 'loading') { sx.status.textContent = 'Connecting…'; sx.connect.disabled = true; return; }
    sx.connect.disabled = false;
    if (connected() && status !== 'reconnect') {
      sx.status.textContent = 'Connected (read-only).';
      sx.connect.textContent = 'Disconnect';
    } else {
      sx.status.textContent = status === 'reconnect' ? 'Signed out. Reconnect to see events.' : 'Not connected.';
      sx.connect.textContent = status === 'reconnect' ? 'Reconnect' : 'Connect Google Calendar';
    }
  }

  sx.connect.addEventListener('click', () => (connected() && status !== 'reconnect' ? disconnect() : connect()));
  sx.copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(redirectUri()); sx.copy.textContent = 'Copied'; }
    catch { sx.copy.textContent = 'Select & copy'; }
    setTimeout(() => { sx.copy.textContent = 'Copy'; }, 1500);
  });

  // ---- lifecycle --------------------------------------------------------------------
  setInterval(() => { if (!document.hidden) { render(); load(); } }, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });

  if (connected() && get('calEvents', null)) status = 'ok';
  render();   // cached events right away, no waiting on the network
  load();

  return {
    /** The next timed event that hasn't started yet, from the cache (or null). */
    next() {
      if (!configured() || !connected()) return null;
      const now = Date.now();
      return (get('calEvents', null)?.items ?? []).find(e => !e.allDay && e.start > now) ?? null;
    },
    setVisible(on) { show = on; render(); },
    setClock24(on) { use24 = on; render(); },
  };
}

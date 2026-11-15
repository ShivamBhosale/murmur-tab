// Focus tide: start a session and the page slowly falls asleep. Animals slow
// to stillness and dim, the UI fades back, and a countdown replaces the clock.
// When time's up the animals burst back to life. The session lives in storage,
// so every new tab shows the same countdown.

import { get, set, onChange } from './storage.js';

const KEY = 'focus'; // { start, end } while a session runs, null otherwise

export function initFocus({ clock, status, button, bar, engine, getMinutes, onState }) {
  let timer = 0;
  let current = null;       // the session this tab is showing
  let doneTimer = 0;
  const baseTitle = document.title;
  const fill = bar.firstElementChild;

  const fmt = ms => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  function label() {
    const m = getMinutes();
    button.textContent = `focus ${m}`;
    button.setAttribute('aria-label', `Start a ${m}-minute focus session`);
  }

  function show(mode) {
    // mode: 'idle' | 'running' | 'done'
    document.body.classList.toggle('is-focus', mode === 'running');
    clock.hidden = mode !== 'idle';
    status.hidden = mode === 'idle';
    bar.hidden = mode !== 'running';
    if (mode === 'idle') { label(); document.title = baseTitle; }
    if (mode === 'running') { button.textContent = 'end'; button.setAttribute('aria-label', 'End focus session'); }
    if (mode === 'done') { button.textContent = 'again'; button.setAttribute('aria-label', 'Start another focus session'); }
    onState?.(mode);
  }

  function tick() {
    const f = current;
    if (!f) return;
    const left = f.end - Date.now();
    if (left <= 0) { finish(); return; }
    status.textContent = `FOCUS · ${fmt(left)}`;
    fill.style.transform = `scaleX(${1 - left / (f.end - f.start)})`;
    document.title = `${fmt(left)} · Focus`;
    clearTimeout(timer);
    timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
  }

  function enter(f, { instant = false } = {}) {
    current = f;
    clearTimeout(doneTimer);
    engine.sleep(true, { instant });
    show('running');
    tick();
  }

  function finish() {
    clearTimeout(timer);
    current = null;
    if (get(KEY, null)) set(KEY, null);
    engine.wake();
    document.title = baseTitle;
    status.textContent = 'FOCUS DONE · WELL DONE';
    show('done');
    clearTimeout(doneTimer);
    doneTimer = setTimeout(() => { if (!current) show('idle'); }, 8000);
  }

  function stop() {
    clearTimeout(timer);
    current = null;
    set(KEY, null);
    engine.sleep(false);
    show('idle');
  }

  function start() {
    const now = Date.now();
    const f = { start: now, end: now + getMinutes() * 60_000 };
    set(KEY, f);
    enter(f);
  }

  button.addEventListener('click', () => (current ? stop() : start()));

  // Another tab started or ended a session.
  onChange(KEY, f => {
    if (f && f.end > Date.now()) { if (!current || current.end !== f.end) enter(f); }
    else if (!f && current) { clearTimeout(timer); current = null; engine.sleep(false); show('idle'); }
  });

  // Coming back to a hidden tab: catch up (timers are throttled in the background).
  document.addEventListener('visibilitychange', () => { if (!document.hidden && current) tick(); });

  // On load: resume a running session already asleep, or celebrate one that ended while away.
  const saved = get(KEY, null);
  if (saved && saved.end > Date.now()) enter(saved, { instant: true });
  else if (saved) { engine.sleep(true, { instant: true }); setTimeout(finish, 600); }
  else show('idle');

  return {
    get active() { return !!current; },
    refreshLabel() { if (!current) label(); },
  };
}

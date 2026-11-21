// Search bar: Google by default, prefixes for other sites, plain URLs go straight there.

// Add your own prefix here. `label` is shown in the hint row.
export const PREFIXES = {
  yt: { label: 'YouTube', url: q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
  gh: { label: 'GitHub',  url: q => `https://github.com/search?q=${encodeURIComponent(q)}` },
  cd: { label: 'Claude',  url: q => `https://claude.ai/new?q=${encodeURIComponent(q)}` },  // starts a new chat with the query
  // w: { label: 'Wikipedia', url: q => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}` },
};

const defaultUrl = q => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

const SCHEME = /^https?:\/\/\S+$/i;
const LOCAL = /^(localhost|127\.0\.0\.1)(:\d+)?(\/\S*)?$/i;
const DOMAIN = /^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i;

/** Turn raw input into a destination URL, or null for empty input. */
export function resolve(raw) {
  const q = raw.trim();
  if (!q) return null;

  const m = q.match(/^(\S+)\s+([\s\S]+)$/);
  if (m && Object.hasOwn(PREFIXES, m[1].toLowerCase())) {
    return PREFIXES[m[1].toLowerCase()].url(m[2].trim());
  }
  if (SCHEME.test(q)) return q;
  if (LOCAL.test(q)) return `http://${q}`;
  if (DOMAIN.test(q)) return `https://${q}`;
  return defaultUrl(q);
}

// Hook for later phases (the "swarm" before navigating). Returns a promise.
let beforeNavigate = () => Promise.resolve();
export function setBeforeNavigate(fn) { beforeNavigate = fn; }

function go(url, newTab) {
  if (newTab) window.open(url, '_blank', 'noopener');
  else window.location.assign(url);
}

export function initSearch({ form, input, hints }) {
  const sync = () => form.classList.toggle('is-empty', !input.value.trim());
  sync();
  input.addEventListener('input', sync);

  let busy = false;
  async function submit(newTab) {
    const url = resolve(input.value);
    if (!url || busy) return;
    if (newTab) { go(url, true); return; } // open immediately so the popup isn't blocked
    busy = true;
    await beforeNavigate();
    go(url, false);
  }

  form.addEventListener('submit', e => { e.preventDefault(); submit(false); });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(true); }
  });
  form.querySelector('#send').addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey) { e.preventDefault(); submit(true); }
  });

  // Hint row built from PREFIXES so custom prefixes show up automatically.
  hints.replaceChildren();
  const add = (key, label) => {
    const span = document.createElement('span');
    const kbd = document.createElement('kbd');
    kbd.textContent = key;
    span.append(kbd, label);
    hints.append(span);
  };
  for (const [key, { label }] of Object.entries(PREFIXES)) add(key, label);
  add('Enter', 'Google');

  // Chrome keeps focus in the address bar on new tabs, so as a fallback any
  // printable keystroke on the page is redirected into the input.
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length !== 1 || e.key === ' ' || e.key === '?') return; // '?' reserved for debug overlay
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
    input.focus();
  });

  initMic(form.querySelector('#mic'), input, sync);
  input.focus();
}

// ---------------------------------------------------------------------------
// Mic: dictate into the input with the Web Speech API. Hidden where unsupported.
// Note: Chrome sends the audio to Google's speech service; Brave blocks it.
// ---------------------------------------------------------------------------
function initMic(btn, input, onText) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || !btn) return;
  btn.hidden = false;

  let rec = null;
  let base = '';

  const setState = (state, label) => {
    btn.dataset.state = state;          // idle | listening | error
    btn.setAttribute('aria-pressed', String(state === 'listening'));
    btn.setAttribute('aria-label', label);
    btn.title = label;
  };
  setState('idle', 'Dictate');

  btn.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    base = input.value.trim() ? `${input.value.trim()} ` : '';

    rec.onresult = e => {
      let text = '';
      for (const r of e.results) text += r[0].transcript;
      input.value = base + text;
      onText();
    };
    rec.onerror = e => {
      const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Microphone blocked: allow it for this page'
        : e.error === 'network' ? 'Dictation isn’t available in this browser'
        : e.error === 'no-speech' ? 'Didn’t catch that' : 'Dictation stopped';
      setState('error', msg);
      if (e.error === 'network') btn.hidden = true; // e.g. Brave: the API exists but never works
    };
    rec.onend = () => {
      rec = null;
      if (btn.dataset.state === 'listening') setState('idle', 'Dictate');
      else setTimeout(() => { if (!rec) setState('idle', 'Dictate'); }, 2500);
      input.focus();
    };
    try {
      rec.start();
      setState('listening', 'Stop dictation');
    } catch {
      rec = null;
      setState('error', 'Dictation stopped');
    }
  });
}

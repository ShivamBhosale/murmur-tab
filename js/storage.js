// Thin wrapper over chrome.storage.local.
// - init() loads everything once into memory; after that get() is synchronous.
// - Every write is also mirrored to localStorage, so the page can read settings
//   synchronously on first paint and still works when opened as a plain file.

const PREFIX = 'cnt:';
const area = globalThis.chrome?.storage?.local ?? null;
const cache = {};

function readMirror() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) cache[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k));
    }
  } catch { /* storage blocked or bad JSON: ignore */ }
}

export async function init() {
  readMirror();
  if (area) {
    try { Object.assign(cache, await area.get(null)); } catch { /* keep mirror */ }
  }
}

export function get(key, fallback) {
  return key in cache ? cache[key] : fallback;
}

/** Call fn(newValue) when `key` changes (in this tab or another). */
export function onChange(key, fn) {
  if (area && globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, name) => {
      if (name !== 'local' || !(key in changes)) return;
      cache[key] = changes[key].newValue;
      fn(changes[key].newValue);
    });
  } else {
    window.addEventListener('storage', e => {
      if (e.key !== PREFIX + key) return;
      try { cache[key] = JSON.parse(e.newValue); } catch { cache[key] = undefined; }
      fn(cache[key]);
    });
  }
}

/** mirror: false keeps a value (e.g. an auth token) out of localStorage. */
export function set(key, value, { mirror = true } = {}) {
  cache[key] = value;
  try {
    if (mirror || !area) localStorage.setItem(PREFIX + key, JSON.stringify(value));
    else localStorage.removeItem(PREFIX + key);
  } catch { /* ignore */ }
  if (area) area.set({ [key]: value }).catch(() => {});
}

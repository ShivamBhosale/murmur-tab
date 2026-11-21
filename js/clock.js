// Clock: the time on the entry line ("9:14 PM"), the long date in the masthead
// ("Saturday, the 21st of November") and the entry number (day of the year).
// Ticks exactly on the minute.

let el, dateEl = null, entryEl = null, hour24 = false, timer = 0;
const listeners = [];

/** fn(date) runs every time the clock ticks over to a new minute. */
export function onMinute(fn) { listeners.push(fn); }

function time(d) {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return hour24 ? `${String(h).padStart(2, '0')}:${m}` : `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function longDate(d) {
  const day = d.toLocaleDateString('en-US', { weekday: 'long' });
  const mon = d.toLocaleDateString('en-US', { month: 'long' });
  return `${day}, the ${ordinal(d.getDate())} of ${mon}`;
}

function dayOfYear(d) {
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 0)) / 86_400_000);
}

function tick() {
  const now = new Date();
  el.textContent = time(now);
  el.dateTime = now.toISOString();
  if (dateEl) dateEl.textContent = longDate(now);
  if (entryEl) entryEl.textContent = `Entry № ${String(dayOfYear(now)).padStart(3, '0')}`;
  listeners.forEach(fn => fn(now));
  clearTimeout(timer);
  timer = setTimeout(tick, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20);
}

export function initClock(node, { use24h = false, dateEl: dEl = null, entryEl: eEl = null } = {}) {
  el = node;
  dateEl = dEl;
  entryEl = eEl;
  hour24 = use24h;
  tick();
  // Timers get throttled in background tabs; resync when the tab comes back.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}

export function setClock24(on) {
  hour24 = on;
  if (el) tick();
}

// Clock line: "1:24 AM · SAT, NOV 14". Ticks exactly on the minute.

let el, hour24 = false, timer = 0;
const listeners = [];

/** fn(date) runs every time the clock ticks over to a new minute. */
export function onMinute(fn) { listeners.push(fn); }

function format(d) {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const time = hour24
    ? `${String(h).padStart(2, '0')}:${m}`
    : `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  const mon = d.toLocaleDateString('en-US', { month: 'short' });
  return `${time} · ${day}, ${mon} ${d.getDate()}`.toUpperCase();
}

function tick() {
  const now = new Date();
  el.textContent = format(now);
  el.dateTime = now.toISOString();
  listeners.forEach(fn => fn(now));
  clearTimeout(timer);
  timer = setTimeout(tick, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20);
}

export function initClock(node, { use24h = false } = {}) {
  el = node;
  hour24 = use24h;
  tick();
  // Timers get throttled in background tabs; resync when the tab comes back.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}

export function setClock24(on) {
  hour24 = on;
  if (el) tick();
}

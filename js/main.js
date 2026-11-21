// Boot: load storage, then wire up each piece.

import * as store from './storage.js';
import { initClock, setClock24, onMinute } from './clock.js';
import { pickQuote, quoteWord } from './quotes.js';
import { initFocus } from './focus.js';
import { initSearch, setBeforeNavigate } from './search.js';
import { initLinks } from './links.js';
import { initSettings, loadSettings, DENSITY } from './settings.js';
import { initCalendar } from './calendar.js';
import { createEngine } from './engine.js';
import { ANIMALS, byId, DEFAULT_ANIMAL } from './animals/index.js';

const $ = id => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const isTyping = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

// Speed multiplier and scatter strength for each motion level.
const motionOf = s => (reduceMotion.matches ? 0.35 : s.motion === 'calm' ? 0.5 : 1);
const scatterOf = s => (reduceMotion.matches ? 0.35 : s.motion === 'calm' ? 0.6 : 1);

// ---------------------------------------------------------------------------
// Accent colour follows the current animal.
// ---------------------------------------------------------------------------
function applyAnimalTheme(animal) {
  const root = document.documentElement.style;
  root.setProperty('--accent', animal.color);
  // Very light animals (Crane) would wash out the Devanagari line; use grey there.
  root.setProperty('--orig', animal.origColor ?? animal.color);
  $('corner-hint').textContent = animal.onClick === 'feed'
    ? `click anywhere to feed the ${animal.label.toLowerCase()}`
    : 'click anywhere to scatter';
}

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------
function showQuote(q) {
  const orig = $('quote-orig');
  if (q.orig) {
    orig.textContent = q.orig;
    orig.lang = q.lang;
    orig.dir = 'auto'; // Arabic, Hebrew read right-to-left
    orig.hidden = false;
  } else {
    orig.textContent = '';
    orig.removeAttribute('lang');
    orig.hidden = true;
  }
  $('quote-text').textContent = q.text;
  $('quote-src').textContent = q.src;
}

let currentQuote = null;

function initQuote(visible) {
  const box = $('quote');
  box.hidden = !visible;
  showQuote(currentQuote = pickQuote());
  requestAnimationFrame(() => box.classList.remove('is-hidden'));

  let fading = false;
  $('quote-next').addEventListener('click', () => {
    if (fading) return;
    fading = true;
    box.classList.add('is-hidden');
    setTimeout(() => {
      showQuote(currentQuote = pickQuote());
      box.classList.remove('is-hidden');
      fading = false;
    }, reduceMotion.matches ? 0 : 320);
  });
}

// ---------------------------------------------------------------------------
// Animals
// ---------------------------------------------------------------------------
function initAnimals(getSettings) {
  const s0 = getSettings();
  const engine = createEngine($('stage'), { glow: s0.glow, motion: motionOf(s0), density: DENSITY[s0.density] });
  reduceMotion.addEventListener('change', () => engine.setMotion(motionOf(getSettings())));

  // UI the animals should swim around.
  const avoidEls = [$('switcher'), $('agenda'), document.querySelector('.clock'), $('quote'), $('search'), $('hints'), $('links')];
  const updateRects = () => engine.setAvoidRects(avoidEls.filter(el => el.getClientRects().length > 0).map(el => {
    const r = el.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom };
  }));
  updateRects();
  const ro = new ResizeObserver(updateRects);
  avoidEls.forEach(el => ro.observe(el));
  window.addEventListener('resize', updateRects);

  // Pointer
  window.addEventListener('pointermove', e => engine.setPointer(e.clientX, e.clientY), { passive: true });
  document.documentElement.addEventListener('pointerleave', () => engine.setPointer(null));
  window.addEventListener('blur', () => engine.setPointer(null));

  // Click on empty background (the canvas) = scatter, or feed for koi.
  let current = byId(store.get('animal', DEFAULT_ANIMAL));
  $('stage').addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (current.onClick === 'feed') engine.feed(e.clientX, e.clientY);
    else engine.scatter(e.clientX, e.clientY, scatterOf(getSettings()));
  });

  applyAnimalTheme(current);
  engine.setAnimal(current, { instant: true });

  // Specimen index: one entry per animal (numeral, common name, Latin name).
  // Old animals fade out, new ones come in from the edges.
  const bar = $('switcher');
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const span = (cls, text) => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  };
  const pills = ANIMALS.map((a, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'specimen';
    btn.dataset.id = a.id;
    btn.setAttribute('aria-pressed', String(a.id === current.id));
    btn.style.setProperty('--c', a.color);
    const no = span('specimen__no', ROMAN[i] ?? String(i + 1));
    no.setAttribute('aria-hidden', 'true');
    btn.append(no, span('specimen__name', a.label));
    if (a.latin) {
      const latin = span('specimen__latin', a.latin);
      latin.lang = 'la';
      btn.append(latin);
    }
    btn.addEventListener('click', () => select(a.id));
    bar.append(btn);
    return btn;
  });

  const listeners = [];
  function select(id) {
    if (id === current.id) return;
    current = byId(id);
    store.set('animal', current.id);
    applyAnimalTheme(current);
    engine.setAnimal(current);
    for (const p of pills) p.setAttribute('aria-pressed', String(p.dataset.id === current.id));
    listeners.forEach(fn => fn(current.id));
  }

  // Swarm toward the search bar for a moment before navigating.
  setBeforeNavigate(() => {
    if (reduceMotion.matches) return Promise.resolve();
    const r = $('search').getBoundingClientRect();
    engine.swarmTo(r.left + r.width / 2, r.top + r.height / 2, 400);
    return new Promise(res => setTimeout(res, 400));
  });

  engine.start();
  return {
    engine,
    select,
    current: () => current.id,
    onSelect: fn => listeners.push(fn),
    respawn: () => engine.setAnimal(current),
    updateRects,
  };
}

// ---------------------------------------------------------------------------
// Debug overlay: press ? (with the search bar unfocused)
// ---------------------------------------------------------------------------
function initDebug(engine) {
  const box = $('debug');
  let timer = 0;
  const draw = () => {
    const d = engine.debug;
    box.textContent = `${d.fps.toFixed(0)} fps · ${engine.count} animals · ${d.ms.toFixed(2)} ms/frame`;
  };
  document.addEventListener('keydown', e => {
    if (e.key !== '?' || isTyping(document.activeElement)) return;
    box.hidden = !box.hidden;
    clearInterval(timer);
    if (!box.hidden) { draw(); timer = setInterval(draw, 500); }
  });
}

// ---------------------------------------------------------------------------
async function boot() {
  await store.init();
  let settings = loadSettings();
  const getSettings = () => settings;

  initClock($('clock'), { use24h: settings.clock === '24h', dateEl: $('mast-date'), entryEl: $('entry-no') });
  // Murmurations draw their letters in the serif; make sure it's ready before the first one.
  document.fonts.load('italic 400 64px "Instrument Serif"').catch(() => {});
  initQuote(settings.showQuote);
  initSearch({ form: $('search'), input: $('q'), hints: $('hints') });
  const links = initLinks({ root: $('links'), form: $('link-form'), menu: $('link-menu') });
  links.setVisible(settings.showLinks);
  const calendar = initCalendar({
    card: $('agenda'), list: $('agenda-list'), settingsBox: $('cal-settings'),
    visible: settings.showCalendar, clock24: settings.clock === '24h',
  });
  const animals = initAnimals(getSettings);
  const { engine } = animals;

  const panel = initSettings({
    button: $('settings-btn'),
    panel: $('settings'),
    animals: ANIMALS,
    getAnimal: animals.current,
    reducedMotion: reduceMotion,
    onReset: () => animals.select(DEFAULT_ANIMAL),
    onChange(key, value, all) {
      settings = all;
      switch (key) {
        case 'animal': animals.select(value); break;
        case 'glow': engine.setGlow(value); break;
        case 'density': engine.setDensity(DENSITY[value]); animals.respawn(); break;
        case 'motion': engine.setMotion(motionOf(all)); break;
        case 'showQuote': $('quote').hidden = !value; break;
        case 'showLinks': links.setVisible(value); break;
        case 'showCalendar': calendar.setVisible(value); break;
        case 'clock': setClock24(value === '24h'); calendar.setClock24(value === '24h'); break;
        case 'focusMin': focus.refreshLabel(); break;
      }
      animals.updateRects();
    },
  });
  animals.onSelect(panel.syncAnimal);

  // ---- Focus tide ---------------------------------------------------------
  const focus = initFocus({
    clock: $('clock'), status: $('focus-status'), button: $('focus-btn'), bar: $('focus-bar'),
    engine, getMinutes: () => Number(settings.focusMin) || 25,
    onState: () => animals.updateRects(),
  });

  // ---- Murmurations -------------------------------------------------------
  // What to spell: an event starting soon, else the time or the quote's word.
  function murmurText(reason) {
    const now = Date.now();
    const ev = calendar.next();
    if (ev && ev.start - now <= 20 * 60_000) {
      const m = Math.max(1, Math.round((ev.start - now) / 60_000));
      const title = ev.title.length > 18 ? `${ev.title.slice(0, 17)}…` : ev.title;
      return [title, `in ${m} min`];
    }
    if (reason === 'hour' || Math.random() < 0.4) {
      const d = new Date();
      const h = settings.clock === '24h' ? String(d.getHours()).padStart(2, '0') : d.getHours() % 12 || 12;
      return [`${h}:${String(d.getMinutes()).padStart(2, '0')}`];
    }
    return [quoteWord(currentQuote)];
  }
  function tryMurmur(reason) {
    if (focus.active || engine.murmuring || document.hidden) return;
    if (reason !== 'manual' && (settings.murmur === 'off' || reduceMotion.matches)) return;
    engine.murmur(murmurText(reason));
  }
  $('stage').addEventListener('dblclick', () => tryMurmur('manual'));
  onMinute(d => { if (d.getMinutes() === 0) tryMurmur('hour'); });
  const chance = { off: 0, sometimes: 0.3, often: 1 }[settings.murmur] ?? 0.3;
  if (Math.random() < chance) setTimeout(() => tryMurmur('auto'), 2600);

  initDebug(engine);
  window.__engine = engine; // handy in DevTools while tuning
}

boot();

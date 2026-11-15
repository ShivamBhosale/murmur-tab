// Settings panel: a small floating panel under the top-right button.
// Everything persists under the `settings` key and applies live via onChange.

import { get, set } from './storage.js';

export const DEFAULTS = {
  glow: 8,              // px, 0–20
  density: 'normal',    // few | normal | many
  motion: 'full',       // full | calm
  showQuote: true,
  showLinks: true,
  clock: '12h',         // 12h | 24h
  showCalendar: true,
  focusMin: '25',       // 15 | 25 | 50
  murmur: 'sometimes',  // off | sometimes | often
};

export const DENSITY = { few: 0.6, normal: 1, many: 1.5 };

export function loadSettings() {
  return { ...DEFAULTS, ...get('settings', {}) };
}

/**
 * @param {object} o
 * @param {HTMLElement} o.button   the top-right toggle
 * @param {HTMLElement} o.panel    the panel element
 * @param {Array} o.animals        [{id,label}]
 * @param {() => string} o.getAnimal
 * @param {(key: string, value: any, all: object) => void} o.onChange
 * @param {() => void} o.onReset
 * @param {boolean} o.reducedMotion
 */
export function initSettings({ button, panel, animals, getAnimal, onChange, onReset, reducedMotion }) {
  let s = loadSettings();
  const $ = sel => panel.querySelector(sel);

  // ---- build the animal select --------------------------------------------
  const animalSel = $('#set-animal');
  for (const a of animals) animalSel.append(new Option(a.label, a.id));

  // ---- reflect state into the controls ------------------------------------
  function sync() {
    animalSel.value = getAnimal();
    $('#set-glow').value = s.glow;
    $('#set-glow-out').textContent = `${s.glow}px`;
    panel.querySelector(`input[name="density"][value="${s.density}"]`).checked = true;
    panel.querySelector(`input[name="motion"][value="${reducedMotion.matches ? 'calm' : s.motion}"]`).checked = true;
    panel.querySelectorAll('input[name="motion"]').forEach(r => { r.disabled = reducedMotion.matches; });
    $('#motion-note').hidden = !reducedMotion.matches;
    panel.querySelector(`input[name="clock"][value="${s.clock}"]`).checked = true;
    panel.querySelector(`input[name="focusMin"][value="${s.focusMin}"]`).checked = true;
    panel.querySelector(`input[name="murmur"][value="${s.murmur}"]`).checked = true;
    $('#set-quote').checked = s.showQuote;
    $('#set-links').checked = s.showLinks;
    $('#set-calendar').checked = s.showCalendar;
  }

  function update(key, value) {
    if (s[key] === value) return;
    s = { ...s, [key]: value };
    set('settings', s);
    onChange(key, value, s);
  }

  // ---- wire controls --------------------------------------------------------
  animalSel.addEventListener('change', () => onChange('animal', animalSel.value, s));
  $('#set-glow').addEventListener('input', e => {
    $('#set-glow-out').textContent = `${e.target.value}px`;
    update('glow', Number(e.target.value));
  });
  panel.addEventListener('change', e => {
    const t = e.target;
    if (['density', 'motion', 'clock', 'focusMin', 'murmur'].includes(t.name)) update(t.name, t.value);
    else if (t.id === 'set-quote') update('showQuote', t.checked);
    else if (t.id === 'set-links') update('showLinks', t.checked);
    else if (t.id === 'set-calendar') update('showCalendar', t.checked);
  });
  $('#set-reset').addEventListener('click', () => {
    const prev = s;
    s = { ...DEFAULTS };
    set('settings', s);
    for (const k of Object.keys(DEFAULTS)) if (prev[k] !== s[k]) onChange(k, s[k], s);
    onReset();
    sync();
  });
  reducedMotion.addEventListener('change', sync);

  // ---- open / close -----------------------------------------------------------
  function open() {
    sync();
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    animalSel.focus();
  }
  function close({ restoreFocus = false } = {}) {
    if (panel.hidden) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus();
  }
  button.addEventListener('click', () => (panel.hidden ? open() : close()));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); close({ restoreFocus: true }); }
  });
  document.addEventListener('pointerdown', e => {
    if (panel.hidden || panel.contains(e.target) || button.contains(e.target)) return;
    close();
  }, true);

  return {
    get: () => s,
    syncAnimal: () => { animalSel.value = getAnimal(); },
    close,
  };
}

// Quick links: render, add, edit, remove, reorder (menu or drag). Saved in storage.

import { get, set } from './storage.js';

export const MAX_LINKS = 10;
const KEY = 'links';

// Text marks only: no remote favicons, so it stays offline and on-style.
export const DEFAULT_LINKS = [
  { name: 'Gmail',    url: 'https://mail.google.com/',  mark: 'M' },
  { name: 'Claude',   url: 'https://claude.ai/',        mark: '*' },
  { name: 'GitHub',   url: 'https://github.com/',       mark: 'gh' },
  { name: 'YouTube',  url: 'https://www.youtube.com/',  mark: '▶' },
  { name: 'Drive',    url: 'https://drive.google.com/', mark: 'D' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/', mark: 'in' },
  { name: 'Indeed',   url: 'https://ca.indeed.com/',    mark: 'i' },
];

/** "Google Drive" → "GD", "Notion" → "N". */
export function autoMark(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const chars = words.length > 1 ? [...words[0]][0] + [...words[1]][0] : [...words[0]][0];
  return chars.toUpperCase();
}

/** Accepts "example.com" or a full http(s) URL. Returns a clean URL, or null if it isn't one. */
export function normalizeUrl(raw) {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = /^(localhost|127\.0\.0\.1)\b/i.test(s) ? `http://${s}` : `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.href;
  } catch {
    return null;
  }
}

export function initLinks({ root, form, menu }) {
  let links = load();
  let editing = -1;      // index being edited, or -1 when adding
  let menuIndex = -1;    // tile the menu belongs to
  let returnFocus = null;
  let dragFrom = -1;

  // ---- persistence -----------------------------------------------------------
  function load() {
    const saved = get(KEY, null);
    return Array.isArray(saved) ? saved.slice(0, MAX_LINKS) : DEFAULT_LINKS.map(l => ({ ...l }));
  }
  function save() {
    set(KEY, links);
    render();
  }

  // ---- render ----------------------------------------------------------------
  function render() {
    root.replaceChildren();
    links.forEach((l, i) => root.append(tile(l, i)));
    if (links.length < MAX_LINKS) root.append(addTile());
  }

  function tile(l, i) {
    const a = document.createElement('a');
    a.className = 'link';
    a.href = l.url;
    a.draggable = true;
    a.dataset.index = i;
    a.title = l.url;
    const mark = document.createElement('span');
    mark.className = 'link__mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = l.mark || autoMark(l.name);
    const label = document.createElement('span');
    label.className = 'link__label';
    label.textContent = l.name;
    a.append(mark, label);

    a.addEventListener('contextmenu', e => { e.preventDefault(); openMenu(i, a); });
    longPress(a, () => openMenu(i, a));

    // Drag to reorder.
    a.addEventListener('dragstart', e => {
      dragFrom = i;
      e.dataTransfer.effectAllowed = 'move';
      a.classList.add('is-dragging');
    });
    a.addEventListener('dragend', () => {
      dragFrom = -1;
      a.classList.remove('is-dragging');
      root.querySelectorAll('.is-drop').forEach(n => n.classList.remove('is-drop'));
    });
    a.addEventListener('dragover', e => {
      if (dragFrom < 0) return;
      e.preventDefault();
      a.classList.toggle('is-drop', dragFrom !== i);
    });
    a.addEventListener('dragleave', () => a.classList.remove('is-drop'));
    a.addEventListener('drop', e => {
      e.preventDefault();
      if (dragFrom < 0 || dragFrom === i) return;
      const [moved] = links.splice(dragFrom, 1);
      links.splice(i, 0, moved);
      save();
      focusTile(i);
    });
    return a;
  }

  function addTile() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'link link--add';
    b.setAttribute('aria-label', 'Add a quick link');
    const mark = document.createElement('span');
    mark.className = 'link__mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '+';
    const label = document.createElement('span');
    label.className = 'link__label';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = 'Add';
    b.append(mark, label);
    b.addEventListener('click', () => openForm(-1, b));
    return b;
  }

  function focusTile(i) {
    root.querySelector(`.link[data-index="${i}"]`)?.focus();
  }

  // ---- long press (touch / pen) ---------------------------------------------
  function longPress(el, fn) {
    let timer = 0, fired = false;
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      fired = false;
      timer = setTimeout(() => { fired = true; fn(); }, 500);
    });
    const cancel = () => clearTimeout(timer);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('click', e => { if (fired) { e.preventDefault(); fired = false; } });
  }

  // ---- floating panels -------------------------------------------------------
  function place(panel, anchor) {
    panel.hidden = false;
    const r = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const gap = 10;
    let x = r.left + r.width / 2 - p.width / 2;
    let y = r.bottom + gap;
    if (y + p.height > innerHeight - 12) y = r.top - gap - p.height; // flip above if no room
    x = Math.max(12, Math.min(x, innerWidth - p.width - 12));
    y = Math.max(12, y);
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  }

  function closeAll({ restoreFocus = false } = {}) {
    const wasOpen = !form.hidden || !menu.hidden;
    form.hidden = true;
    menu.hidden = true;
    menuIndex = -1;
    if (restoreFocus && wasOpen && returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  }

  // ---- menu ------------------------------------------------------------------
  const items = {
    edit: menu.querySelector('[data-act="edit"]'),
    remove: menu.querySelector('[data-act="remove"]'),
    left: menu.querySelector('[data-act="left"]'),
    right: menu.querySelector('[data-act="right"]'),
  };

  function openMenu(i, anchor) {
    closeAll();
    menuIndex = i;
    returnFocus = anchor;
    items.left.disabled = i === 0;
    items.right.disabled = i === links.length - 1;
    place(menu, anchor);
    items.edit.focus();
  }

  menu.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act || menuIndex < 0) return;
    const i = menuIndex;
    const anchor = returnFocus;
    if (act === 'edit') { closeAll(); openForm(i, anchor); return; }
    closeAll();
    if (act === 'remove') {
      links.splice(i, 1);
      save();
      focusTile(Math.min(i, links.length - 1));
    } else {
      const j = act === 'left' ? i - 1 : i + 1;
      [links[i], links[j]] = [links[j], links[i]];
      save();
      focusTile(j);
    }
  });

  // Arrow keys move through the menu.
  menu.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const btns = [...menu.querySelectorAll('button:not(:disabled)')];
    const k = btns.indexOf(document.activeElement);
    btns[(k + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length].focus();
  });

  // ---- add / edit form -------------------------------------------------------
  const f = {
    title: form.querySelector('.popover__title'),
    name: form.elements.name,
    url: form.elements.url,
    mark: form.elements.mark,
    error: form.querySelector('.popover__error'),
  };
  let markTouched = false;

  function openForm(i, anchor) {
    closeAll();
    editing = i;
    returnFocus = anchor;
    const l = links[i];
    f.title.textContent = l ? 'Edit link' : 'Add link';
    f.name.value = l?.name ?? '';
    f.url.value = l?.url ?? '';
    f.mark.value = l?.mark ?? '';
    f.error.textContent = '';
    markTouched = !!l;
    place(form, anchor);
    f.name.focus();
  }

  f.name.addEventListener('input', () => { if (!markTouched) f.mark.value = autoMark(f.name.value); });
  f.mark.addEventListener('input', () => { markTouched = f.mark.value.trim() !== ''; });
  form.addEventListener('input', () => { f.error.textContent = ''; });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = f.name.value.trim();
    const url = normalizeUrl(f.url.value);
    if (!name) { f.error.textContent = 'Give it a name.'; f.name.focus(); return; }
    if (!url) { f.error.textContent = 'That doesn’t look like a web address.'; f.url.focus(); return; }
    const mark = [...(f.mark.value.trim() || autoMark(name))].slice(0, 2).join('');
    const entry = { name, url, mark };
    let at;
    if (editing >= 0) { links[editing] = entry; at = editing; }
    else if (links.length < MAX_LINKS) { links.push(entry); at = links.length - 1; }
    closeAll();
    save();
    focusTile(at);
  });

  form.querySelector('[data-cancel]').addEventListener('click', () => closeAll({ restoreFocus: true }));

  // Esc or a click outside closes whichever panel is open.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && (!form.hidden || !menu.hidden)) {
      e.preventDefault();
      e.stopPropagation();
      closeAll({ restoreFocus: true });
    }
  }, true);
  document.addEventListener('pointerdown', e => {
    if (form.hidden && menu.hidden) return;
    if (form.contains(e.target) || menu.contains(e.target)) return;
    closeAll();
  }, true);
  window.addEventListener('resize', () => closeAll());

  render();

  return {
    setVisible(on) { root.hidden = !on; if (!on) closeAll(); },
  };
}

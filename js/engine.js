// Canvas engine: DPR-aware sizing, fixed-timestep loop, pre-rendered glowing
// ASCII sprites, click effects. The dot grid is a CSS background (zero cost).

import { Swarm, FLOCK } from './flock.js';
import { Murmuration, freeBox } from './murmur.js';

const STEP = 1 / 60;
const FONT = '"JetBrains Mono"';
const CHAR_W = 0.6;   // JetBrains Mono advance width / font size
const LINE_H = 1.16;  // line height / font size

/** Split frames into lines. Drops the newline right after the backtick, trailing blanks
 *  and any indent shared by every frame. Blank rows at the top are kept, so a body can
 *  sit on the same row in every frame (frames are top-aligned). */
const prepared = new WeakMap();
function prepare(animal) {
  let p = prepared.get(animal);
  if (p) return p;
  const frames = animal.frames.map(f => {
    return f.replace(/^\r?\n/, '').replace(/\s+$/, '').split('\n');
  });
  const indent = Math.min(...frames.flat().filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
  for (const f of frames) for (let i = 0; i < f.length; i++) f[i] = f[i].slice(indent);
  const cols = Math.max(...frames.flat().map(l => l.length));
  const rows = Math.max(...frames.map(f => f.length));
  p = { frames, cols, rows };
  prepared.set(animal, p);
  return p;
}

export function createEngine(canvas, { glow = 8, motion = 1, density = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  const world = {
    w: 0, h: 0, dpr: 1, time: 0,
    motion,               // effective speed multiplier (base × tide)
    baseMotion: motion,   // from settings / reduced motion
    tide: 1, tideTarget: 1, // 1 = awake, 0 = asleep (focus mode)
    animTime: 0,          // frame clock; slows down as the tide goes out
    dim: 1,               // animal opacity multiplier (murmurations)
    pointerX: 0, pointerY: 0, hasPointer: false,
    rects: [],
    food: [],
    onEat: null,
  };
  const swarms = [];
  const effects = [];
  const trails = []; // jellyfish trail characters
  const cache = new Map();
  const murmur = new Murmuration();
  let accent = '#ffffff';

  // ---- sprites --------------------------------------------------------------
  // Each (frame, size, colour) is drawn once, glow included, into a small canvas
  // and then just drawImage'd every frame.
  function bake(key, lines, cols, rows, size, color, spots, spotChar) {
    let s = cache.get(key);
    if (s) return s;
    const dpr = world.dpr;
    const pad = Math.ceil(glow * 1.8 + 2);
    const cw = size * CHAR_W, lh = size * LINE_H;
    const w = Math.ceil(cols * cw + pad * 2);
    const h = Math.ceil(rows * lh + pad * 2);
    const c = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w * dpr, h * dpr)
      : Object.assign(document.createElement('canvas'), { width: w * dpr, height: h * dpr });
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.font = `600 ${size}px ${FONT}`;
    g.textBaseline = 'top';
    const y0 = pad;

    // One character at a time: exact grid, and no font ligatures (">=" must not become "≥").
    const pass = blur => {
      g.shadowBlur = blur;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i], y = y0 + i * lh;
        for (let k = 0; k < line.length; k++) {
          const ch = line[k];
          if (ch === ' ') continue;
          g.fillStyle = g.shadowColor = spots && ch === spotChar ? spots : color;
          g.fillText(ch, pad + k * cw, y);
        }
      }
    };
    if (glow > 0) pass(glow * dpr); // shadowBlur ignores the transform
    pass(0);                          // crisp core on top

    s = { img: c, w, h };
    cache.set(key, s);
    return s;
  }

  function sprite(animal, frame, size, color, spots) {
    const { frames, cols, rows } = prepare(animal);
    return bake(`${animal.id}|${frame}|${size}|${color}|${spots}`, frames[frame], cols, rows, size, color, spots, animal.spotChar);
  }

  function glyph(ch, size, color) {
    return bake(`glyph|${ch}|${size}|${color}`, [ch], 1, 1, size, color, null, null);
  }

  // ---- sizing -----------------------------------------------------------------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (dpr !== world.dpr) cache.clear();
    world.dpr = dpr;
    world.w = window.innerWidth;
    world.h = window.innerHeight;
    canvas.width = Math.round(world.w * dpr);
    canvas.height = Math.round(world.h * dpr);
    for (const s of swarms) s.contain(world);
  }
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
  });
  resize();

  // ---- loop -------------------------------------------------------------------
  function update(dt) {
    world.time += dt;

    // Tide: drift to sleep slowly (focus), wake up quickly.
    const goingOut = world.tideTarget < world.tide;
    const rate = dt / (goingOut ? 9 : 0.9);
    world.tide = goingOut ? Math.max(world.tideTarget, world.tide - rate) : Math.min(world.tideTarget, world.tide + rate);
    const awake = world.tide * world.tide;
    world.motion = world.baseMotion * (0.02 + 0.98 * awake);
    world.animTime += dt * (0.08 + 0.92 * awake);
    world.dim = murmur.update(dt);

    for (let i = swarms.length - 1; i >= 0; i--) {
      const s = swarms[i];
      s.step(dt, world);
      if (s.fadeTarget === 0 && s.fade === 0) swarms.splice(i, 1);
    }
    updateFood(dt);
    updateTrails(dt);
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].t += dt / effects[i].dur;
      if (effects[i].t >= 1) effects.splice(i, 1);
    }
  }

  // ---- food (koi) -------------------------------------------------------------
  const FOOD_COLOR = '#ffd27a';
  const FOOD_LIFE = 30; // seconds before uneaten food dissolves

  function updateFood(dt) {
    const f = world.food;
    const sink = Math.exp(-0.35 * dt);
    for (let i = f.length - 1; i >= 0; i--) {
      const p = f[i];
      p.age += dt;
      p.vy *= sink;                        // slows as it sinks
      p.y += p.vy * dt;
      p.x += Math.sin(p.age * 1.4 + p.ph) * 5 * dt;
      if (!p.alive || p.age > FOOD_LIFE) f.splice(i, 1);
    }
  }

  world.onEat = p => {
    effects.push({ x: p.x, y: p.y, t: 0, dur: 0.45, radius: 14, n: 6, spin: Math.random() * 3, chars: ['·', '.'], color: FOOD_COLOR });
  };

  // ---- trails (jellyfish) ---------------------------------------------------
  function updateTrails(dt) {
    for (let i = trails.length - 1; i >= 0; i--) {
      const p = trails[i];
      p.age += dt;
      p.y += 6 * dt; // drift down a touch as the jelly rises away
      if (p.age >= p.life) trails.splice(i, 1);
    }
    for (const s of swarms) {
      const T = s.b.trail;
      if (!T || s.fadeTarget === 0) continue;
      const { rows } = prepare(s.animal);
      for (const b of s.boids) {
        if (b.fade < 0.5) continue;
        b.trailT -= dt;
        if (b.trailT > 0) continue;
        b.trailT = T.every * (0.8 + Math.random() * 0.4);
        const below = rows * b.size * LINE_H * 0.5;
        trails.push({
          x: b.x + (Math.random() - 0.5) * b.size * 2.4, y: b.y + below,
          age: 0, life: T.life, color: b.color, alpha: b.opacity * 0.7,
          ch: T.chars[Math.floor(Math.random() * T.chars.length)], size: Math.max(8, b.size - 1),
        });
      }
    }
  }

  function render(alpha) {
    const dpr = world.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const t = world.animTime;
    const sleepy = 0.28 + 0.72 * world.tide; // animals dim as they fall asleep

    for (const p of trails) {
      const g = glyph(p.ch, p.size, p.color);
      ctx.globalAlpha = p.alpha * (1 - p.age / p.life);
      ctx.setTransform(dpr, 0, 0, dpr, p.x * dpr, p.y * dpr);
      ctx.drawImage(g.img, -g.w / 2, -g.h / 2, g.w, g.h);
    }

    for (const s of swarms) {
      const A = s.animal, B = s.b, nf = A.frames.length;
      for (const b of s.boids) {
        const a = b.opacity * b.fade * s.fade * sleepy * world.dim;
        if (a < 0.01) continue;
        const frame = A.frameFor ? A.frameFor(b, t) : Math.floor((t * 1000 + b.frameOffset) / A.frameMs) % nf;
        const sp = sprite(A, frame, b.size, b.color, b.spots);
        const x = b.px + (b.x - b.px) * alpha;
        let y = b.py + (b.y - b.py) * alpha - b.lift;
        if (B.bobAmp) y += Math.sin(t * B.bobFreq + b.phase) * B.bobAmp * (0.6 + 0.4 * b.depth);
        const k = dpr * b.scale;
        const c = Math.cos(b.angle) * k, sn = Math.sin(b.angle) * k;
        // fx mirrors side-view sprites flying left; fy mirrors instead of swimming upside down.
        const fx = B.flipX && b.dir < 0 ? -1 : 1;
        const fy = B.flipY && c < 0 ? -1 : 1;
        ctx.globalAlpha = a;
        ctx.setTransform(c * fx, sn * fx, -sn * fy, c * fy, x * dpr, y * dpr);
        ctx.drawImage(sp.img, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
      }
    }

    murmur.render(ctx, dpr, glyph);

    for (const p of world.food) {
      const g = glyph(p.ch, p.size, FOOD_COLOR);
      const life = FOOD_LIFE - p.age;
      ctx.globalAlpha = Math.min(1, p.age * 4, life / 2) * (0.8 + 0.2 * Math.sin(p.age * 5 + p.ph));
      ctx.setTransform(dpr, 0, 0, dpr, p.x * dpr, p.y * dpr);
      ctx.drawImage(g.img, -g.w / 2, -g.h / 2, g.w, g.h);
    }

    // Click ring: characters expanding outward.
    if (effects.length) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `400 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const e of effects) {
        ctx.fillStyle = e.color ?? accent;
        const p = e.t, ease = 1 - (1 - p) ** 3;
        const r = 14 + ease * e.radius;
        ctx.globalAlpha = (1 - p) * 0.7;
        for (let k = 0; k < e.n; k++) {
          const ang = (k / e.n) * Math.PI * 2 + e.spin;
          ctx.fillText(e.chars[k % e.chars.length], e.x + Math.cos(ang) * r, e.y + Math.sin(ang) * r);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  let acc = 0, last = 0, raf = 0, running = false;
  const debug = { fps: 0, frames: 0, since: 0, ms: 0 };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // after a stall, don't fast-forward
    const t0 = performance.now();
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    render(acc / STEP);
    debug.ms += (performance.now() - t0 - debug.ms) * 0.05; // smoothed script time per frame
    debug.frames++;
    if (now - debug.since >= 500) { debug.fps = debug.frames * 1000 / (now - debug.since); debug.frames = 0; debug.since = now; }
  }
  function start() {
    if (running || document.hidden) return;
    running = true;
    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  // ---- public API -----------------------------------------------------------------
  return {
    world,
    debug,
    async start() {
      // Canvas text needs the font actually loaded before we pre-render sprites.
      try { await document.fonts.load(`600 14px ${FONT}`); } catch { /* fall back to system mono */ }
      cache.clear();
      start();
    },

    /** Switch animal. The old swarm fades out while the new one fades in from the edges. */
    setAnimal(animal, { instant = false } = {}) {
      for (const s of swarms) s.fadeTarget = 0;
      world.food.length = 0;
      const count = Math.max(1, Math.round(animal.count * density));
      const s = new Swarm(animal, world, { count, fromEdges: !instant });
      swarms.push(s);
      accent = animal.color;
    },

    scatter(x, y, strength = 1) {
      strength *= 0.25 + 0.75 * world.tide; // sleepy animals barely stir
      murmur.burst(x, y);
      for (const s of swarms) s.scatter(x, y, strength, world);
      effects.push({
        x, y, t: 0, dur: 0.75, radius: 150 * strength + 30,
        n: 28, spin: Math.random() * Math.PI, chars: ['·', '.', ':', '·', '*'],
      });
    },

    /** Drop 6–10 food pellets around (x, y). */
    feed(x, y) {
      const n = 6 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        world.food.push({
          x: x + (Math.random() - 0.5) * 56, y: y + (Math.random() - 0.5) * 30,
          vy: 10 + Math.random() * 14, age: 0, ph: Math.random() * 6.3, alive: true,
          ch: Math.random() < 0.5 ? '·' : '•', size: 12 + Math.floor(Math.random() * 5),
        });
      }
      effects.push({ x, y, t: 0, dur: 0.6, radius: 40, n: 14, spin: Math.random() * 3, chars: ['·', '.', '°'], color: FOOD_COLOR });
    },

    setPointer(x, y) {
      if (x == null) { world.hasPointer = false; return; }
      world.hasPointer = true;
      world.pointerX = x;
      world.pointerY = y;
    },

    /** Everyone rushes toward (x, y) for `ms`, e.g. the search bar on submit. */
    swarmTo(x, y, ms = 400) {
      for (const s of swarms) s.swarmTo(x, y, ms);
    },

    setAvoidRects(rects) { world.rects = rects; },
    setDensity(d) { density = d; },
    setMotion(m) { world.baseMotion = m; },

    /** Focus tide: asleep = true sends the animals to sleep; false wakes them. */
    sleep(asleep, { instant = false } = {}) {
      world.tideTarget = asleep ? 0 : 1;
      if (instant) world.tide = world.tideTarget;
    },
    /** Wake with a burst from the centre of the screen. */
    wake() {
      world.tideTarget = 1;
      world.tide = Math.max(world.tide, 0.35);
      const x = world.w / 2, y = world.h / 2;
      for (const s of swarms) s.scatter(x, y, 0.9, world);
      effects.push({ x, y, t: 0, dur: 1.4, radius: Math.max(world.w, world.h) * 0.45, n: 48, spin: 0, chars: ['·', '*', '.', ':', '+'] });
      effects.push({ x, y, t: 0, dur: 1.1, radius: Math.max(world.w, world.h) * 0.25, n: 32, spin: 0.3, chars: ['·', '.'] });
    },
    get asleep() { return world.tideTarget === 0; },

    /** Murmuration: the animals' characters spell `lines` (1–2 short strings). */
    murmur(lines) {
      if (murmur.active || world.tideTarget === 0) return false;
      const s = swarms.find(x => x.fadeTarget === 1);
      if (!s) return false;
      const { frames } = prepare(s.animal);
      const chars = [...new Set(frames.flat().join('').replace(/\s/g, ''))];
      const sources = s.boids.filter(b => b.fade > 0.5).map(b => ({ boid: b, chars, color: b.color }));
      return murmur.start(lines, freeBox(world), sources);
    },
    get murmuring() { return murmur.active; },
    setGlow(px) { glow = px; cache.clear(); },
    get count() { return swarms.reduce((n, s) => n + (s.fadeTarget ? s.boids.length : 0), 0); },
    FLOCK,
  };
}

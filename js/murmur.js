// Murmuration moments: the animals come apart into their own ASCII characters,
// the characters swirl together to spell a word, hold it, then fly home and
// become animals again.

// ---------------------------------------------------------------------------
// Tune the feel here.
// ---------------------------------------------------------------------------
export const MURMUR = {
  points: 420,       // characters for a short word; longer phrases get more (up to maxPoints)
  maxPoints: 900,
  maxFont: 150,      // px, largest letter height
  gatherS: 1.8,      // seconds to fly in
  holdS: 2.8,        // seconds the word holds
  releaseS: 1.5,     // seconds to fly home
  spring: 9,         // pull toward the target (higher = snappier)
  swirl: 260,        // sideways sweep on the way in (the "murmuration" arc)
  dimAnimals: 0.1,   // animal opacity while they're "being" the word
};

const FONT = 'italic 400 {size}px "Instrument Serif", Georgia, serif';
const rand = (a, b) => a + Math.random() * (b - a);

/** Rasterise lines of text and sample points from the filled pixels. */
function sampleText(lines, maxW, maxH, target) {
  const probe = new OffscreenCanvas(8, 8).getContext('2d');
  let size = 200;
  probe.font = FONT.replace('{size}', size);
  const widest = Math.max(...lines.map(l => probe.measureText(l).width), 1);
  const lineH = 1.08;
  size = Math.min(MURMUR.maxFont, size * Math.min(maxW / widest, maxH / (size * lineH * lines.length)));
  size = Math.max(26, Math.floor(size));

  const w = Math.ceil(widest * size / 200) + 8;
  const h = Math.ceil(size * lineH * lines.length) + 8;
  const c = new OffscreenCanvas(w, h);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.font = FONT.replace('{size}', size);
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillStyle = '#fff';
  lines.forEach((l, i) => g.fillText(l, w / 2, 4 + i * size * lineH));
  const data = g.getImageData(0, 0, w, h).data;

  // Pick a grid step that gives roughly `target` points.
  let filled = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (data[(y * w + x) * 4 + 3] > 140) filled++;
  const step = Math.max(3, Math.round(Math.sqrt((filled * 4) / target)));

  const pts = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] > 140) pts.push({ x: x + rand(-0.25, 0.25) * step, y: y + rand(-0.25, 0.25) * step });
    }
  }
  while (pts.length > target * 1.3) pts.splice(Math.floor(Math.random() * pts.length), 1);
  return { pts, w, h, step };
}

export class Murmuration {
  constructor() {
    this.parts = [];
    this.phase = 'idle'; // idle | gather | hold | release
    this.t = 0;
  }

  get active() { return this.phase !== 'idle'; }

  /**
   * @param {string[]} lines  text to spell (1–2 short lines)
   * @param {{x:number,y:number,w:number,h:number}} box  where to put it (centre + max size)
   * @param {Array<{boid:object, chars:string[], color:string}>} sources  the animals to borrow characters from
   */
  start(lines, box, sources) {
    if (!sources.length) return false;
    const len = Math.max(...lines.map(l => l.length));
    const target = Math.min(MURMUR.maxPoints, Math.round(MURMUR.points * Math.max(1, len / 5) ** 0.7 * Math.sqrt(lines.length)));
    const { pts, w, h, step } = sampleText(lines, box.w, box.h, target);
    if (!pts.length) return false;
    const ox = box.x - w / 2, oy = box.y - h / 2;
    const size = Math.max(8, Math.min(15, Math.round(step * 1.35)));

    // Sort targets left→right so each animal's characters land near each other.
    pts.sort((a, b) => a.x - b.x);
    const per = Math.ceil(pts.length / sources.length);
    const bySide = [...sources].sort((a, b) => a.boid.x - b.boid.x);

    this.parts = pts.map((p, i) => {
      const src = bySide[Math.min(bySide.length - 1, Math.floor(i / per))];
      const b = src.boid;
      return {
        x: b.x + rand(-14, 14), y: b.y + rand(-10, 10),
        vx: rand(-40, 40), vy: rand(-40, 40),
        tx: ox + p.x, ty: oy + p.y,
        ch: src.chars[Math.floor(Math.random() * src.chars.length)],
        color: src.color, size,
        delay: rand(0, 0.45) + (i / pts.length) * 0.25,
        spin: Math.random() < 0.5 ? -1 : 1,
        a: 0, home: b,
      };
    });
    this.phase = 'gather';
    this.t = 0;
    return true;
  }

  /** Let go early (e.g. a click): characters burst away from (x, y) and fly home. */
  burst(x, y) {
    if (!this.active) return;
    for (const p of this.parts) {
      const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
      const k = 500 * Math.max(0.2, 1 - d / 500);
      p.vx += dx / d * k; p.vy += dy / d * k;
    }
    this.phase = 'release';
    this.t = 0;
  }

  /** @returns the animal opacity multiplier for this moment */
  update(dt) {
    if (!this.active) return 1;
    this.t += dt;
    const M = MURMUR;
    if (this.phase === 'gather' && this.t > M.gatherS) { this.phase = 'hold'; this.t = 0; }
    else if (this.phase === 'hold' && this.t > M.holdS) { this.phase = 'release'; this.t = 0; }
    else if (this.phase === 'release' && this.t > M.releaseS) { this.phase = 'idle'; this.parts = []; return 1; }

    const K = M.spring, C = 2 * Math.sqrt(K) * 0.9;
    const releasing = this.phase === 'release';
    for (const p of this.parts) {
      let tx = p.tx, ty = p.ty, k = K;
      if (releasing) {
        tx = p.home.x; ty = p.home.y; k = K * 0.7;
        p.a = Math.max(0, p.a - dt / (M.releaseS * 0.8));
      } else {
        if (this.phase === 'gather' && this.t < p.delay) { p.x = p.home.x; p.y = p.home.y; continue; }
        p.a = Math.min(1, p.a + dt * 3);
        if (this.phase === 'hold') { tx += Math.sin(this.t * 2.2 + p.ty * 0.05) * 0.8; ty += Math.cos(this.t * 1.8 + p.tx * 0.05) * 0.8; }
      }
      const dx = tx - p.x, dy = ty - p.y;
      let ax = dx * k - p.vx * C, ay = dy * k - p.vy * C;
      // Sweep sideways on the way in, fading as they arrive: the murmuration arc.
      if (this.phase === 'gather') {
        const d = Math.hypot(dx, dy) || 1;
        const s = M.swirl * Math.max(0, 1 - (this.t - p.delay) / (M.gatherS * 0.7)) * Math.min(1, d / 120);
        ax += (-dy / d) * s * p.spin; ay += (dx / d) * s * p.spin;
      }
      p.vx += ax * dt; p.vy += ay * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }

    // Animals fade while they "are" the word, and fade back as it dissolves.
    if (this.phase === 'gather') return 1 - (1 - M.dimAnimals) * Math.min(1, this.t / (M.gatherS * 0.5));
    if (this.phase === 'hold') return M.dimAnimals;
    return M.dimAnimals + (1 - M.dimAnimals) * Math.min(1, this.t / (M.releaseS * 0.8));
  }

  render(ctx, dpr, glyph) {
    for (const p of this.parts) {
      if (p.a < 0.02) continue;
      const g = glyph(p.ch, p.size, p.color);
      ctx.globalAlpha = p.a * 0.95;
      ctx.setTransform(dpr, 0, 0, dpr, p.x * dpr, p.y * dpr);
      ctx.drawImage(g.img, -g.w / 2, -g.h / 2, g.w, g.h);
    }
  }
}

/**
 * Find the largest empty horizontal band of the screen (between UI blocks)
 * and return a box to write in.
 */
export function freeBox(world) {
  const { w, h, rects } = world;
  const spans = rects.map(r => [r.t, r.b]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]); else merged.push([...s]);
  }
  let best = { top: 0, bot: 0 }, cursor = 24;
  for (const [t, b] of [...merged, [h - 44, h]]) {
    if (t - cursor > best.bot - best.top) best = { top: cursor, bot: t };
    cursor = Math.max(cursor, b);
  }
  const gap = best.bot - best.top;
  return { x: w / 2, y: (best.top + best.bot) / 2, w: Math.min(w * 0.8, 980), h: Math.max(60, gap - 40) };
}

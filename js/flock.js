// Boids flocking + wander + scatter + soft edges + UI/cursor avoidance,
// plus movement modes for animals that don't simply fly:
//   'flock' (default) · 'dart' (dragonfly) · 'hop' (frog) · 'walk' (crab)
// Units: positions in CSS px, velocities in px/s, forces in px/s².

// ---------------------------------------------------------------------------
// Global feel. Per-animal movement lives in each animal's `behavior` object.
// ---------------------------------------------------------------------------
export const FLOCK = {
  edgeMargin: 90,       // px from the screen edge where animals start turning back
  edgeForce: 380,       // push at the very edge (grows past it)

  uiPadding: 56,        // soft zone around the clock, quote, search bar and links
  uiForce: 360,         // push at the UI's edge; animals may still drift over sometimes

  cursorRadius: 80,     // animals gently avoid the pointer inside this radius
  cursorForce: 520,

  scatterRadius: 480,   // click reach
  scatterImpulse: 720,  // px/s added at the click point (fades with distance)
  impulseDecay: 1.9,    // 1/s. Higher = settles faster. 1.9 ≈ calm again in 2–3 s

  spawnFadeMs: 700,     // per-animal fade-in when spawned
  swarmFadeMs: 400,     // whole-swarm fade when switching animals
};

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = ([a, b]) => rand(a, b);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Swarm {
  constructor(animal, world, { count = animal.count, fromEdges = false } = {}) {
    this.animal = animal;
    this.b = animal.behavior;
    this.mode = this.b.mode ?? 'flock';
    this.boids = [];
    this.fade = 1;
    this.fadeTarget = 1;
    this.rush = null; // {x, y, until} while everyone swarms a point

    const [smin, smax] = animal.sizeRange;
    const slots = this.slots(world, count);
    for (let i = 0; i < count; i++) {
      const size = Math.round(rand(smin, smax));
      const depth = smax > smin ? (size - smin) / (smax - smin) : 1;
      const boid = {
        x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
        ix: 0, iy: 0,                       // scatter impulse (decays)
        wa: rand(0, TAU),                   // wander angle
        burst: 0,
        size, depth,
        speedScale: 0.6 + 0.4 * depth,      // small = far = slower
        opacity: clamp(0.55 + 0.4 * depth + rand(-0.05, 0.05), 0.55, 0.95),
        color: animal.color,
        spots: null,                        // optional second colour (koi patterns)
        frameOffset: rand(0, animal.frameMs * animal.frames.length),
        phase: rand(0, TAU),
        angle: 0,
        dir: Math.random() < 0.5 ? -1 : 1,  // facing for side-view sprites
        scale: 1, lift: 0,                  // hop visuals
        state: 0, timer: rand(0, 1.2),      // mode state machine
        fade: 0,
        trailT: rand(0, 0.3),
      };
      if (animal.pickColor) {
        const v = animal.pickColor(i);
        if (typeof v === 'string') boid.color = v; else { boid.color = v.color; boid.spots = v.spots ?? null; }
      }
      boid.x = slots[i].x; boid.y = slots[i].y;
      let a = rand(0, TAU);
      // Start just off-screen, heading to its spot. Frogs and jellyfish simply fade in where they are.
      if (fromEdges && this.mode !== 'hop' && !this.b.wrapY) a = this.enterFromEdge(boid, world);
      const s = (this.b.minSpeed + this.b.maxSpeed) * 0.5;
      boid.vx = Math.cos(a) * s * boid.speedScale;
      boid.vy = Math.sin(a) * s * boid.speedScale;
      if (this.mode === 'walk') boid.vy = 0;
      if (Math.abs(boid.vx) > 1) boid.dir = Math.sign(boid.vx);
      boid.wa = a;
      boid.angle = this.b.upright ? 0 : a + (this.b.facing ?? 0);
      if (fromEdges && this.mode === 'walk') {
        // Crabs scuttle in sideways toward their spot.
        boid.state = 1; boid.timer = 2.5; boid.tx = slots[i].x; boid.ty = slots[i].y;
        boid.dir = boid.x < slots[i].x ? 1 : -1;
      }
      boid.px = boid.x; boid.py = boid.y;
      this.boids.push(boid);
    }
    // Draw far (small) ones first.
    this.boids.sort((p, q) => p.size - q.size);
  }

  bandTop(h) { return h * (this.b.yMin ?? 0); }
  bandBot(h) { return h * (this.b.yMax ?? 1); }

  /** Move a boid from its spot to just past the nearest screen edge; returns the heading back in. */
  enterFromEdge(boid, world) {
    const { w, h } = world;
    const top = this.bandTop(h), bot = this.bandBot(h);
    const dl = boid.x, dr = w - boid.x, dt = boid.y - top, db = bot - boid.y;
    const sideOnly = this.mode === 'walk' || this.b.wrapY;
    const m = sideOnly ? Math.min(dl, dr) : Math.min(dl, dr, dt, db), off = 40;
    if (m === dl) { boid.x = -off; return 0; }
    if (m === dr) { boid.x = w + off; return Math.PI; }
    if (m === dt) { boid.y = top - off; return Math.PI / 2; }
    boid.y = bot + off; return -Math.PI / 2;
  }

  /** Evenly spread spots: a jittered grid over the screen, skipping cells under the UI. */
  slots(world, count) {
    const { w, h, rects } = world;
    const top = this.bandTop(h), bot = this.bandBot(h);
    const m = 50, W = w - m * 2, H = Math.max(40, bot - top - m * 2);
    let cells = [];
    for (let k = count; cells.length < count && k < count * 6; k = Math.ceil(k * 1.25)) {
      const cols = Math.max(1, Math.round(Math.sqrt(k * W / H)));
      const rows = Math.max(1, Math.ceil(k / cols));
      const cw = W / cols, ch = H / rows;
      cells = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = m + (c + 0.5) * cw + rand(-0.3, 0.3) * cw;
        const y = top + m + (r + 0.5) * ch + rand(-0.3, 0.3) * ch;
        if (!insideAny(x, y, rects, FLOCK.uiPadding * 0.5)) cells.push({ x, y });
      }
    }
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    while (cells.length < count) cells.push({ x: rand(m, w - m), y: rand(top + m, Math.max(top + m, bot - m)) });
    return cells.slice(0, count);
  }

  /** Personal space so the swarm fills the screen evenly: the side of each animal's share of it. */
  evenSpacing(world) {
    const { w, h } = world;
    return Math.sqrt((w * (this.bandBot(h) - this.bandTop(h))) / Math.max(1, this.boids.length));
  }

  /** Keep everyone in the new bounds after a resize. */
  contain(world) {
    const top = this.bandTop(world.h), bot = this.bandBot(world.h);
    for (const b of this.boids) {
      b.x = clamp(b.x, -40, world.w + 40);
      b.y = this.mode === 'walk' ? clamp(b.y, top + 20, bot - 20) : clamp(b.y, -40, world.h + 40);
      if (b.tx != null) { b.tx = clamp(b.tx, 20, world.w - 20); b.ty = clamp(b.ty, top, bot); }
      b.px = b.x; b.py = b.y;
    }
  }

  /** Radial push away from (x, y). strength 1 = full, lower for reduced motion. */
  scatter(x, y, strength = 1, world) {
    const R = FLOCK.scatterRadius;
    for (const b of this.boids) {
      let dx = b.x - x, dy = b.y - y;
      let d = Math.hypot(dx, dy);
      if (d > R) continue;
      if (d < 0.5) { const a = rand(0, TAU); dx = Math.cos(a); dy = Math.sin(a); d = 1; }
      const k = 1 - d / R;
      const ux = dx / d, uy = dy / d;

      if (this.mode === 'hop') {
        // Frogs leap away instead of sliding.
        this.startHop(b, ux, uy, (90 + 140 * k) * strength, world, 0.42);
        continue;
      }
      const imp = FLOCK.scatterImpulse * strength * (0.25 + 0.75 * k * k) * (0.7 + 0.3 * b.speedScale);
      b.ix += ux * imp;
      b.iy += this.mode === 'walk' ? 0 : uy * imp; // crabs only go sideways
      b.wa = Math.atan2(dy, dx);
      b.burst = 0;
      if (this.mode === 'walk') { b.dir = ux >= 0 ? 1 : -1; b.state = 1; b.timer = rand(1, 2); }
      if (this.mode === 'dart') { b.state = 1; b.timer = 0.4; }
    }
  }

  /** Everyone rushes toward (x, y) for a moment. */
  swarmTo(x, y, ms) {
    this.rush = { x, y, until: performance.now() + ms };
  }

  // -------------------------------------------------------------------------
  step(dt, world) {
    const B = this.b, bs = this.boids, n = bs.length;
    const { w, h, rects, motion } = world;
    const mode = this.mode;

    const sr = B.spread ? Math.max(B.separationRadius, this.evenSpacing(world) * B.spread) : B.separationRadius;
    const sr2 = sr * sr;
    const nr = Math.max(B.neighborRadius, sr), nr2 = nr * nr;
    const decay = Math.exp(-FLOCK.impulseDecay * dt);
    const sqdt = Math.sqrt(dt);
    const em = FLOCK.edgeMargin, ef = FLOCK.edgeForce;
    const top = this.bandTop(h), bot = this.bandBot(h);
    const pad = FLOCK.uiPadding, pad2 = pad * pad;
    const cr = FLOCK.cursorRadius, cr2 = cr * cr;
    const rush = this.rush && performance.now() < this.rush.until ? this.rush : (this.rush = null);

    const sf = dt / (FLOCK.swarmFadeMs / 1000);
    this.fade = this.fadeTarget > this.fade ? Math.min(this.fadeTarget, this.fade + sf) : Math.max(this.fadeTarget, this.fade - sf);
    const bf = dt / (FLOCK.spawnFadeMs / 1000);
    const cycle = this.animal.frameMs * this.animal.frames.length;

    for (let i = 0; i < n; i++) {
      const b = bs[i];
      if (b.fade < 1) b.fade = Math.min(1, b.fade + bf);
      b.px = b.x; b.py = b.y;

      // Avoidance (ox, oy): separation, edges, UI, cursor. Every mode uses it.
      // Steering (ax, ay): alignment, cohesion, wander, food. Only flying modes use it.
      let ox = 0, oy = 0, ax = 0, ay = 0;

      // --- food (seek) ---------------------------------------------------
      let food = null;
      if (B.seek && world.food.length) {
        let best = B.seek.radius * B.seek.radius;
        for (const p of world.food) {
          if (!p.alive) continue;
          const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < best) { best = d2; food = p; }
        }
        if (food) {
          const fd = Math.sqrt(best);
          if (fd < B.seek.eatRadius * (1 + 0.3 * b.depth)) {
            food.alive = false;
            world.onEat?.(food);
            food = null;
          } else {
            const want = B.maxSpeed * B.seek.speed * b.speedScale * motion;
            ax += ((food.x - b.x) / fd * want - b.vx) * B.seek.gain;
            ay += ((food.y - b.y) / fd * want - b.vy) * B.seek.gain;
          }
        }
      }
      const calm = food ? 0.25 : 1;

      // --- neighbours ----------------------------------------------------
      let cnt = 0, avx = 0, avy = 0, cx = 0, cy = 0, sx = 0, sy = 0;
      let lead = null, leadD2 = Infinity;
      const sp0 = Math.hypot(b.vx, b.vy) || 1, hx = b.vx / sp0, hy = b.vy / sp0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const o = bs[j];
        const dx = o.x - b.x, dy = o.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= nr2 || d2 < 1e-4) continue;
        cnt++; avx += o.vx; avy += o.vy; cx += o.x; cy += o.y;
        if (d2 < sr2) {
          const d = Math.sqrt(d2), f = (1 - d / sr) / d;
          sx -= dx * f; sy -= dy * f;
        }
        if (B.formation && dx * hx + dy * hy > 20 && d2 < leadD2) { lead = o; leadD2 = d2; }
      }
      const sepK = B.maxForce * B.separation * (food ? 0.5 : 1);
      ox += sx * sepK; oy += sy * sepK;
      if (cnt) {
        ax += (avx / cnt - b.vx) * B.alignment * calm;
        ay += (avy / cnt - b.vy) * B.alignment * calm;
        ax += (cx / cnt - b.x) * B.cohesion * calm;
        ay += (cy / cnt - b.y) * B.cohesion * calm;
      }

      // --- V formation: take a slot diagonally behind the bird ahead -----
      if (lead) {
        const F = B.formation;
        const rx = lead.x - b.x, ry = lead.y - b.y;
        const side = (rx * -hy + ry * hx) > 0 ? -1 : 1; // stay on the side I'm already on
        const tx = lead.x - hx * F.back + -hy * F.side * side;
        const ty = lead.y - hy * F.back + hx * F.side * side;
        ax += (tx - b.x) * F.gain;
        ay += (ty - b.y) * F.gain;
      }

      // --- soft edges ----------------------------------------------------
      if (b.x < em) ox += ef * (em - b.x) / em;
      else if (b.x > w - em) ox -= ef * (b.x - (w - em)) / em;
      if (!B.wrapY) {
        if (b.y < top + em) oy += ef * (top + em - b.y) / em;
        else if (b.y > bot - em) oy -= ef * (b.y - (bot - em)) / em;
      }

      // --- UI avoidance --------------------------------------------------
      const uiK = FLOCK.uiForce * (food ? 0.4 : 1);
      for (let r = 0; r < rects.length; r++) {
        const R = rects[r];
        const qx = b.x < R.l ? R.l : b.x > R.r ? R.r : b.x;
        const qy = b.y < R.t ? R.t : b.y > R.b ? R.b : b.y;
        const dx = b.x - qx, dy = b.y - qy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= pad2) continue;
        if (d2 > 0.01) {
          const d = Math.sqrt(d2), f = uiK * (1 - d / pad) / d;
          ox += dx * f; oy += dy * f;
        } else {
          const dl = b.x - R.l, dr = R.r - b.x, dtp = b.y - R.t, db = R.b - b.y;
          const m = Math.min(dl, dr, dtp, db), F = FLOCK.uiForce * 1.4;
          if (m === dl) ox -= F; else if (m === dr) ox += F; else if (m === dtp) oy -= F; else oy += F;
        }
      }

      // --- cursor --------------------------------------------------------
      if (world.hasPointer) {
        const dx = b.x - world.pointerX, dy = b.y - world.pointerY;
        const d2 = dx * dx + dy * dy;
        if (d2 < cr2 && d2 > 0.01) {
          const d = Math.sqrt(d2), f = FLOCK.cursorForce * (1 - d / cr) / d;
          ox += dx * f; oy += dy * f;
        }
      }

      // --- swarm-to (search submit) overrides everything -----------------
      if (rush) {
        const dx = rush.x - b.x, dy = rush.y - b.y, d = Math.hypot(dx, dy) || 1;
        const v = 900 * motion;
        b.vx += (dx / d * v - b.vx) * Math.min(1, dt * 8);
        b.vy += (dy / d * v - b.vy) * Math.min(1, dt * 8);
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.scale = 1; b.lift = 0;
        if (Math.abs(b.vx) > 5) b.dir = Math.sign(b.vx);
        if (!B.upright) b.angle = Math.atan2(b.vy, b.vx) + (B.facing ?? 0);
        continue;
      }

      b.ix *= decay; b.iy *= decay;

      if (mode === 'hop') { this.stepHop(b, ox, oy, dt, world); continue; }
      if (mode === 'walk') { this.stepWalk(b, ox, dt, world, top, bot); continue; }

      // --- wander --------------------------------------------------------
      b.wa += (Math.random() * 2 - 1) * B.wanderJitter * sqdt;
      if (B.level) b.wa = Math.atan2(Math.sin(b.wa) * 0.4, Math.cos(b.wa)); // keep heading mostly horizontal
      ax += Math.cos(b.wa) * B.wander * calm;
      ay += Math.sin(b.wa) * B.wander * calm;

      // --- bursts --------------------------------------------------------
      if (b.burst > 0) {
        b.burst -= dt;
        ax += hx * B.maxForce * 1.5;
        ay += hy * B.maxForce * 1.5;
      } else if (B.burstChance && Math.random() < B.burstChance * dt) {
        b.burst = B.burstMs / 1000;
      }

      // --- jellyfish: steady rise + thrust on the contracting frames -----
      if (B.rise) ay -= B.rise;
      if (B.pulse) {
        const f = Math.floor(((world.time * 1000 + b.frameOffset) % cycle) / this.animal.frameMs);
        if (B.pulse.frames.includes(f)) ay -= B.pulse.thrust;
        b.vx *= Math.exp(-B.pulse.drag * dt); b.vy *= Math.exp(-B.pulse.drag * dt);
      }

      // --- level flight: damp vertical speed -----------------------------
      if (B.level) ay -= b.vy * B.level;

      ax += ox; ay += oy;

      if (mode === 'dart') {
        this.stepDart(b, ax, ay, ox, oy, dt, motion);
      } else {
        b.vx += ax * dt; b.vy += ay * dt;
        const sp = Math.hypot(b.vx, b.vy);
        const maxS = B.maxSpeed * b.speedScale * motion * (b.burst > 0 ? B.burstSpeed : food ? B.seek.speed : 1);
        const minS = B.minSpeed * b.speedScale * motion;
        if (sp > maxS) { b.vx *= maxS / sp; b.vy *= maxS / sp; }
        else if (sp < minS && sp > 1e-3) { b.vx *= minS / sp; b.vy *= minS / sp; }
      }

      b.x += (b.vx + b.ix) * dt;
      b.y += (b.vy + b.iy) * dt;
      if (B.wrapY) {
        // Jellyfish rise off the top and come back up from below.
        if (b.y < -90) { b.y = h + 70; b.py = b.y; b.x = clamp(b.x + rand(-80, 80), 40, w - 40); b.px = b.x; b.fade = 0; }
        else if (b.y > h + 120) { b.y = h + 70; b.py = b.y; }
      } else {
        b.y = clamp(b.y, -160, h + 160);
      }
      b.x = clamp(b.x, -160, w + 160);

      this.face(b, dt);
    }
  }

  face(b, dt) {
    const B = this.b;
    const tvx = b.vx + b.ix, tvy = b.vy + b.iy;
    const sp = Math.hypot(tvx, tvy);
    if (Math.abs(tvx) > 6) b.dir = tvx > 0 ? 1 : -1;
    let target;
    if (B.upright) {
      if (B.pitch) {
        // Side view: nose follows the climb/descent angle.
        target = clamp(Math.atan2(tvy, Math.abs(tvx)), -B.pitch, B.pitch) * b.dir;
      } else {
        target = clamp(tvx / (B.maxSpeed || 1), -1, 1) * B.tilt;
      }
    } else {
      if (sp < 12) return; // hovering: keep the last heading
      target = Math.atan2(tvy, tvx) + (B.facing ?? 0);
    }
    let da = target - b.angle;
    da -= Math.round(da / TAU) * TAU;
    b.angle += da * Math.min(1, dt * (B.turnRate ?? 6));
  }

  // --- dragonfly: dash, then hover ------------------------------------------
  stepDart(b, ax, ay, ox, oy, dt, motion) {
    const D = this.b.dart;
    b.timer -= dt;
    if (b.state === 0) {
      // Hover: bleed off speed, tiny jitter, still get nudged away from things.
      const k = Math.exp(-D.hoverDrag * dt);
      b.vx = b.vx * k + (ox * 0.25 + rand(-1, 1) * D.jitter) * dt;
      b.vy = b.vy * k + (oy * 0.25 + rand(-1, 1) * D.jitter) * dt;
      if (b.timer <= 0) {
        // Dash: new heading near the old one, bent away from crowding and edges.
        b.wa += rand(-1.8, 1.8);
        let dx = Math.cos(b.wa), dy = Math.sin(b.wa);
        const om = Math.hypot(ox, oy);
        if (om > 1) { dx += ox / om * Math.min(2, om / 150); dy += oy / om * Math.min(2, om / 150); }
        const dm = Math.hypot(dx, dy) || 1;
        const v = D.dashSpeed * b.speedScale * motion;
        b.vx = dx / dm * v; b.vy = dy / dm * v;
        b.wa = Math.atan2(dy, dx);
        b.state = 1; b.timer = pick(D.dashMs) / 1000;
      }
    } else {
      b.vx += ax * dt; b.vy += ay * dt;
      const sp = Math.hypot(b.vx, b.vy) || 1, v = D.dashSpeed * b.speedScale * motion;
      b.vx *= v / sp; b.vy *= v / sp;
      if (b.timer <= 0) { b.state = 0; b.timer = pick(D.hoverMs) / 1000; }
    }
  }

  // --- frog: sit, then hop in a short arc -----------------------------------
  startHop(b, ux, uy, dist, world, dur) {
    const H = this.b.hop;
    const { w, h, rects } = world;
    b.tx = null;
    // Try the wanted direction first, then rotate until the landing spot is clear.
    for (let k = 0; k < 8; k++) {
      const a = Math.atan2(uy, ux) + (k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.7);
      const tx = b.x + Math.cos(a) * dist, ty = b.y + Math.sin(a) * dist;
      if (tx < 30 || tx > w - 30 || ty < 30 || ty > h - 30) continue;
      if (insideAny(tx, ty, rects, FLOCK.uiPadding * 0.6)) continue;
      b.tx = tx; b.ty = ty;
      break;
    }
    if (b.tx == null || (b.tx === b.x && b.ty === b.y)) { b.tx = clamp(b.x - ux * dist * 0.5, 30, w - 30); b.ty = clamp(b.y - uy * dist * 0.5, 30, h - 30); }
    b.hx0 = b.x; b.hy0 = b.y;
    b.hp = 0;
    b.hopDur = dur ?? H.hopMs / 1000;
    b.state = 1;
    if (Math.abs(b.tx - b.x) > 4) b.dir = b.tx > b.x ? 1 : -1;
  }

  stepHop(b, ox, oy, dt, world) {
    const H = this.b.hop;
    if (b.state === 0) {
      b.scale = 1; b.lift = 0;
      b.angle *= 0.9;
      b.timer -= dt * world.motion;
      if (b.timer > 0) return;
      let ux, uy, dist = pick(H.dist);
      const px = world.pointerX - b.x, py = world.pointerY - b.y, pd = Math.hypot(px, py);
      if (world.hasPointer && pd > 90 && pd < 520 && Math.random() < H.towardCursor) {
        ux = px / pd; uy = py / pd; dist = Math.min(dist, pd - 70);
      } else {
        const a = rand(0, TAU), om = Math.hypot(ox, oy);
        ux = Math.cos(a); uy = Math.sin(a);
        if (om > 1) { const k = Math.min(3, om / 120); ux += ox / om * k; uy += oy / om * k; }
        const m = Math.hypot(ux, uy) || 1; ux /= m; uy /= m;
      }
      this.startHop(b, ux, uy, dist, world);
      return;
    }
    // Mid-hop: ease along the line, lift in an arc, grow slightly.
    b.hp = Math.min(1, b.hp + dt * world.motion / b.hopDur);
    const p = b.hp, e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2, s = Math.sin(Math.PI * p);
    b.x = b.hx0 + (b.tx - b.hx0) * e;
    b.y = b.hy0 + (b.ty - b.hy0) * e;
    b.lift = s * H.arc * (0.6 + 0.4 * b.depth);
    b.scale = 1 + s * H.grow;
    b.angle = (b.tx - b.hx0 > 0 ? 1 : -1) * s * 0.12;
    if (p >= 1) { b.state = 0; b.timer = pick(H.sitMs) / 1000; b.lift = 0; b.scale = 1; }
  }

  // --- crab: sideways scuttle, pause, repeat --------------------------------
  stepWalk(b, ox, dt, world, top, bot) {
    const W = this.b.walk;
    b.timer -= dt;
    let boost = 1;
    if (b.tx != null) {
      // Entering: scuttle all the way to the spawn spot first.
      b.dir = b.tx > b.x ? 1 : -1;
      b.state = 1; b.timer = 0.5; boost = 1.8;
      if (Math.abs(b.tx - b.x) < 16) { b.tx = null; b.state = 0; b.timer = pick(W.pauseMs) / 1000; }
    }
    if (b.state === 0) {
      b.vx *= Math.exp(-10 * dt);
      if (b.timer <= 0) {
        const bias = ox / 200 + rand(-1, 1);
        b.dir = bias >= 0 ? 1 : -1;
        if (b.x < 80) b.dir = 1; else if (b.x > world.w - 80) b.dir = -1;
        b.ty = clamp(b.y + rand(-50, 50), top + 30, bot - 30);
        b.tx = null;
        b.state = 1; b.timer = pick(W.walkMs) / 1000;
      }
    } else {
      // Turn around if something pushes hard the other way (edge, UI, a neighbour).
      if (b.tx == null && ox * b.dir < -260) b.dir = -b.dir;
      const v = W.speed * b.speedScale * world.motion * boost;
      b.vx += (b.dir * v - b.vx) * Math.min(1, dt * 6);
      if (b.timer <= 0) { b.state = 0; b.timer = pick(W.pauseMs) / 1000; }
    }
    const ty = b.ty ?? b.y;
    b.vy = (ty - b.y) * 1.2;
    b.x += (b.vx + b.ix) * dt;
    b.y += b.vy * dt;
    b.x = clamp(b.x, -60, world.w + 60);
    b.y = clamp(b.y, top, bot);
    b.angle = 0;
  }
}

function insideAny(x, y, rects, pad) {
  for (const r of rects) {
    if (x > r.l - pad && x < r.r + pad && y > r.t - pad && y < r.b + pad) return true;
  }
  return false;
}

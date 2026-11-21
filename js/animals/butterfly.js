// ---------------------------------------------------------------------------
// Butterfly. Tune the feel here.
// ---------------------------------------------------------------------------
const BEHAVIOR = {
  minSpeed: 16,          // px/s, never slower than this
  maxSpeed: 64,          // px/s cruising cap (scaled down for small/far ones)
  maxForce: 150,         // how hard flocking forces can steer

  // Flocking: none really. Each butterfly keeps its own patch of sky.
  spread: 0.9,           // 0 = off. ~1 = keep an even share of the screen to themselves
  neighborRadius: 130,
  separationRadius: 46,  // minimum personal space (spread usually makes it larger)
  separation: 1.2,       // push apart when closer than the separation radius
  alignment: 0,          // match neighbours' velocity (1/s)
  cohesion: 0,           // drift toward neighbours' centre (1/s²)

  // Erratic flutter.
  wander: 110,           // strength of the random heading force
  wanderJitter: 3.2,     // how quickly that heading changes

  // Short bursts of speed.
  burstChance: 0.22,     // bursts per second per butterfly
  burstMs: 320,
  burstSpeed: 2.3,       // speed multiplier during a burst

  // Vertical bob (visual only, px and Hz-ish).
  bobAmp: 4,
  bobFreq: 3.4,

  // Stay mostly upright with a slight tilt toward travel direction.
  upright: true,
  tilt: 0.22,            // radians at full speed
  turnRate: 5,
};

// Wings open → half → closed → half. Body stays on the same column so it doesn't jitter.
const OPEN = String.raw`
 .--.   .--.
(    \ /    )
 '-._ Y _.-'
 .-'  |  '-.
(____/ \____)
`;
const HALF = String.raw`
  .-.   .-.
  (  \ /  )
   '-.Y.-'
   .-'|'-.
  (__/ \__)
`;
const CLOSED = String.raw`
    |\ /|
    | Y |
     \|/
     /|\
    '/ \'
`;

export default {
  id: 'butterfly',
  label: 'Butterfly',
  latin: 'Lepidoptera',
  color: '#6b97ff',
  count: 14,
  sizeRange: [8, 14],
  frames: [OPEN, HALF, CLOSED, HALF],
  frameMs: 110,
  behavior: BEHAVIOR,
  onClick: 'scatter',
};

// ---------------------------------------------------------------------------
// Crab. Tune the feel here.
// ---------------------------------------------------------------------------
const BEHAVIOR = {
  mode: 'walk',
  minSpeed: 0,
  maxSpeed: 60,
  maxForce: 120,

  yMin: 0.6,             // live in the lower 40% of the screen
  yMax: 1,

  spread: 0.9,
  neighborRadius: 140,
  separationRadius: 70,
  separation: 1.4,
  alignment: 0,
  cohesion: 0,
  wander: 0,
  wanderJitter: 0,

  walk: {
    speed: 60,             // px/s sideways
    walkMs: [700, 2200],   // scuttle length
    pauseMs: [700, 2600],  // pauses are frequent
  },

  upright: true,
  tilt: 0,
};

const A = String.raw`
 (\/)      (\/)
   \\ .--. //
    (( oo ))
   //'----'\\
  /  /    \  \
`;
const B = String.raw`
 (\/)      (\/)
   \\ .--. //
    (( oo ))
   \\'----'//
    \ \  / /
`;

export default {
  id: 'crab',
  label: 'Crab',
  latin: 'Brachyura',
  color: '#ff6a5c',
  count: 8,
  sizeRange: [8, 13],
  frames: [A, B],
  frameMs: 120,
  // Legs only scuttle while walking.
  frameFor(b, t) {
    return b.state === 1 ? Math.floor((t * 1000 + b.frameOffset) / 120) % 2 : 0;
  },
  behavior: BEHAVIOR,
  onClick: 'scatter',
};

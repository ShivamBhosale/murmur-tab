// ---------------------------------------------------------------------------
// Dragonfly. Tune the feel here.
// ---------------------------------------------------------------------------
const BEHAVIOR = {
  mode: 'dart',
  minSpeed: 0,
  maxSpeed: 260,
  maxForce: 120,

  spread: 0.85,
  neighborRadius: 120,
  separationRadius: 70,
  separation: 1.2,
  alignment: 0,
  cohesion: 0,

  wander: 0,
  wanderJitter: 0,

  dart: {
    dashSpeed: 300,        // px/s during a dash
    dashMs: [180, 420],    // dash length
    hoverMs: [500, 1500],  // hover length between dashes
    hoverDrag: 7,          // how quickly a dash stops into a hover
    jitter: 40,            // tiny drift while hovering
  },

  // Sprite faces left (head on the left), rotates to face travel.
  upright: false,
  facing: Math.PI,
  turnRate: 14,
};

const WINGS_UP = String.raw`
 \\   //
  \\ //
==(o)=========-
  // \\
 //   \\
`;
const WINGS_FLAT = String.raw`

 ~~\\ //~~
==(o)=========-
 ~~// \\~~
`;

export default {
  id: 'dragonfly',
  label: 'Dragonfly',
  latin: 'Anisoptera',
  color: '#4fd18b',
  count: 8,
  sizeRange: [8, 13],
  frames: [WINGS_UP, WINGS_FLAT],
  frameMs: 55,
  behavior: BEHAVIOR,
  onClick: 'scatter',
};

// ---------------------------------------------------------------------------
// Crane. Tune the feel here.
// ---------------------------------------------------------------------------
const BEHAVIOR = {
  minSpeed: 26,
  maxSpeed: 52,
  maxForce: 60,

  spread: 0.4,           // low: they fly in loose groups
  neighborRadius: 220,
  separationRadius: 56,
  separation: 1.1,
  alignment: 1.1,        // strong: the group flies one way
  cohesion: 0.02,

  // Each crane takes a slot diagonally behind the bird ahead of it, which makes Vs.
  formation: {
    back: 46,            // px behind the bird ahead
    side: 34,            // px to the side
    gain: 0.9,           // how firmly they hold the slot
  },

  wander: 18,
  wanderJitter: 0.5,
  level: 1.4,            // damp vertical motion: mostly horizontal glides

  // Side-view sprite facing right: mirrored when flying left, nose follows climb.
  upright: true,
  flipX: true,
  pitch: 0.35,
  turnRate: 2.4,
};

const UP = String.raw`
      \  \
       \  \
 =------\__\---o>
`;
const LEVEL = String.raw`


 =------====---o>
       /__/
`;
const DOWN = String.raw`


 =------____---o>
       /  /
      /  /
`;

export default {
  id: 'crane',
  label: 'Crane',
  latin: 'Grus grus',
  color: '#e9e9f2',
  origColor: '#b9bcc6',  // light grey for the Devanagari line, so it stays readable
  count: 11,
  sizeRange: [10, 15],
  frames: [UP, LEVEL, DOWN, LEVEL],
  frameMs: 260,
  behavior: BEHAVIOR,
  onClick: 'scatter',
};

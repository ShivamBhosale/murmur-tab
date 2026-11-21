// ---------------------------------------------------------------------------
// Jellyfish. Tune the feel here.
// ---------------------------------------------------------------------------
const BEHAVIOR = {
  minSpeed: 4,
  maxSpeed: 34,
  maxForce: 60,

  spread: 0.8,           // keep an even share of the screen
  neighborRadius: 120,
  separationRadius: 60,
  separation: 1.0,
  alignment: 0.05,       // barely coordinate
  cohesion: 0,

  wander: 10,            // gentle sideways drift
  wanderJitter: 0.8,

  rise: 6,               // constant upward pull (px/s²)
  pulse: {
    frames: [1],         // thrust while the bell is contracted (frame 1)
    thrust: 70,          // upward push during a pulse
    drag: 1.1,           // water drag between pulses
  },
  wrapY: true,           // float off the top, reappear from below

  // Trails of fading characters left behind.
  trail: {
    every: 0.28,         // seconds between drops
    life: 1.9,           // seconds a trail character lasts
    chars: [':', '.', '.', '·'],
  },

  upright: true,
  tilt: 0.18,
  turnRate: 3,
};

const OPEN = String.raw`
   .-""-.
  /  ..  \
 (________)
   ( ) (
    ) ( )
   ( ) (
`;
const SQUEEZE = String.raw`
    .--.
   / .. \
  (______)
   ) ( )
    ( ) (
   ) ( )
`;

export default {
  id: 'jellyfish',
  label: 'Jellyfish',
  latin: 'Aurelia aurita',
  color: '#d77ae0',
  count: 9,
  sizeRange: [8, 14],
  frames: [OPEN, SQUEEZE],
  frameMs: 650,
  behavior: BEHAVIOR,
  onClick: 'scatter',
};

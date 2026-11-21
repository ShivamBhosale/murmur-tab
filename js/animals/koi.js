// ---------------------------------------------------------------------------
// Koi. Tune the feel here.
// ---------------------------------------------------------------------------
const BEHAVIOR = {
  minSpeed: 18,
  maxSpeed: 44,
  maxForce: 70,
  turnRate: 2.6,         // lower = wider, lazier turns

  // Spread evenly over the pond, loosely swimming the same way as nearby koi.
  // (For one tight school instead: spread 0, alignment 0.8, cohesion 0.1.)
  spread: 0.85,
  neighborRadius: 190,
  separationRadius: 60,
  separation: 1.1,
  alignment: 0.3,
  cohesion: 0,

  // Smooth curving paths.
  wander: 34,
  wanderJitter: 0.9,

  // Sprite faces right; mirror instead of swimming upside down when heading left.
  upright: false,
  facing: 0,
  flipY: true,

  // Feeding.
  seek: {
    radius: 650,         // koi notice food within this distance
    speed: 1.9,          // speed multiplier while chasing food
    gain: 2.2,           // how sharply they turn toward it
    eatRadius: 20,       // px from the koi's centre that counts as eaten
  },
};

// Tail sways up → centre → down → centre.
const UP = String.raw`
\      _.-~~-._
 \>=-( %%  %  o )
       ${'`'}-.__.-'
`;
const MID = String.raw`
 \     _.-~~-._
  >=-( %%  %  o )
 /     ${'`'}-.__.-'
`;
const DOWN = String.raw`
       _.-~~-._
 />=-( %%  %  o )
/      ${'`'}-.__.-'
`;

// Real koi patterns: orange with white patches, white with red (kohaku), plain gold.
const VARIANTS = [
  { color: '#ff8a5c', spots: '#f2e9e4' },
  { color: '#f2e9e4', spots: '#ff5a4a' },
  { color: '#ffc65c', spots: null },
];

export default {
  id: 'koi',
  label: 'Koi',
  latin: 'Cyprinus rubrofuscus',
  color: '#ff8a5c',
  count: 9,
  sizeRange: [9, 14],
  frames: [UP, MID, DOWN, MID],
  frameMs: 240,
  spotChar: '%',         // characters drawn in the variant's spot colour
  pickColor: i => VARIANTS[i % 5 < 2 ? 0 : i % 5 < 4 ? 1 : 2],
  behavior: BEHAVIOR,
  onClick: 'feed',
};

// ---------------------------------------------------------------------------
// Frog. Tune the feel here.
// ---------------------------------------------------------------------------
const BEHAVIOR = {
  mode: 'hop',
  minSpeed: 0,
  maxSpeed: 0,
  maxForce: 120,

  spread: 0.9,
  neighborRadius: 140,
  separationRadius: 80,
  separation: 1.4,
  alignment: 0,
  cohesion: 0,
  wander: 0,
  wanderJitter: 0,

  hop: {
    sitMs: [1400, 4500],   // time sitting still between hops
    hopMs: 460,            // hop duration
    dist: [50, 120],       // hop length (px)
    arc: 16,               // how high the arc goes (px)
    grow: 0.22,            // scale-up at the top of the hop
    towardCursor: 0.25,    // chance a hop heads for the pointer
  },

  upright: true,
  tilt: 0,
};

const SIT = String.raw`
  (o)__(o)
 (  ____  )
 ( (    ) )
__\ \__/ /__
  ^^    ^^
`;
const BLINK = String.raw`
  (-)__(-)
 (  ____  )
 ( (    ) )
__\ \__/ /__
  ^^    ^^
`;
const LEAP = String.raw`
  (o)__(o)
 (  \__/  )
 /( (  ) )\
/_/ \__/ \_\
   /    \
  ^^    ^^
`;

export default {
  id: 'frog',
  label: 'Frog',
  color: '#86dc52',
  count: 8,
  sizeRange: [8, 13],
  frames: [SIT, BLINK, LEAP],
  frameMs: 200,
  // Frames follow what the frog is doing, not a timer.
  frameFor(b, t) {
    if (b.state === 1) return 2;
    return (t + b.phase * 3) % 5 < 0.16 ? 1 : 0; // blink now and then
  },
  behavior: BEHAVIOR,
  onClick: 'scatter',
};

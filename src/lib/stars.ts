/**
 * The night sky behind the globe. Pure helpers, so the layout can be tested without a browser.
 *
 * The sky is decorative: it is a made-up scatter of stars, not a map of the real sky. It has three layers (many faint stars, some
 * medium ones, a few bright ones), a soft band of denser stars like a galaxy seen edge on, and small differences in colour. Nothing
 * moves, so it costs nothing while the globe is still and needs no special handling for reduced motion.
 */

export interface StarLayer { positions: Float32Array; colors: Float32Array; size: number; opacity: number }

/** Distance of the sky from the middle of the globe. The camera never goes past 5, so every star stays far behind it. */
export const STAR_RADIUS = 18;
export const STAR_COUNTS = { faint: 8000, medium: 2000, bright: 360 } as const;
/** Share of the faint stars pulled into the band. */
export const BAND_SHARE = 0.4;
export const STAR_SIZES = { faint: 0.032, medium: 0.05, bright: 0.085 } as const;
export const STAR_OPACITY = { faint: 0.78, medium: 0.92, bright: 1 } as const;

/** Small seeded random number generator, so every visitor sees the same sky. */
export function seededRandom(seed: number): () => number {
  let state = Math.floor(Math.abs(seed)) % 2147483647 || 1;
  return () => { state = state * 16807 % 2147483647; return (state - 1) / 2147483646; };
}

type Rgb = [number, number, number];
/** Cool blue-white, plain white and warm white, kept pale so the sky stays calm. */
const TINTS: Rgb[] = [[0.66, 0.78, 0.93], [0.92, 0.94, 0.98], [1, 0.93, 0.8]];

function randomDirection(random: () => number): Rgb {
  // Uniform on a sphere: pick the height evenly, then the angle around it.
  const y = random() * 2 - 1, angle = random() * Math.PI * 2, ring = Math.sqrt(1 - y * y);
  return [ring * Math.cos(angle), y, ring * Math.sin(angle)];
}

/** A direction near a tilted great circle (the band), spread out so it fades at the edges. */
function bandDirection(random: () => number): Rgb {
  const angle = random() * Math.PI * 2;
  const spread = (random() + random() + random() - 1.5) * 0.28; // roughly bell shaped, about +/- 0.4 radians
  const flat = [Math.cos(angle) * Math.cos(spread), Math.sin(spread), Math.sin(angle) * Math.cos(spread)];
  // Tilt the band 62 degrees about the x axis so it crosses the view at a slant.
  const tilt = 62 * Math.PI / 180, c = Math.cos(tilt), s = Math.sin(tilt);
  return [flat[0], flat[1] * c - flat[2] * s, flat[1] * s + flat[2] * c];
}

function layer(count: number, size: number, opacity: number, random: () => number, brightness: [number, number], bandShare: number): StarLayer {
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [x, y, z] = random() < bandShare ? bandDirection(random) : randomDirection(random);
    positions[i * 3] = x * STAR_RADIUS; positions[i * 3 + 1] = y * STAR_RADIUS; positions[i * 3 + 2] = z * STAR_RADIUS;
    const tint = TINTS[Math.floor(random() * TINTS.length)], level = brightness[0] + random() * (brightness[1] - brightness[0]);
    colors[i * 3] = tint[0] * level; colors[i * 3 + 1] = tint[1] * level; colors[i * 3 + 2] = tint[2] * level;
  }
  return { positions, colors, size, opacity };
}

/** Builds the three star layers, faintest first. The same seed always gives the same sky. */
export function buildStarLayers(seed = 31): StarLayer[] {
  const random = seededRandom(seed);
  return [
    layer(STAR_COUNTS.faint, STAR_SIZES.faint, STAR_OPACITY.faint, random, [0.55, 1], BAND_SHARE),
    layer(STAR_COUNTS.medium, STAR_SIZES.medium, STAR_OPACITY.medium, random, [0.8, 1], 0.2),
    layer(STAR_COUNTS.bright, STAR_SIZES.bright, STAR_OPACITY.bright, random, [0.9, 1], 0),
  ];
}

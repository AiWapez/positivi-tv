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
export const STAR_SIZES = { faint: 0.032, medium: 0.05, bright: 0.085, brilliant: 0.13, belt: 0.17 } as const;
export const STAR_OPACITY = { faint: 0.78, medium: 0.92, bright: 1, brilliant: 1 } as const;
/** A few stars that stand out clearly from the rest, like the brightest stars in a real sky. */
export const BRILLIANT_COUNT = 24;

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
export function buildStarLayers(seed = 31, view?: SkyView): StarLayer[] {
  const random = seededRandom(seed);
  const brilliant = layer(BRILLIANT_COUNT, STAR_SIZES.brilliant, STAR_OPACITY.brilliant, random, [0.95, 1], 0);
  return [
    layer(STAR_COUNTS.faint, STAR_SIZES.faint, STAR_OPACITY.faint, random, [0.55, 1], BAND_SHARE),
    layer(STAR_COUNTS.medium, STAR_SIZES.medium, STAR_OPACITY.medium, random, [0.8, 1], 0.2),
    layer(STAR_COUNTS.bright, STAR_SIZES.bright, STAR_OPACITY.bright, random, [0.9, 1], 0),
    brilliant,
    ...(view ? [beltLayer(view)] : []),
  ];
}

/**
 * Orion's belt: Alnitak, Alnilam and Mintaka, from their published positions (J2000, right ascension and declination in degrees).
 * The shape and the proportions are real. The sky around it is made up, so the belt is turned to sit where it can be seen from the
 * opening view, and it is drawn 2.6 times wider than life so the three stars read as a line on a phone.
 */
export const ORION_BELT = [
  { name: 'Alnitak', ra: 84.0533, dec: -1.9426 },
  { name: 'Alnilam', ra: 83.0017, dec: -1.2019 },
  { name: 'Mintaka', ra: 82.0013, dec: -0.2991 },
] as const;
export const BELT_SCALE = 2.6;
/** Turns the line of the belt about the direction it is seen in, so it runs along the edge of the globe rather than towards it. */
export const BELT_ROLL_DEGREES = -67;
/** Where the belt appears from the opening view, in degrees right of centre and above centre (negative is left or below). Outside the disc of the globe. */
export const BELT_APPEARANCE = { right: -16, up: 12 } as const;
export interface SkyView { /** Direction the camera looks along at the opening view. */ direction: Rgb; /** Which way is up on screen. */ up: Rgb }

const dot = (a: Rgb, b: Rgb) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Rgb, b: Rgb): Rgb => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Rgb): Rgb => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const rad = (d: number) => d * Math.PI / 180;

function equatorial(ra: number, dec: number): Rgb { return [Math.cos(rad(dec)) * Math.cos(rad(ra)), Math.cos(rad(dec)) * Math.sin(rad(ra)), Math.sin(rad(dec))]; }

/** Rotates v about the unit axis by the angle (Rodrigues). */
function rotate(v: Rgb, axis: Rgb, angle: number): Rgb {
  const c = Math.cos(angle), s = Math.sin(angle), k = cross(axis, v), d = dot(axis, v) * (1 - c);
  return [v[0] * c + k[0] * s + axis[0] * d, v[1] * c + k[1] * s + axis[1] * d, v[2] * c + k[2] * s + axis[2] * d];
}

/** Unit directions of the three belt stars, turned and widened as described above. Pure, so the shape can be tested. */
export function beltDirections(view: SkyView): Rgb[] {
  const forward = unit(view.direction), right = unit(cross(forward, view.up)), upward = cross(right, forward);
  // Where on the sky the middle of the belt should sit. Stars are far behind the globe, so this is the direction from the sky's centre.
  // The camera sits 3.45 in front of the centre and the sky is 18 behind it, so an apparent angle needs the camera distance in the sum.
  const lateral = (STAR_RADIUS + 3.45) * Math.tan(rad(BELT_APPEARANCE.right)), vertical = (STAR_RADIUS + 3.45) * Math.tan(rad(BELT_APPEARANCE.up));
  const target = unit([forward[0] * STAR_RADIUS + right[0] * lateral + upward[0] * vertical, forward[1] * STAR_RADIUS + right[1] * lateral + upward[1] * vertical, forward[2] * STAR_RADIUS + right[2] * lateral + upward[2] * vertical]);
  const real = ORION_BELT.map(star => equatorial(star.ra, star.dec));
  const centre = unit([real[0][0] + real[1][0] + real[2][0], real[0][1] + real[1][1] + real[2][1], real[0][2] + real[1][2] + real[2][2]]);
  // Widen about the middle (in the plane at the middle), then bring the middle onto the target.
  const widened = real.map(v => unit([centre[0] + (v[0] - centre[0]) * BELT_SCALE, centre[1] + (v[1] - centre[1]) * BELT_SCALE, centre[2] + (v[2] - centre[2]) * BELT_SCALE]));
  const axis = cross(centre, target), length = Math.hypot(axis[0], axis[1], axis[2]);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(centre, target))));
  const turned = length < 1e-9 ? widened : widened.map(v => rotate(v, [axis[0] / length, axis[1] / length, axis[2] / length], angle));
  // Tilt the line of the belt so it runs on a slant across the corner rather than straight up the edge.
  return turned.map(v => rotate(v, target, rad(BELT_ROLL_DEGREES)));
}

/** The belt as its own layer of three large, slightly blue-white stars, so the line of three reads clearly. */
function beltLayer(view: SkyView): StarLayer {
  const belt = beltDirections(view), positions = new Float32Array(belt.length * 3), colors = new Float32Array(belt.length * 3);
  belt.forEach((v, i) => { positions.set([v[0] * STAR_RADIUS, v[1] * STAR_RADIUS, v[2] * STAR_RADIUS], i * 3); colors.set([0.82, 0.9, 1], i * 3); });
  return { positions, colors, size: STAR_SIZES.belt, opacity: 1 };
}

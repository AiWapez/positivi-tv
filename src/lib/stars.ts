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
export const STAR_SIZES = { faint: 0.032, medium: 0.05, bright: 0.085, brilliant: 0.13 } as const;
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
    ...(view ? orionLayers(view) : []),
  ];
}

/**
 * Orion: the three belt stars (Alnitak, Alnilam, Mintaka) and the four corners of the hourglass (Betelgeuse and Bellatrix on top,
 * Saiph and Rigel at the bottom), from their published positions (J2000, right ascension and declination in degrees). The shape and the
 * proportions are real. The sky around it is made up, so the figure is turned to sit where it can be seen from the opening view, and it
 * is drawn a little smaller than life (the real figure is about 18 degrees tall, more than fits beside the globe).
 * `size` is the dot size (bigger is brighter) and `color` its tint: Betelgeuse is orange, the others blue-white.
 */
export const ORION = [
  { name: 'Alnitak', ra: 84.0533, dec: -1.9426, size: 0.14, color: [0.82, 0.9, 1] },
  { name: 'Alnilam', ra: 83.0017, dec: -1.2019, size: 0.14, color: [0.82, 0.9, 1] },
  { name: 'Mintaka', ra: 82.0013, dec: -0.2991, size: 0.14, color: [0.82, 0.9, 1] },
  { name: 'Betelgeuse', ra: 88.7929, dec: 7.4071, size: 0.2, color: [1, 0.72, 0.45] },
  { name: 'Bellatrix', ra: 81.2828, dec: 6.3497, size: 0.17, color: [0.82, 0.9, 1] },
  { name: 'Rigel', ra: 78.6345, dec: -8.2016, size: 0.22, color: [0.8, 0.9, 1] },
  { name: 'Saiph', ra: 86.9391, dec: -9.6697, size: 0.17, color: [0.82, 0.9, 1] },
] as const;
/** The first three entries of ORION are the belt. */
export const BELT_STARS = 3;
export const ORION_SCALE = 0.45;
/** Turns the figure about the direction it is seen in, so it stands along the edge of the globe. */
export const ORION_ROLL_DEGREES = 170;
/** Where the middle of the belt appears from the opening view, in degrees right of centre and above centre (negative is left or below). */
export const ORION_APPEARANCE = { right: -15, up: 15 } as const;
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

export interface OrionOptions { scale?: number; roll?: number; right?: number; up?: number }

/** Unit directions of the seven Orion stars, in the order of ORION, widened, turned and placed as described above. Pure, so the shape can be tested. */
export function orionDirections(view: SkyView, options: OrionOptions = {}): Rgb[] {
  const scale = options.scale ?? ORION_SCALE, roll = options.roll ?? ORION_ROLL_DEGREES, appearRight = options.right ?? ORION_APPEARANCE.right, appearUp = options.up ?? ORION_APPEARANCE.up;
  const forward = unit(view.direction), right = unit(cross(forward, view.up)), upward = cross(right, forward);
  // The camera sits 3.45 in front of the sky's centre and the sky is 18 behind it, so an apparent angle needs both distances in the sum.
  const lateral = (STAR_RADIUS + 3.45) * Math.tan(rad(appearRight)), vertical = (STAR_RADIUS + 3.45) * Math.tan(rad(appearUp));
  const target = unit([forward[0] * STAR_RADIUS + right[0] * lateral + upward[0] * vertical, forward[1] * STAR_RADIUS + right[1] * lateral + upward[1] * vertical, forward[2] * STAR_RADIUS + right[2] * lateral + upward[2] * vertical]);
  const real = ORION.map(star => equatorial(star.ra, star.dec)), belt = real.slice(0, BELT_STARS);
  const centre = unit([belt[0][0] + belt[1][0] + belt[2][0], belt[0][1] + belt[1][1] + belt[2][1], belt[0][2] + belt[1][2] + belt[2][2]]);
  const resized = real.map(v => unit([centre[0] + (v[0] - centre[0]) * scale, centre[1] + (v[1] - centre[1]) * scale, centre[2] + (v[2] - centre[2]) * scale]));
  const axis = cross(centre, target), length = Math.hypot(axis[0], axis[1], axis[2]);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(centre, target))));
  const turned = length < 1e-9 ? resized : resized.map(v => rotate(v, [axis[0] / length, axis[1] / length, axis[2] / length], angle));
  return turned.map(v => rotate(v, target, rad(roll)));
}

/** Orion as one small layer per dot size (a Points object has one size), each star keeping its own tint. */
function orionLayers(view: SkyView): StarLayer[] {
  const directions = orionDirections(view), sizes = [...new Set(ORION.map(star => star.size))].sort((a, b) => a - b);
  return sizes.map(size => {
    const stars = ORION.map((star, i) => ({ star, v: directions[i] })).filter(entry => entry.star.size === size);
    const positions = new Float32Array(stars.length * 3), colors = new Float32Array(stars.length * 3);
    stars.forEach(({ star, v }, i) => { positions.set([v[0] * STAR_RADIUS, v[1] * STAR_RADIUS, v[2] * STAR_RADIUS], i * 3); colors.set(star.color, i * 3); });
    return { positions, colors, size, opacity: 1 };
  });
}

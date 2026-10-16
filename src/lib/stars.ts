import { FIGURES } from './constellations.ts';
export { FIGURES } from './constellations.ts';
export type { Figure, FigureStar } from './constellations.ts';

/**
 * The night sky behind the globe. Pure helpers, so the layout can be tested without a browser.
 *
 * The scatter of stars is decorative and made up, not a map of the real sky. It has three layers (many faint stars, some medium ones,
 * a few bright ones), a soft band of denser stars like a galaxy seen edge on, and small differences in colour. On top of it sit eleven
 * real constellations (see constellations.ts), drawn from the published positions of their stars. Nothing moves, so it costs nothing
 * while the globe is still and needs no special handling for reduced motion.
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

/** Builds the star layers, faintest first: the scatter, then (when the opening view is given) the constellations. The same seed always gives the same sky. */
export function buildStarLayers(seed = 31, view?: SkyView): StarLayer[] {
  const random = seededRandom(seed);
  const brilliant = layer(BRILLIANT_COUNT, STAR_SIZES.brilliant, STAR_OPACITY.brilliant, random, [0.95, 1], 0);
  return [
    layer(STAR_COUNTS.faint, STAR_SIZES.faint, STAR_OPACITY.faint, random, [0.55, 1], BAND_SHARE),
    layer(STAR_COUNTS.medium, STAR_SIZES.medium, STAR_OPACITY.medium, random, [0.8, 1], 0.2),
    layer(STAR_COUNTS.bright, STAR_SIZES.bright, STAR_OPACITY.bright, random, [0.9, 1], 0),
    brilliant,
    ...(view ? figureLayers(view) : []),
  ];
}

/**
 * Orion is the first figure: the three belt stars (Alnitak, Alnilam, Mintaka) and the four corners of the hourglass (Betelgeuse and
 * Bellatrix on top, Saiph and Rigel at the bottom). The positions are the real ones (see constellations.ts). The shape and the proportions
 * are real. The sky around it is made up, so the figure is turned to sit where it can be seen from the opening view, and it is drawn a
 * little smaller than life (the real figure is about 18 degrees tall, more than fits beside the globe).
 * `size` is the dot size (bigger is brighter) and `color` its tint: Betelgeuse is orange, the others blue-white.
 *
 * The other constellations are placed by the same turn that places Orion, so they keep their real places in the sky relative to Orion and
 * to each other, and each one is scaled about its own middle (see `scale` in constellations.ts) so that all of them look about the same size.
 */
export const ORION = FIGURES[0].stars;
/** The first three entries of ORION are the belt. */
export const BELT_STARS = 3;
export const ORION_SCALE = FIGURES[0].scale;
/** Turns the figure about the direction it is seen in, so it stands along the edge of the globe. */
export const ORION_ROLL_DEGREES = 170;
/**
 * Where the middle of the belt appears from the opening view, in degrees right of centre and above centre (negative is left or below).
 * These were -15 and 15 before Orion's belt stars were moved to their catalogued positions (they had been about a degree off). That move
 * brought Rigel within 0.6 degrees of the globe's edge during the flight to a story, so the whole sky was nudged 0.4 degrees out.
 */
export const ORION_APPEARANCE = { right: -15.3, up: 15.3 } as const;
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

/** The middle of a figure on the real sky: the average direction of its first `anchor` stars (all of them when it has no anchor). */
function figureCentre(figure: typeof FIGURES[number]): Rgb {
  const real = figure.stars.slice(0, figure.anchor ?? figure.stars.length).map(star => equatorial(star.ra, star.dec));
  return unit(real.reduce<Rgb>((sum, v) => [sum[0] + v[0], sum[1] + v[1], sum[2] + v[2]], [0, 0, 0]));
}

/**
 * The one turn that carries the real sky to where it is drawn: Orion's belt goes to its place beside the globe at the opening view, then
 * everything is rolled about that direction. Every figure goes through the same turn, so the figures keep their real places relative to Orion.
 */
function skyTurn(view: SkyView, options: OrionOptions = {}): (v: Rgb) => Rgb {
  const roll = options.roll ?? ORION_ROLL_DEGREES, appearRight = options.right ?? ORION_APPEARANCE.right, appearUp = options.up ?? ORION_APPEARANCE.up;
  const forward = unit(view.direction), right = unit(cross(forward, view.up)), upward = cross(right, forward);
  // The camera sits 3.45 in front of the sky's centre and the sky is 18 behind it, so an apparent angle needs both distances in the sum.
  const lateral = (STAR_RADIUS + 3.45) * Math.tan(rad(appearRight)), vertical = (STAR_RADIUS + 3.45) * Math.tan(rad(appearUp));
  const target = unit([forward[0] * STAR_RADIUS + right[0] * lateral + upward[0] * vertical, forward[1] * STAR_RADIUS + right[1] * lateral + upward[1] * vertical, forward[2] * STAR_RADIUS + right[2] * lateral + upward[2] * vertical]);
  const centre = figureCentre(FIGURES[0]);
  const axis = cross(centre, target), length = Math.hypot(axis[0], axis[1], axis[2]);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(centre, target))));
  const axisUnit: Rgb = length < 1e-9 ? [0, 0, 1] : [axis[0] / length, axis[1] / length, axis[2] / length];
  return v => rotate(length < 1e-9 ? v : rotate(v, axisUnit, angle), target, rad(roll));
}

/** Unit directions of one figure's stars, in the order of its list: scaled about its own middle, then turned. */
function figureDirections(figure: typeof FIGURES[number], turn: (v: Rgb) => Rgb, scale = figure.scale): Rgb[] {
  const centre = figureCentre(figure);
  return figure.stars.map(star => {
    const v = equatorial(star.ra, star.dec);
    return turn(unit([centre[0] + (v[0] - centre[0]) * scale, centre[1] + (v[1] - centre[1]) * scale, centre[2] + (v[2] - centre[2]) * scale]));
  });
}

/** Unit directions of the seven Orion stars, in the order of ORION, widened, turned and placed as described above. Pure, so the shape can be tested. */
export function orionDirections(view: SkyView, options: OrionOptions = {}): Rgb[] {
  return figureDirections(FIGURES[0], skyTurn(view, options), options.scale ?? ORION_SCALE);
}

/** Unit directions of the stars of every figure, one list per figure, in the order of FIGURES (Orion first). */
export function figureSky(view: SkyView): Rgb[][] {
  const turn = skyTurn(view);
  return FIGURES.map(figure => figureDirections(figure, turn));
}

/** All the constellation stars as one small layer per dot size (a Points object has one size), each star keeping its own tint. */
function figureLayers(view: SkyView): StarLayer[] {
  const sky = figureSky(view), entries = FIGURES.flatMap((figure, f) => figure.stars.map((star, i) => ({ star, v: sky[f][i] })));
  const sizes = [...new Set(entries.map(entry => entry.star.size))].sort((a, b) => a - b);
  return sizes.map(size => {
    const stars = entries.filter(entry => entry.star.size === size);
    const positions = new Float32Array(stars.length * 3), colors = new Float32Array(stars.length * 3);
    stars.forEach(({ star, v }, i) => { positions.set([v[0] * STAR_RADIUS, v[1] * STAR_RADIUS, v[2] * STAR_RADIUS], i * 3); colors.set(star.color, i * 3); });
    return { positions, colors, size, opacity: 1 };
  });
}

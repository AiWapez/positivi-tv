/**
 * Made-up satellites that drift around the globe for atmosphere. They are NOT real objects: they have no names, no
 * data source and no link to any real orbit, and they move far faster than real satellites so the motion is visible.
 * The orbits come from a fixed seed, so everyone sees the same ones. Nothing is fetched.
 */
export const SATELLITE_COUNT = 14;
export const SATELLITE_MIN_RADIUS = 1.07;
export const SATELLITE_MAX_RADIUS = 1.24;
export const SATELLITE_MIN_PERIOD_SECONDS = 150;
export const SATELLITE_MAX_PERIOD_SECONDS = 420;

export interface DecorativeOrbit { radius: number; inclination: number; node: number; phase: number; period: number }

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (state + 0x6D2B79F5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Radians for angles, seconds for the period. Inclination runs from near the equator to over the poles. */
export function decorativeOrbits(seed = 77, count = SATELLITE_COUNT): DecorativeOrbit[] {
  const random = seededRandom(seed), orbits: DecorativeOrbit[] = [];
  for (let n = 0; n < count; n++) {
    orbits.push({
      radius: SATELLITE_MIN_RADIUS + random() * (SATELLITE_MAX_RADIUS - SATELLITE_MIN_RADIUS),
      inclination: (0.1 + random() * 1.4) * (random() < 0.5 ? 1 : -1) + (random() < 0.15 ? Math.PI * 0.35 : 0),
      node: random() * Math.PI * 2,
      phase: random() * Math.PI * 2,
      period: SATELLITE_MIN_PERIOD_SECONDS + random() * (SATELLITE_MAX_PERIOD_SECONDS - SATELLITE_MIN_PERIOD_SECONDS),
    });
  }
  return orbits;
}

/** Position of one drifting dot after `seconds`, in the globe's own units (the Earth has radius 1). */
export function satellitePosition(orbit: DecorativeOrbit, seconds: number): [number, number, number] {
  const angle = orbit.phase + (seconds / orbit.period) * Math.PI * 2;
  const flatX = Math.cos(angle), flatZ = Math.sin(angle);
  // Tilt the circle about the X axis, then turn it about the vertical axis.
  const tiltedY = flatZ * Math.sin(orbit.inclination), tiltedZ = flatZ * Math.cos(orbit.inclination);
  const x = flatX * Math.cos(orbit.node) + tiltedZ * Math.sin(orbit.node), z = -flatX * Math.sin(orbit.node) + tiltedZ * Math.cos(orbit.node);
  return [x * orbit.radius, tiltedY * orbit.radius, z * orbit.radius];
}

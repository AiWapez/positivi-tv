/**
 * Country borders for the globe. Pure helpers, so they can be tested without a browser.
 *
 * The data file (public/assets/borders.json) is built by scripts/build-borders.mjs from Natural Earth (public domain).
 * Every number in it is an integer in hundredths of a degree. Each line starts with its first longitude and latitude, and
 * every later point is the change from the point before it.
 */

export interface BorderFile { precision: number; lines: number[][] }
/** A border line as [latitude, longitude] pairs in degrees. */
export type BorderLine = Array<[number, number]>;

export const BORDERS_URL = '/assets/borders.json';
/** Longest stretch of a border drawn as one straight piece. Longer stretches are split so they follow the curve of the globe. */
export const MAX_SEGMENT_DEGREES = 1.5;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Turns the data file into lines of [latitude, longitude] pairs. Anything unusable is skipped, so a damaged file draws nothing instead of breaking the globe. */
export function decodeBorders(file: unknown): BorderLine[] {
  const data = file as Partial<BorderFile> | null;
  if (!data || !finite(data.precision) || data.precision <= 0 || !Array.isArray(data.lines)) return [];
  const lines: BorderLine[] = [];
  for (const encoded of data.lines) {
    if (!Array.isArray(encoded) || encoded.length < 4 || encoded.length % 2 !== 0 || !encoded.every(finite)) continue;
    let lng = encoded[0], lat = encoded[1];
    const line: BorderLine = [[lat / data.precision, lng / data.precision]];
    for (let i = 2; i < encoded.length; i += 2) { lng += encoded[i]; lat += encoded[i + 1]; line.push([lat / data.precision, lng / data.precision]); }
    if (line.every(([a, o]) => a >= -90 && a <= 90 && o >= -180 && o <= 180)) lines.push(line);
  }
  return lines;
}

/** Where a latitude and longitude sit on the globe. This must match the pins, which use the same convention. */
export function toVector(lat: number, lng: number, radius = 1): [number, number, number] {
  const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
  return [-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta)];
}

/**
 * Pairs of points for a line-segment drawing: every border piece becomes start and end points on a sphere of the given radius,
 * with long pieces split along the great circle so they do not cut through the globe.
 */
export function borderSegments(lines: BorderLine[], radius = 1.002, maxStepDegrees = MAX_SEGMENT_DEGREES): Float32Array {
  const out: number[] = [];
  const step = maxStepDegrees * Math.PI / 180;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = toVector(line[i - 1][0], line[i - 1][1], 1), b = toVector(line[i][0], line[i][1], 1);
      const angle = Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))), parts = Math.max(1, Math.ceil(angle / step));
      let previous = a;
      for (let part = 1; part <= parts; part++) {
        let next = b;
        if (part < parts) {
          const t = part / parts, sine = Math.sin(angle), from = Math.sin((1 - t) * angle) / sine, to = Math.sin(t * angle) / sine;
          next = [from * a[0] + to * b[0], from * a[1] + to * b[1], from * a[2] + to * b[2]];
        }
        out.push(previous[0] * radius, previous[1] * radius, previous[2] * radius, next[0] * radius, next[1] * radius, next[2] * radius);
        previous = next;
      }
    }
  }
  return Float32Array.from(out);
}

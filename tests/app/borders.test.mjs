import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { decodeBorders, toVector, borderSegments, BORDERS_URL, MAX_SEGMENT_DEGREES } from '../../src/lib/borders.ts';
import {
  BORDERS_LOAD_DISTANCE, BORDERS_FADE_START, BORDERS_FULL_DISTANCE, BORDERS_MAX_OPACITY, MIN_ZOOM_DISTANCE, SHARP_EARTH_DISTANCE, bordersOpacity, shouldLoadBorders,
} from '../../src/lib/globe-detail.ts';
import { START_DISTANCE } from '../../src/lib/globe-touch.ts';

const norm = (v) => Math.hypot(v[0], v[1], v[2]);

test('decoding turns hundredths of degrees and step changes into latitude and longitude', () => {
  // First point 10.00 E, 20.00 N; then +1.00 E +0.50 N; then -0.25 E +0.25 N.
  const lines = decodeBorders({ precision: 100, lines: [[1000, 2000, 100, 50, -25, 25]] });
  assert.deepEqual(lines, [[[20, 10], [20.5, 11], [20.75, 10.75]]]);
});

test('damaged or unusable data draws nothing instead of failing', () => {
  assert.deepEqual(decodeBorders(null), []);
  assert.deepEqual(decodeBorders({}), []);
  assert.deepEqual(decodeBorders({ precision: 0, lines: [[0, 0, 1, 1]] }), []);
  assert.deepEqual(decodeBorders({ precision: 100, lines: 'nope' }), []);
  assert.deepEqual(decodeBorders({ precision: 100, lines: [[1, 2], [1, 2, 3], [1, 2, NaN, 4], 'x', [0, 0, 1, 1]] }), [[[0, 0], [0.01, 0.01]]]);
  assert.deepEqual(decodeBorders({ precision: 100, lines: [[0, 9500, 0, 100]] }), [], 'latitudes past the pole are rejected');
});

test('points are placed on the globe the same way the pins are', () => {
  // The pins use phi = (90 - lat), theta = (lng + 180): the point at 0N 0E is on the +x axis, the north pole is +y, 0N 90E is -z... checked below.
  const close = (a, b) => assert.ok(a.every((value, i) => Math.abs(value - b[i]) < 1e-9), `${a} vs ${b}`);
  close(toVector(0, 0), [1, 0, 0]);
  close(toVector(90, 0), [0, 1, 0]);
  close(toVector(-90, 0), [0, -1, 0]);
  close(toVector(0, 90), [0, 0, -1]);
  close(toVector(0, -90), [0, 0, 1]);
  assert.ok(Math.abs(norm(toVector(33, -71, 1.002)) - 1.002) < 1e-9);
});

test('border pieces are drawn as start and end points sitting just above the surface', () => {
  const positions = borderSegments([[[10, 10], [10.5, 10.5]]], 1.002);
  assert.equal(positions.length, 6, 'one short piece is one segment of two points');
  for (let i = 0; i < positions.length; i += 3) assert.ok(Math.abs(norm(positions.slice(i, i + 3)) - 1.002) < 1e-5);
});

test('a long straight border is split along the globe so it never cuts through it', () => {
  // The US and Canada share a stretch along 49N that can be many degrees long.
  const positions = borderSegments([[[49, -123], [49, -95]]], 1.002);
  const segments = positions.length / 6;
  // 28 degrees of longitude at 49N is about 18.4 degrees of real distance, so at 1.5 degrees a piece that needs 13 pieces.
  assert.equal(segments, 13, `expected 13 pieces, got ${segments}`);
  let lowest = Infinity;
  for (let i = 0; i < positions.length; i += 3) lowest = Math.min(lowest, norm(positions.slice(i, i + 3)));
  assert.ok(lowest > 1.0019, 'every point stays on the sphere of radius 1.002');
  // Each segment spans no more than the step (plus rounding).
  for (let s = 0; s < segments; s++) {
    const a = positions.slice(s * 6, s * 6 + 3), b = positions.slice(s * 6 + 3, s * 6 + 6);
    const angle = Math.acos(Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (norm(a) * norm(b)))) * 180 / Math.PI;
    assert.ok(angle <= MAX_SEGMENT_DEGREES + 1e-3, `segment ${s} spans ${angle} degrees`);
  }
});

test('repeated points and single points make no segments', () => {
  assert.equal(borderSegments([[[5, 5]]]).length, 0);
  assert.equal(borderSegments([]).length, 0);
  assert.equal(borderSegments([[[5, 5], [5, 5]]]).length, 6, 'a zero-length piece is kept as one tiny segment rather than dividing by zero');
  assert.ok(borderSegments([[[5, 5], [5, 5]]]).every(Number.isFinite));
});

test('borders are fetched only after a deliberate zoom, and only once', () => {
  assert.equal(shouldLoadBorders({ distance: BORDERS_LOAD_DISTANCE, requested: false }), true);
  assert.equal(shouldLoadBorders({ distance: MIN_ZOOM_DISTANCE, requested: false }), true);
  assert.equal(shouldLoadBorders({ distance: 2, requested: true }), false);
  assert.equal(shouldLoadBorders({ distance: NaN, requested: false }), false);
  for (const distance of [START_DISTANCE.default, START_DISTANCE.phone, 3.05]) {
    assert.equal(shouldLoadBorders({ distance, requested: false }), false, `no fetch at ${distance}: page load, a story flight or the reset view`);
  }
});

test('borders fade in smoothly as the reader zooms and never turn fully opaque', () => {
  assert.equal(bordersOpacity(5), 0);
  assert.equal(bordersOpacity(START_DISTANCE.default), 0);
  assert.equal(bordersOpacity(3.05), 0, 'flying to a story shows no borders');
  assert.equal(bordersOpacity(BORDERS_FADE_START), 0);
  assert.equal(bordersOpacity(BORDERS_FULL_DISTANCE), BORDERS_MAX_OPACITY);
  assert.equal(bordersOpacity(MIN_ZOOM_DISTANCE), BORDERS_MAX_OPACITY);
  assert.ok(BORDERS_MAX_OPACITY < 1);
  let last = -1;
  for (let distance = BORDERS_FADE_START; distance >= BORDERS_FULL_DISTANCE; distance -= 0.05) { const value = bordersOpacity(distance); assert.ok(value >= last); last = value; }
  assert.equal(bordersOpacity(NaN), 0);
  assert.ok(BORDERS_LOAD_DISTANCE >= BORDERS_FADE_START, 'the file is requested no later than the moment the borders begin to show');
  assert.ok(SHARP_EARTH_DISTANCE <= BORDERS_FADE_START, 'borders begin to show before the sharp picture is needed');
});

const file = new URL('../../public/assets/borders.json', import.meta.url);
const decoded = () => decodeBorders(JSON.parse(readFileSync(file, 'utf8')));

test('the shipped borders file decodes into real borders and stays small', () => {
  assert.equal(BORDERS_URL, '/assets/borders.json');
  const lines = decoded();
  assert.ok(lines.length > 150, `lines: ${lines.length}`);
  const points = lines.reduce((sum, line) => sum + line.length, 0);
  assert.ok(points > 10000 && points < 60000, `points: ${points}`);
  assert.ok(statSync(file).size < 250 * 1024, 'borders.json should stay under 250 KB');
});

test('well-known borders are where they belong', () => {
  const near = (lat, lng, within = 0.6) => decoded().some(line => line.some(([a, o]) => Math.abs(a - lat) < within && Math.abs(o - lng) < within));
  assert.ok(near(49, -100), 'the United States and Canada along 49N');
  assert.ok(near(42.7, 0.5), 'France and Spain in the Pyrenees');
  assert.ok(near(-1.5, 30.0, 1), 'Rwanda and Tanzania or Uganda in East Africa');
  assert.ok(near(30, 35, 1.5), 'Israel, Jordan and Egypt');
  assert.ok(near(-54.5, -68.5, 1), 'Argentina and Chile at Tierra del Fuego');
  assert.ok(!near(0, -30, 3), 'nothing in the middle of the Atlantic Ocean');
});

test('the committed borders file is exactly what the build script produces from its Natural Earth source', () => {
  const out = execFileSync(process.execPath, ['scripts/build-borders.mjs', '--check'], { cwd: new URL('../../', import.meta.url), encoding: 'utf8' });
  assert.match(out, /matches the data it is built from/);
});

test('the asset notes and the About panel credit the border data', () => {
  const notes = readFileSync(new URL('../../public/ASSETS.md', import.meta.url), 'utf8');
  assert.match(notes, /borders\.json/); assert.match(notes, /Natural Earth/); assert.match(notes, /public domain/);
  const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /Country borders: Natural Earth/);
});

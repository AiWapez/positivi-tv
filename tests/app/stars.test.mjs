import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStarLayers, beltDirections, seededRandom, STAR_COUNTS, STAR_RADIUS, STAR_SIZES, STAR_OPACITY, BRILLIANT_COUNT, BELT_SCALE, BELT_APPEARANCE, ORION_BELT } from '../../src/lib/stars.ts';
import { MAX_ZOOM_DISTANCE } from '../../src/lib/globe-detail.ts';

const FORWARD = (() => { const phi = 70 * Math.PI / 180, theta = 185 * Math.PI / 180, v = [-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)]; return v.map(x => -x); })();
const VIEW = { direction: FORWARD, up: [0, 1, 0] };
const angleBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180 / Math.PI;

test('the sky has four layers with the promised star counts, faintest first, and a few brilliant stars', () => {
  const layers = buildStarLayers();
  assert.deepEqual(layers.map(l => l.positions.length / 3), [STAR_COUNTS.faint, STAR_COUNTS.medium, STAR_COUNTS.bright, BRILLIANT_COUNT]);
  assert.deepEqual(layers.map(l => l.size), [STAR_SIZES.faint, STAR_SIZES.medium, STAR_SIZES.bright, STAR_SIZES.brilliant]);
  assert.deepEqual(layers.map(l => l.opacity), [STAR_OPACITY.faint, STAR_OPACITY.medium, STAR_OPACITY.bright, STAR_OPACITY.brilliant]);
  assert.ok(layers[0].size < layers[1].size && layers[1].size < layers[2].size && layers[2].size < layers[3].size, 'brighter layers have bigger stars');
  assert.ok(BRILLIANT_COUNT <= 40, 'brilliant stars stay rare');
});

test("Orion's belt is its own layer of three stars, the biggest in the sky, only when an opening view is given", () => {
  assert.equal(buildStarLayers(31).length, 4);
  const layers = buildStarLayers(31, VIEW);
  assert.equal(layers.length, 5);
  assert.equal(layers[4].positions.length / 3, 3);
  assert.equal(layers[4].size, STAR_SIZES.belt);
  assert.ok(STAR_SIZES.belt > STAR_SIZES.brilliant);
});

test("Orion's belt keeps the real shape: three stars in an even line, about 3 times wider than life", () => {
  const [a, b, c] = beltDirections(VIEW);
  const realAB = Math.hypot(ORION_BELT[0].ra - ORION_BELT[1].ra, ORION_BELT[0].dec - ORION_BELT[1].dec); // roughly 1.3 degrees on the sky
  const ab = angleBetween(a, b), bc = angleBetween(b, c), ac = angleBetween(a, c);
  assert.ok(Math.abs(ab - 1.35 * BELT_SCALE) < 0.35, `Alnitak to Alnilam ${ab}`);
  assert.ok(Math.abs(bc - 1.42 * BELT_SCALE) < 0.35, `Alnilam to Mintaka ${bc}`);
  assert.ok(Math.abs(ab + bc - ac) < 0.1, 'the three stars lie on one line');
  assert.ok(realAB > 0);
});

test("Orion's belt shows in the upper left, beside the globe of the opening view, outside the globe's disc, on the sky sphere", () => {
  const forward = FORWARD, camera = forward.map(x => -x * 3.45), upHint = [0, 1, 0];
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]], norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const right = norm(cross(forward, upHint)), up = cross(right, forward);
  const stars = beltDirections(VIEW).map(v => v.map(x => x * STAR_RADIUS));
  let sumX = 0, sumY = 0;
  for (const star of stars) {
    const toStar = star.map((x, i) => x - camera[i]), depth = toStar[0] * forward[0] + toStar[1] * forward[1] + toStar[2] * forward[2];
    sumX += Math.atan2(toStar[0] * right[0] + toStar[1] * right[1] + toStar[2] * right[2], depth) * 180 / Math.PI;
    sumY += Math.atan2(toStar[0] * up[0] + toStar[1] * up[1] + toStar[2] * up[2], depth) * 180 / Math.PI;
    assert.ok(Math.abs(Math.hypot(...star) - STAR_RADIUS) < 1e-3);
    const ax = Math.atan2(toStar[0] * right[0] + toStar[1] * right[1] + toStar[2] * right[2], depth) * 180 / Math.PI, ay = Math.atan2(toStar[0] * up[0] + toStar[1] * up[1] + toStar[2] * up[2], depth) * 180 / Math.PI;
    assert.ok(Math.hypot(ax, ay) > Math.asin(1 / 3.45) * 180 / Math.PI + 1.5, `a belt star is ${Math.hypot(ax, ay)} degrees from the centre, too close to the globe`);
    assert.ok(Math.abs(ax) < 19.5 && Math.abs(ay) < 19.5, 'every belt star is inside the view, even on a phone');
  }
  assert.ok(Math.abs(sumX / 3 - BELT_APPEARANCE.right) < 1.5, `across ${sumX / 3}`);
  assert.ok(Math.abs(sumY / 3 - BELT_APPEARANCE.up) < 1.5, `up ${sumY / 3}`);
  assert.ok(Math.hypot(BELT_APPEARANCE.right, BELT_APPEARANCE.up) > Math.asin(1 / 3.45) * 180 / Math.PI + 1, 'clear of the globe');
});

test('every star sits on the sky sphere, far behind the camera at its furthest zoom', () => {
  assert.ok(STAR_RADIUS > MAX_ZOOM_DISTANCE * 3);
  for (const { positions } of buildStarLayers()) {
    for (let i = 0; i < positions.length; i += 3) {
      const length = Math.hypot(positions[i], positions[i + 1], positions[i + 2]);
      assert.ok(Math.abs(length - STAR_RADIUS) < 1e-3, `star ${i / 3} is ${length} from the centre`);
    }
  }
});

test('colours stay pale and within range, and positions are finite', () => {
  for (const { positions, colors } of buildStarLayers()) {
    assert.equal(colors.length, positions.length);
    for (const v of positions) assert.ok(Number.isFinite(v));
    for (const v of colors) assert.ok(v > 0.25 && v <= 1, `colour value ${v}`);
  }
});

test('the same seed always gives the same sky and a different seed gives another', () => {
  const a = buildStarLayers(31), b = buildStarLayers(31), c = buildStarLayers(32);
  assert.deepEqual(Array.from(a[0].positions.slice(0, 30)), Array.from(b[0].positions.slice(0, 30)));
  assert.notDeepEqual(Array.from(a[0].positions.slice(0, 30)), Array.from(c[0].positions.slice(0, 30)));
});

test('the band holds noticeably more stars near its circle than a plain scatter would', () => {
  // Distance from the band's circle (a plane tilted 62 degrees about x): |normal . direction|.
  const tilt = 62 * Math.PI / 180, normal = [0, Math.cos(tilt), Math.sin(tilt)];
  const near = positions => { let count = 0; for (let i = 0; i < positions.length; i += 3) { const d = Math.abs(normal[0] * positions[i] + normal[1] * positions[i + 1] + normal[2] * positions[i + 2]) / STAR_RADIUS; if (d < 0.3) count++; } return count / (positions.length / 3); };
  // A uniform sphere puts sin(0.3) = about 30% of stars within 0.3 of a great circle plane.
  assert.ok(near(buildStarLayers()[0].positions) > 0.5);
  assert.ok(near(buildStarLayers()[2].positions) < 0.5, 'the bright stars are scattered everywhere, not in the band');
});

test('the random generator stays between 0 and 1 and handles odd seeds', () => {
  for (const seed of [0, 1, -5, 31, 2147483647, 1.9]) {
    const random = seededRandom(seed);
    for (let i = 0; i < 1000; i++) { const v = random(); assert.ok(v >= 0 && v <= 1); }
  }
});

test('the globe builds its sky from these layers, with no animation and no new network origin', () => {
  const globe = readFileSync(new URL('../../src/lib/globe.js', import.meta.url), 'utf8');
  assert.match(globe, /buildStarLayers\(31,/);
  assert.doesNotMatch(globe, /new THREE\.Vector3\(random\(\) - \.5/, 'the old 550-star scatter is gone');
});

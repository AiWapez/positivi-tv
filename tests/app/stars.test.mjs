import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStarLayers, orionDirections, seededRandom, STAR_COUNTS, STAR_RADIUS, STAR_SIZES, STAR_OPACITY, BRILLIANT_COUNT, ORION_SCALE, ORION_APPEARANCE, ORION } from '../../src/lib/stars.ts';
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

test("Orion is drawn as small layers, one per dot size, only when an opening view is given, and its stars are the biggest in the sky", () => {
  assert.equal(buildStarLayers(31).length, 4);
  const layers = buildStarLayers(31, VIEW), orion = layers.slice(4);
  assert.ok(orion.length >= 2);
  assert.equal(orion.reduce((n, l) => n + l.positions.length / 3, 0), ORION.length);
  for (const l of orion) { assert.ok(l.size > STAR_SIZES.brilliant); assert.equal(l.colors.length, l.positions.length); }
});

test("Orion's belt keeps the real shape: three stars in an even line, scaled with the rest of the figure", () => {
  const [a, b, c] = orionDirections(VIEW);
  const ab = angleBetween(a, b), bc = angleBetween(b, c), ac = angleBetween(a, c);
  assert.ok(Math.abs(ab - 1.35 * ORION_SCALE) < 0.2, `Alnitak to Alnilam ${ab}`);
  assert.ok(Math.abs(bc - 1.42 * ORION_SCALE) < 0.2, `Alnilam to Mintaka ${bc}`);
  assert.ok(Math.abs(ab + bc - ac) < 0.1, 'the three stars lie on one line');
});

test('Orion has the classic hourglass: Betelgeuse and Bellatrix on top, Saiph and Rigel below, the belt in the middle', () => {
  const d = Object.fromEntries(ORION.map((star, i) => [star.name, orionDirections(VIEW)[i]]));
  const real = 17.9 * ORION_SCALE; // Betelgeuse to Rigel is about 17.9 degrees on the real sky
  assert.ok(Math.abs(angleBetween(d.Betelgeuse, d.Rigel) - real) < 1.2, `Betelgeuse to Rigel ${angleBetween(d.Betelgeuse, d.Rigel)}`);
  assert.ok(Math.abs(angleBetween(d.Bellatrix, d.Saiph) - 16.0 * ORION_SCALE) < 1.2);
  // The belt sits between the top and bottom pairs: going top to bottom through Alnilam adds up to about the straight distance.
  const through = angleBetween(d.Betelgeuse, d.Alnilam) + angleBetween(d.Alnilam, d.Rigel);
  assert.ok(through - angleBetween(d.Betelgeuse, d.Rigel) < 2, 'the belt lies between the shoulders and the feet');
  // Betelgeuse is the orange one.
  assert.ok(ORION.find(s => s.name === 'Betelgeuse').color[0] > ORION.find(s => s.name === 'Betelgeuse').color[2]);
  assert.deepEqual(ORION.map(s => s.name), ['Alnitak', 'Alnilam', 'Mintaka', 'Betelgeuse', 'Bellatrix', 'Rigel', 'Saiph']);
});

test("Orion shows in the upper left of the opening view, outside the globe's disc at every start and story distance, every star inside the view, on the sky sphere", () => {
  const forward = FORWARD, upHint = [0, 1, 0];
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]], norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const right = norm(cross(forward, upHint)), up = cross(right, forward);
  const stars = orionDirections(VIEW).map(v => v.map(x => x * STAR_RADIUS));
  // 3.7 and 3.45 are the phone and desktop start, 3.05 is where the camera ends after the flight to a story.
  for (const distance of [3.05, 3.45, 3.7]) {
    const camera = forward.map(x => -x * distance), seen = [];
    let sumX = 0, sumY = 0;
    stars.forEach((star, i) => {
      const toStar = star.map((x, k) => x - camera[k]), depth = toStar[0] * forward[0] + toStar[1] * forward[1] + toStar[2] * forward[2];
      const ax = Math.atan2(toStar[0] * right[0] + toStar[1] * right[1] + toStar[2] * right[2], depth) * 180 / Math.PI, ay = Math.atan2(toStar[0] * up[0] + toStar[1] * up[1] + toStar[2] * up[2], depth) * 180 / Math.PI;
      if (i < 3) { sumX += ax; sumY += ay; }
      seen.push([ax, ay]);
      assert.ok(Math.abs(Math.hypot(...star) - STAR_RADIUS) < 1e-3);
      assert.ok(Math.hypot(ax, ay) > Math.asin(1 / distance) * 180 / Math.PI + 0.7, `${ORION[i].name} is ${Math.hypot(ax, ay)} degrees from the centre at distance ${distance}, too close to the globe`);
      assert.ok(Math.abs(ax) < 19.5 && Math.abs(ay) < 19, `${ORION[i].name} is outside the view on a phone (${ax}, ${ay})`);
    });
    // Upright, as seen from the northern hemisphere: Betelgeuse and Bellatrix above the belt, Rigel and Saiph below, Betelgeuse left of Bellatrix, Saiph left of Rigel, Alnitak left of Mintaka.
    const [alnitak, alnilam, mintaka, betelgeuse, bellatrix, rigel, saiph] = seen;
    assert.ok(betelgeuse[1] > alnilam[1] && bellatrix[1] > alnilam[1], 'the shoulders are above the belt');
    assert.ok(rigel[1] < alnilam[1] && saiph[1] < alnilam[1], 'the feet are below the belt');
    assert.ok(betelgeuse[0] < bellatrix[0] && saiph[0] < rigel[0] && alnitak[0] < mintaka[0], 'east is on the left, as in the real sky');
    assert.ok(Math.abs(sumX / 3 - ORION_APPEARANCE.right) < 1.5, `across ${sumX / 3}`);
    assert.ok(Math.abs(sumY / 3 - ORION_APPEARANCE.up) < 1.5, `up ${sumY / 3}`);
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

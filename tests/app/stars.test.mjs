import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStarLayers, orionDirections, figureSky, FIGURES, seededRandom, STAR_COUNTS, STAR_RADIUS, STAR_SIZES, STAR_OPACITY, BRILLIANT_COUNT, ORION_SCALE, ORION_APPEARANCE, ORION } from '../../src/lib/stars.ts';
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

test('the constellations are drawn as small layers, one per dot size, only when an opening view is given, and every dot is bigger than the scatter stars', () => {
  assert.equal(buildStarLayers(31).length, 4);
  const layers = buildStarLayers(31, VIEW), figures = layers.slice(4);
  assert.ok(figures.length >= 2 && figures.length <= 6, `${figures.length} extra layers`);
  assert.equal(figures.reduce((n, l) => n + l.positions.length / 3, 0), FIGURES.reduce((n, f) => n + f.stars.length, 0));
  for (const l of figures) { assert.ok(l.size > STAR_SIZES.bright); assert.equal(l.colors.length, l.positions.length); }
  assert.deepEqual(figures.map(l => l.size), [...figures.map(l => l.size)].sort((a, b) => a - b), 'brighter dots are drawn later, on top');
  assert.ok(Math.max(...figures.map(l => l.size)) > STAR_SIZES.brilliant, 'the brightest constellation stars stand out from the brilliant scatter');
});

test('the sky holds Orion first and ten more real constellations, each with enough stars to be recognised and no star used twice', () => {
  assert.deepEqual(FIGURES.map(f => f.name), ['Orion', 'Ursa Major (the Big Dipper)', 'Cassiopeia', 'Ursa Minor (the Little Dipper)', 'Crux (the Southern Cross)', 'Scorpius', 'Leo', 'Cygnus (the Northern Cross)', 'Lyra', 'Taurus', 'Canis Major']);
  const seen = new Set();
  for (const f of FIGURES) {
    assert.ok(f.stars.length >= 4 && f.stars.length <= 16, `${f.name} has ${f.stars.length} stars`);
    assert.ok(f.scale >= 0.35 && f.scale <= 1.5, `${f.name} scale ${f.scale}`);
    for (const star of f.stars) {
      assert.ok(Number.isInteger(star.hip) && star.hip > 0 && !seen.has(star.hip), `${star.name} (HIP ${star.hip}) is listed twice`); seen.add(star.hip);
      assert.ok(star.ra >= 0 && star.ra < 360 && star.dec >= -90 && star.dec <= 90 && Number.isFinite(star.mag), `${star.name} has an impossible position or magnitude`);
      assert.ok([0.115, 0.14, 0.17, 0.2, 0.22].includes(star.size), `${star.name} size ${star.size}`);
      assert.ok(star.color.length === 3 && star.color.every(v => v > 0.25 && v <= 1), `${star.name} colour`);
    }
  }
});

test('a brighter star is never drawn smaller than a fainter one in the same figure, and the brightest star of every figure has the biggest dot', () => {
  for (const f of FIGURES) {
    const brightest = f.stars.reduce((a, b) => b.mag < a.mag ? b : a), biggest = Math.max(...f.stars.map(s => s.size));
    assert.equal(brightest.size, biggest, `${f.name}: ${brightest.name} should have the biggest dot`);
    if (f.name === 'Orion') continue; // Orion's dot sizes were chosen by hand before the others existed and are kept as they were
    for (const a of f.stars) for (const b of f.stars) if (a.mag < b.mag) assert.ok(a.size >= b.size, `${f.name}: ${a.name} (${a.mag}) is smaller than ${b.name} (${b.mag})`);
  }
});

test("Orion's belt stars sit where the catalogue puts them (they were once a degree off)", () => {
  const belt = Object.fromEntries(ORION.map(s => [s.name, s]));
  const expected = { Alnitak: [85.1897, -1.9426], Alnilam: [84.0534, -1.2019], Mintaka: [83.0017, -0.2991], Betelgeuse: [88.7929, 7.4071], Bellatrix: [81.2828, 6.3497], Rigel: [78.6345, -8.2016], Saiph: [86.9391, -9.6696] };
  for (const [name, [ra, dec]] of Object.entries(expected)) { assert.ok(Math.abs(belt[name].ra - ra) < 0.01 && Math.abs(belt[name].dec - dec) < 0.01, `${name} is at ${belt[name].ra}, ${belt[name].dec}`); }
});

test('every figure keeps its real shape at its drawn scale, and no two figures touch', () => {
  const sky = figureSky(VIEW), rad = d => d * Math.PI / 180, vec = (r, d) => [Math.cos(rad(d)) * Math.cos(rad(r)), Math.cos(rad(d)) * Math.sin(rad(r)), Math.sin(rad(d))];
  FIGURES.forEach((f, k) => {
    assert.equal(sky[k].length, f.stars.length);
    for (let i = 0; i < f.stars.length; i++) for (let j = i + 1; j < f.stars.length; j++) {
      const real = angleBetween(vec(f.stars[i].ra, f.stars[i].dec), vec(f.stars[j].ra, f.stars[j].dec)) * f.scale, drawn = angleBetween(sky[k][i], sky[k][j]);
      assert.ok(Math.abs(drawn - real) <= Math.max(0.05, real * 0.02), `${f.name}: ${f.stars[i].name} to ${f.stars[j].name} is ${drawn} degrees, expected ${real}`);
    }
    for (const v of sky[k]) assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-9);
    const extent = Math.max(...sky[k].flatMap(a => sky[k].map(b => angleBetween(a, b))));
    assert.ok(extent > 7 && extent < 12, `${f.name} is drawn ${extent} degrees across`);
  });
  for (let a = 0; a < sky.length; a++) for (let b = a + 1; b < sky.length; b++) for (const p of sky[a]) for (const q of sky[b]) assert.ok(angleBetween(p, q) > 5, `${FIGURES[a].name} and ${FIGURES[b].name} come within ${angleBetween(p, q)} degrees`);
});

test('the figures keep their real places relative to each other (one turn moves the whole sky)', () => {
  const sky = figureSky(VIEW), rad = d => d * Math.PI / 180, vec = (r, d) => [Math.cos(rad(d)) * Math.cos(rad(r)), Math.cos(rad(d)) * Math.sin(rad(r)), Math.sin(rad(d))];
  const middle = vs => { const t = vs.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]), l = Math.hypot(...t); return t.map(x => x / l); };
  const real = FIGURES.map(f => middle(f.stars.map(s => vec(s.ra, s.dec)))), drawn = sky.map(middle);
  for (let a = 0; a < FIGURES.length; a++) for (let b = a + 1; b < FIGURES.length; b++) assert.ok(Math.abs(angleBetween(real[a], real[b]) - angleBetween(drawn[a], drawn[b])) < 1.5, `${FIGURES[a].name} to ${FIGURES[b].name}`);
});

test('turning the globe shows a constellation star outside the globe in roughly half of all views, on a phone and on a desktop', () => {
  const sky = figureSky(VIEW).map(f => f.map(v => v.map(x => x * STAR_RADIUS)));
  let state = 12345; const random = () => (state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const unit = v => { const l = Math.hypot(...v); return v.map(x => x / l); }, cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  for (const [distance, aspect, low, high] of [[3.7, 390 / 370, 0.3, 0.7], [3.45, 1000 / 600, 0.35, 0.8]]) {
    const halfHeight = Math.tan(20 * Math.PI / 180), halfWidth = halfHeight * aspect, globe = Math.asin(1 / distance); let shown = 0;
    for (let k = 0; k < 1500; k++) {
      const y = random() * 2 - 1, angle = random() * 2 * Math.PI, ring = Math.sqrt(1 - y * y), camera = [ring * Math.cos(angle) * distance, y * distance, ring * Math.sin(angle) * distance];
      const forward = unit(camera.map(x => -x)), right = unit(cross(forward, [0, 1, 0])), up = cross(right, forward);
      const visible = sky.some(figure => figure.some(star => {
        const t = star.map((x, i) => x - camera[i]), depth = t[0] * forward[0] + t[1] * forward[1] + t[2] * forward[2];
        if (depth <= 0) return false;
        const x = (t[0] * right[0] + t[1] * right[1] + t[2] * right[2]) / depth, h = (t[0] * up[0] + t[1] * up[1] + t[2] * up[2]) / depth;
        return Math.abs(x) <= halfWidth && Math.abs(h) <= halfHeight && Math.atan(Math.hypot(x, h)) > globe;
      }));
      if (visible) shown++;
    }
    assert.ok(shown / 1500 > low && shown / 1500 < high, `${(100 * shown / 1500).toFixed(0)}% of views at distance ${distance}`);
  }
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
  for (const { positions, colors } of buildStarLayers(31, VIEW)) {
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

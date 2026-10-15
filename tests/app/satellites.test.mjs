import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decorativeOrbits, satellitePosition, SATELLITE_COUNT, SATELLITE_MIN_RADIUS, SATELLITE_MAX_RADIUS } from '../../src/lib/satellites.ts';

test('the drifting dots are the same for everyone and there are a modest number of them', () => {
  const a = decorativeOrbits(), b = decorativeOrbits();
  assert.equal(a.length, SATELLITE_COUNT); assert.ok(SATELLITE_COUNT <= 20);
  assert.deepEqual(a, b);
});

test('every dot stays above the Earth and below the stars, at all times', () => {
  for (const orbit of decorativeOrbits()) for (let t = 0; t < 2000; t += 37) {
    const [x, y, z] = satellitePosition(orbit, t), r = Math.hypot(x, y, z);
    assert.ok(Math.abs(r - orbit.radius) < 1e-9);
    assert.ok(r >= SATELLITE_MIN_RADIUS - 1e-9 && r <= SATELLITE_MAX_RADIUS + 1e-9);
  }
});

test('the dots move, repeat after one period, and use a spread of tilts', () => {
  const orbits = decorativeOrbits();
  for (const orbit of orbits) {
    const start = satellitePosition(orbit, 0), later = satellitePosition(orbit, 10), again = satellitePosition(orbit, orbit.period);
    assert.ok(Math.hypot(...start.map((v, i) => v - later[i])) > 0.01, 'moves');
    assert.ok(Math.hypot(...start.map((v, i) => v - again[i])) < 1e-9, 'repeats');
  }
  const tilts = new Set(orbits.map(o => Math.round(Math.abs(o.inclination) * 4)));
  assert.ok(tilts.size >= 4, 'varied tilts');
});

test('the made-up satellites carry no names or data source, and the docs say they are not real', async () => {
  const source = await readFile(new URL('../../src/lib/satellites.ts', import.meta.url), 'utf8');
  assert.ok(!/celestrak|norad|fetch\(/i.test(source.replace(/\/\*\*[\s\S]*?\*\//, '')));
  assert.deepEqual(Object.keys(decorativeOrbits()[0]).sort(), ['inclination', 'node', 'period', 'phase', 'radius']);
  assert.match(await readFile(new URL('../../docs/globe-detail.md', import.meta.url), 'utf8'), /made-up satellites/i);
});

test('the satellites start off and a button turns them on', async () => {
  const app = await readFile(new URL('../../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /useState\(false\);\s*\n\s*const \[globeReady/);
  assert.match(app, /satellites=\{satellitesOn\}/);
  assert.match(app, /className="satellite-button" aria-pressed=\{satellitesOn\}/);
  const globe = await readFile(new URL('../../src/lib/globe.js', import.meta.url), 'utf8');
  assert.match(globe, /satellites\.visible = false/);
  assert.match(globe, /setSatellites\(on\)/);
});

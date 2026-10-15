#!/usr/bin/env node
// Builds public/assets/borders.json, the country borders the globe draws when a reader zooms in.
//
// Source: Natural Earth 4.1.0 (public domain), as TopoJSON from the npm package world-atlas@2.0.2, 1:50 million scale.
// Only the lines that two countries share are kept. Coastlines are left out because the Earth picture already shows them.
//
// Run with `npm run borders:build` to rewrite the file, or `npm run borders:check` to confirm the committed file is exactly
// what this script produces (the test suite does the same).
//
// Output format (small on purpose): every number is an integer in hundredths of a degree. Each line starts with its first
// longitude and latitude, and every later point is stored as the change from the point before it.
//   { "source": "...", "precision": 100, "lines": [[lng0, lat0, dLng1, dLat1, ...], ...] }
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { mesh } from 'topojson-client';

const require = createRequire(import.meta.url);
const PRECISION = 100;
const OUT = new URL('../public/assets/borders.json', import.meta.url);
const topologyPath = require.resolve('world-atlas/countries-50m.json');
const worldAtlas = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/package.json', import.meta.url), 'utf8'));

export function buildBorders() {
  const topology = JSON.parse(readFileSync(topologyPath, 'utf8'));
  const shared = mesh(topology, topology.objects.countries, (a, b) => a !== b);
  const lines = [];
  for (const line of shared.coordinates) {
    const points = [];
    let last = null;
    for (const [lng, lat] of line) {
      const point = [Math.round(lng * PRECISION), Math.round(lat * PRECISION)];
      if (last && point[0] === last[0] && point[1] === last[1]) continue; // rounding made two points identical
      points.push(point); last = point;
    }
    if (points.length < 2) continue;
    const encoded = [points[0][0], points[0][1]];
    for (let i = 1; i < points.length; i++) encoded.push(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    lines.push(encoded);
  }
  return `${JSON.stringify({
    source: `Natural Earth 4.1.0 (public domain), country borders at 1:50m, from npm world-atlas@${worldAtlas.version}. Only borders shared by two countries; coastlines are not included.`,
    precision: PRECISION,
    lines,
  })}\n`;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const text = buildBorders();
  if (process.argv.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (current !== text) { console.error('public/assets/borders.json is out of date. Run: npm run borders:build'); process.exit(1); }
    console.log('public/assets/borders.json matches the data it is built from.');
  } else {
    writeFileSync(OUT, text);
    console.log(`Wrote public/assets/borders.json (${Math.round(text.length / 1024)} KB).`);
  }
}

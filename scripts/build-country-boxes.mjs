#!/usr/bin/env node
// Builds server/country-boxes.json: a few padded bounding boxes per country, used only to check that a publisher's map
// coordinates are plausible for the country the same publisher tagged the story with. It is a sanity check, not a border.
//
// Source: Natural Earth 5.1.2 (public domain), 1:50 million scale, ne_50m_admin_0_countries.geojson from the project's GitHub mirror at
// tag v5.1.2, checked against the SHA-256 below (the same file scripts/build-places.mjs uses).
//
// Rules: each country gets the bounding box of every land part that is not a tiny islet (the largest part is always kept), then at most the MAX_PARTS largest, each box is
// padded by PAD degrees so that simplified coastlines and borders (a coordinate in Manhattan, or on the Poland/Belarus border in the
// Białowieża forest) still pass, and values are rounded to one decimal place. Countries are named as server/publisher-location.ts names them.
//
// Run `npm run boxes:build` to rewrite the file (it downloads the source) or `npm run boxes:check` to confirm the committed file is exactly
// what this script produces. To work offline, pass a local copy: node scripts/build-country-boxes.mjs --countries path/to/file.geojson
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { COUNTRY_NAMES } from '../server/publisher-location.ts';

export const SOURCE = { file: 'ne_50m_admin_0_countries.geojson', sha256: '3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb' };
const URL_BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/';
const OUT = new URL('../server/country-boxes.json', import.meta.url);
export const PAD = 0.75;
/** Parts whose box is smaller than this many square degrees are islets and are dropped (unless they are the country's largest part). */
export const MIN_PART = 1;
/** At most this many parts per country (the largest ones), which keeps archipelagos such as Indonesia small. */
export const MAX_PARTS = 12;
/** Our names that Natural Earth writes differently, or that are parts of a larger Natural Earth country. */
export const NE_NAME = {
  'United States': 'United States of America', "Côte d'Ivoire": 'Ivory Coast', Czechia: 'Czech Republic',
  'Democratic Republic of the Congo': 'Democratic Republic of the Congo', 'Republic of the Congo': 'Republic of the Congo',
  'Timor-Leste': 'East Timor', Eswatini: 'eSwatini', 'North Macedonia': 'North Macedonia', Myanmar: 'Myanmar',
  England: 'United Kingdom', Scotland: 'United Kingdom', Wales: 'United Kingdom', 'Northern Ireland': 'United Kingdom',
  Russia: 'Russia', Serbia: 'Republic of Serbia', Tanzania: 'United Republic of Tanzania', 'The Bahamas': 'The Bahamas',
  'The Gambia': 'Gambia', 'Cabo Verde': 'Cape Verde', 'Bosnia and Herzegovina': 'Bosnia and Herzegovina',
  'Saint Kitts and Nevis': 'Saint Kitts and Nevis', 'Sao Tome and Principe': 'São Tomé and Principe', 'Türkiye': 'Turkey',
};
const round = v => Math.round(v * 10) / 10;

export function buildBoxes(geojson, names = COUNTRY_NAMES) {
  const features = geojson.features, out = {}, missing = [];
  // A country's own names win over SOVEREIGNT, which territories (Guam, Northern Mariana Islands) share with the country that rules them.
  const byName = new Map();
  for (const keys of [['NAME', 'ADMIN', 'NAME_LONG', 'NAME_EN', 'FORMAL_EN'], ['SOVEREIGNT']])
    for (const f of features) for (const key of keys) { const v = f.properties[key]; if (typeof v === 'string' && !byName.has(v)) byName.set(v, f); }
  for (const name of names) {
    const f = byName.get(NE_NAME[name] ?? name);
    if (!f) { missing.push(name); continue; }
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const parts = polys.map(p => {
      let w = 180, e = -180, s = 90, n = -90;
      for (const [x, y] of p[0]) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
      return { w, e, s, n, area: (e - w) * (n - s) };
    }).sort((a, b) => b.area - a.area);
    const keep = parts.filter((p, i) => i === 0 || p.area >= MIN_PART).slice(0, MAX_PARTS);
    out[name] = keep.map(p => [round(Math.max(-90, p.s - PAD)), round(Math.max(-180, p.w - PAD)), round(Math.min(90, p.n + PAD)), round(Math.min(180, p.e + PAD))]);
  }
  return { out, missing };
}
export function render(boxes) {
  const doc = { _about: 'Padded bounding boxes [south, west, north, east] per country, built by scripts/build-country-boxes.mjs from Natural Earth 5.1.2 (public domain). A plausibility check for publisher coordinates, not a border.', countries: boxes };
  return JSON.stringify(doc) + '\n';
}
async function load(args) {
  const i = args.indexOf('--countries');
  const buf = i >= 0 ? readFileSync(args[i + 1]) : Buffer.from(await (await fetch(URL_BASE + SOURCE.file)).arrayBuffer());
  const sum = createHash('sha256').update(buf).digest('hex');
  if (sum !== SOURCE.sha256) throw new Error(`Source checksum mismatch: ${sum}`);
  return JSON.parse(buf.toString('utf8'));
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), check = args.includes('--check');
  const { out, missing } = buildBoxes(await load(args));
  if (missing.length) { console.error('No Natural Earth country for: ' + missing.join(', ')); process.exit(1); }
  const text = render(out);
  if (check) { if (readFileSync(OUT, 'utf8') !== text) { console.error('server/country-boxes.json is out of date. Run npm run boxes:build.'); process.exit(1); } console.log('country boxes up to date'); }
  else { writeFileSync(OUT, text); console.log(`Wrote ${Object.keys(out).length} countries to server/country-boxes.json`); }
}

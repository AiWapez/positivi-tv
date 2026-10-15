#!/usr/bin/env node
// Builds public/assets/places.json, the country names, capitals and big cities the globe labels when a reader zooms in.
//
// Source: Natural Earth 5.1.2 (public domain), 1:50 million scale, two files from the project's GitHub mirror at tag v5.1.2:
//   ne_50m_admin_0_countries.geojson  (country names and the hand-placed spot where each name sits)
//   ne_50m_populated_places.geojson   (capitals and cities, with English names)
// Both files are checked against the SHA-256 recorded below, so a changed upstream file stops the build instead of changing the labels.
//
// Run with `npm run places:build` to rewrite the file (it downloads the two sources), or `npm run places:check` to confirm the
// committed file is exactly what this script produces. To work offline, pass local copies:
//   node scripts/build-places.mjs --countries path/to/countries.geojson --populated path/to/places.geojson
//
// Rules (also written into the output file and into docs/globe-detail.md):
//   Countries  Only places with an ISO 3166-1 country code are labelled. Places without one (for example Kosovo, Somaliland, Northern
//              Cyprus) are not labelled, and no label is added by hand. Names are Natural Earth's English names. A few names that are
//              too long for a map label are shortened by the table below.
//   Cities     Every place Natural Earth marks as a national capital ("Admin-0 capital"), plus every other place with 2 million people or more
//              (metropolitan estimate). Research stations, historic places and weather stations are left out, and so is any place whose
//              country has no ISO code, which keeps the cities consistent with the countries.
//   Tiers      1 to 4 decide how far a reader must zoom before a name may appear (1 first). Countries use Natural Earth's own
//              MIN_LABEL hint; cities use population and capital status.
//
// Output format (small on purpose): coordinates are integers in hundredths of a degree, and the entries are in priority order.
//   countries: [name, lat, lng, tier]       cities: [name, lat, lng, tier]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PRECISION = 100;
const OUT = new URL('../public/assets/places.json', import.meta.url);
const TAG = 'v5.1.2';
const BASE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${TAG}/geojson/`;
export const SOURCES = {
  countries: { file: 'ne_50m_admin_0_countries.geojson', sha256: '3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb' },
  populated: { file: 'ne_50m_populated_places.geojson', sha256: 'da4662b7bbfeb897d02f228c5839131dce27acff5717630f91ccff4f67828ee7' },
};

/** Natural Earth's English names that are too long for a label on a phone. Everything else is used as Natural Earth writes it. */
export const COUNTRY_NAME_OVERRIDES = {
  'United States of America': 'United States',
  "People's Republic of China": 'China',
  'Saint Vincent and the Grenadines': 'Saint Vincent & Grenadines',
  'Democratic Republic of the Congo': 'DR Congo',
  'Federated States of Micronesia': 'Micronesia',
  'South Georgia and the South Sandwich Islands': 'South Georgia',
  'French Southern and Antarctic Lands': 'French Southern Lands',
  'Heard Island and McDonald Islands': 'Heard Island',
  'Australian Indian Ocean Territories': 'Indian Ocean Territories',
};
/**
 * Three city names where Natural Earth's English name is ambiguous or out of date. "Washington" could mean the state, Kazakhstan's capital
 * has been called Astana again since September 2022, and Palau's government has sat in Ngerulmud (in Melekeok state) since 2006.
 */
export const CITY_NAME_OVERRIDES = { Washington: 'Washington, D.C.', 'Nur-Sultan': 'Astana', Melekeok: 'Ngerulmud' };
export const MAX_NAME_LENGTH = 30;

const SKIPPED_CITY_CLASSES = new Set(['Scientific station', 'Historic place', 'Meteorological station']);
const BIG_CITY = 2_000_000;

/** Natural Earth's own zoom hint for a country name (smaller means a bigger or better-known country). */
export const countryTier = minLabel => (minLabel <= 2.5 ? 1 : minLabel <= 3.5 ? 2 : minLabel <= 4.7 ? 3 : 4);
export function cityTier(population, capital) {
  if (population >= 8_000_000 || (capital && population >= 5_000_000)) return 1;
  if (population >= 4_000_000 || (capital && population >= 2_000_000)) return 2;
  if (population >= BIG_CITY || (capital && population >= 500_000)) return 3;
  return 4;
}

const rad = degrees => degrees * Math.PI / 180;
/** Rough area in square kilometres, only used to put bigger countries first inside a tier. Accurate to a few percent, which is plenty for ordering. */
export function roughAreaKm2(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  const ring = points => {
    let sum = 0;
    for (let i = 0; i < points.length - 1; i++) {
      let dLng = rad(points[i + 1][0] - points[i][0]);
      if (dLng > Math.PI) dLng -= 2 * Math.PI; else if (dLng < -Math.PI) dLng += 2 * Math.PI;
      sum += dLng * (2 + Math.sin(rad(points[i][1])) + Math.sin(rad(points[i + 1][1])));
    }
    return Math.abs(sum) * 6371 * 6371 / 2;
  };
  return polygons.reduce((total, [outer, ...holes]) => total + ring(outer) - holes.reduce((inner, hole) => inner + ring(hole), 0), 0);
}

const fixed = value => Math.round(value * PRECISION);
const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

export function buildPlaces({ countries, populated }) {
  const countryRows = [];
  for (const feature of countries.features) {
    const p = feature.properties;
    // ISO_N3_EH is Natural Earth's ISO 3166-1 numeric code with the gaps for France and Norway filled in; "-99" means the place has none.
    if (!p || p.ISO_N3_EH === '-99' || !/^\d{3}$/.test(String(p.ISO_N3_EH))) continue;
    const english = text(p.NAME_EN), name = COUNTRY_NAME_OVERRIDES[english] ?? english;
    if (!name || name.length > MAX_NAME_LENGTH) throw new Error(`Country name "${english}" is empty or too long for a label. Add it to COUNTRY_NAME_OVERRIDES.`);
    if (!Number.isFinite(p.LABEL_X) || !Number.isFinite(p.LABEL_Y)) throw new Error(`Country "${english}" has no label spot.`);
    countryRows.push({ name, lat: p.LABEL_Y, lng: p.LABEL_X, tier: countryTier(Number(p.MIN_LABEL)), area: roughAreaKm2(feature.geometry) });
  }
  countryRows.sort((a, b) => a.tier - b.tier || b.area - a.area || a.name.localeCompare(b.name, 'en'));

  const cityRows = [], seen = new Set();
  for (const feature of populated.features) {
    const p = feature.properties;
    if (!p || SKIPPED_CITY_CLASSES.has(p.FEATURECLA) || p.ISO_A2 === '-99') continue;
    const capital = p.FEATURECLA === 'Admin-0 capital', population = Number(p.POP_MAX) || 0;
    if (!capital && population < BIG_CITY) continue;
    const english = text(p.NAME_EN), name = CITY_NAME_OVERRIDES[english] ?? english;
    if (!name || name.length > MAX_NAME_LENGTH) throw new Error(`City name "${english}" is empty or too long for a label.`);
    if (!Number.isFinite(p.LATITUDE) || !Number.isFinite(p.LONGITUDE)) throw new Error(`City "${english}" has no position.`);
    const key = `${name}|${p.ISO_A2}`; if (seen.has(key)) continue; seen.add(key);
    cityRows.push({ name, lat: p.LATITUDE, lng: p.LONGITUDE, tier: cityTier(population, capital), capital, population });
  }
  cityRows.sort((a, b) => a.tier - b.tier || b.population - a.population || a.name.localeCompare(b.name, 'en'));

  const source = {
    name: 'Natural Earth (public domain)',
    version: TAG,
    files: Object.fromEntries(Object.entries(SOURCES).map(([key, value]) => [key, { url: BASE + value.file, sha256: value.sha256 }])),
    rules: 'Countries: only places with an ISO 3166-1 country code, at the label spot Natural Earth gives, tier from its MIN_LABEL hint. Cities: Natural Earth national capitals plus every other place of 2 million people or more, without research stations, historic places or weather stations, and without places whose country has no ISO code.',
  };
  const lines = [
    '{',
    `"source":${JSON.stringify(source)},`,
    `"precision":${PRECISION},`,
    '"countries":[',
    countryRows.map(r => JSON.stringify([r.name, fixed(r.lat), fixed(r.lng), r.tier])).join(',\n'),
    '],',
    '"cities":[',
    cityRows.map(r => JSON.stringify([r.name, fixed(r.lat), fixed(r.lng), r.tier])).join(',\n'),
    ']',
    '}',
  ];
  return `${lines.join('\n')}\n`;
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function load(key, localPath) {
  const { file, sha256: expected } = SOURCES[key];
  let bytes;
  if (localPath) bytes = readFileSync(localPath);
  else {
    const response = await fetch(BASE + file);
    if (!response.ok) throw new Error(`Could not download ${BASE + file} (${response.status}).`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`${file} does not match the recorded SHA-256.\n  expected ${expected}\n  got      ${actual}`);
  return JSON.parse(bytes.toString('utf8'));
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const args = process.argv.slice(2), option = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
  const output = buildPlaces({ countries: await load('countries', option('--countries')), populated: await load('populated', option('--populated')) });
  if (args.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (current !== output) { console.error('public/assets/places.json is out of date. Run: npm run places:build'); process.exit(1); }
    console.log('public/assets/places.json matches the data it is built from.');
  } else {
    writeFileSync(OUT, output);
    const data = JSON.parse(output);
    console.log(`Wrote public/assets/places.json (${Math.round(output.length / 1024)} KB, ${data.countries.length} countries, ${data.cities.length} cities).`);
  }
}

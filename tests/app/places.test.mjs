import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import {
  PLACES_URL, PLACES_LOAD_DISTANCE, COUNTRY_NAME_DISTANCE, CITY_NAME_DISTANCE, NAME_FADE_RANGE, FACING_HIDDEN, FACING_FULL, COUNTRY_FONT_PX, COUNTRY_LETTER_SPACING_EM, CITY_FONT_PX,
  LABEL_HEIGHT_PX, CITY_TEXT_OFFSET_PX, CITY_DOT_RADIUS_PX,
  decodePlaces, shouldLoadPlaces, nameDistance, nameOpacity, facingOpacity, labelWidth, labelBox, boxesOverlap, boxInside, chooseLabels,
} from '../../src/lib/places.ts';
import { BORDERS_FADE_START, MIN_ZOOM_DISTANCE } from '../../src/lib/globe-detail.ts';
import { START_DISTANCE } from '../../src/lib/globe-touch.ts';
import { SOURCES, COUNTRY_NAME_OVERRIDES, CITY_NAME_OVERRIDES, MAX_NAME_LENGTH, buildPlaces, countryTier, cityTier, roughAreaKm2 } from '../../scripts/build-places.mjs';

const TIERS = [1, 2, 3, 4];

test('decoding turns hundredths of degrees into places, countries first and then cities', () => {
  const places = decodePlaces({ precision: 100, countries: [['Peru', -950, -7500, 1]], cities: [['Lima', -1205, -7703, 2]] });
  assert.deepEqual(places, [
    { kind: 'country', name: 'Peru', lat: -9.5, lng: -75, tier: 1 },
    { kind: 'city', name: 'Lima', lat: -12.05, lng: -77.03, tier: 2 },
  ]);
});

test('damaged or unusable data shows fewer names instead of failing', () => {
  assert.deepEqual(decodePlaces(null), []);
  assert.deepEqual(decodePlaces({}), []);
  assert.deepEqual(decodePlaces({ precision: 0, countries: [['A', 1, 1, 1]], cities: [] }), []);
  assert.deepEqual(decodePlaces({ precision: 100, countries: 'nope', cities: 7 }), []);
  const rows = [
    ['Fine', 100, 200, 1],
    ['Short row', 1, 2],
    [42, 1, 2, 1],
    ['Bad tier', 1, 2, 5],
    ['Bad tier text', 1, 2, '1'],
    ['Not finite', NaN, 2, 1],
    ['Past the pole', 9100, 0, 1],
    ['Past the date line', 0, 18100, 1],
    ['', 1, 2, 1],
    ['   ', 1, 2, 1],
    ['<b>Markup</b>', 1, 2, 1],
    ['Bell\u0007', 1, 2, 1],
    ['x'.repeat(41), 1, 2, 1],
    'not a row',
  ];
  assert.deepEqual(decodePlaces({ precision: 100, countries: rows, cities: [] }).map(place => place.name), ['Fine']);
  assert.equal(decodePlaces({ precision: 100, countries: [['  Spaced   out  ', 0, 0, 3]], cities: [] })[0].name, 'Spaced out');
  assert.equal(decodePlaces({ precision: 100, countries: [['Line\nbreak', 0, 0, 3]], cities: [] })[0].name, 'Line break', 'line breaks become spaces');
});

test('names are fetched once, on the first deliberate zoom, never from the start view', () => {
  assert.equal(PLACES_URL, '/assets/places.json');
  assert.equal(shouldLoadPlaces({ distance: PLACES_LOAD_DISTANCE, requested: false }), true);
  assert.equal(shouldLoadPlaces({ distance: PLACES_LOAD_DISTANCE + 0.01, requested: false }), false);
  assert.equal(shouldLoadPlaces({ distance: 1.5, requested: true }), false, 'never twice');
  assert.equal(shouldLoadPlaces({ distance: NaN, requested: false }), false);
  assert.ok(START_DISTANCE.default > PLACES_LOAD_DISTANCE && START_DISTANCE.phone > PLACES_LOAD_DISTANCE, 'opening the page does not fetch names');
  assert.ok(3.05 > PLACES_LOAD_DISTANCE, 'flying to a story (it ends at 3.05) does not fetch names');
});

test('tiers appear in order as the reader zooms in, and every tier can be reached', () => {
  for (const table of [COUNTRY_NAME_DISTANCE, CITY_NAME_DISTANCE]) {
    for (let i = 1; i < TIERS.length; i++) assert.ok(table[TIERS[i]] < table[TIERS[i - 1]], `tier ${TIERS[i]} comes after tier ${TIERS[i - 1]}`);
    assert.ok(table[4] > MIN_ZOOM_DISTANCE + NAME_FADE_RANGE, 'the last tier is fully shown before the closest zoom');
  }
  assert.ok(COUNTRY_NAME_DISTANCE[1] <= PLACES_LOAD_DISTANCE, 'the file is requested no later than the moment the first name may show');
  assert.ok(COUNTRY_NAME_DISTANCE[1] <= BORDERS_FADE_START, 'borders begin to show before or with the first country names');
  assert.equal(nameDistance('country', 2), COUNTRY_NAME_DISTANCE[2]); assert.equal(nameDistance('city', 2), CITY_NAME_DISTANCE[2]);
});

test('a name fades in over a short range of zoom after its tier is reached', () => {
  for (const kind of ['country', 'city']) for (const tier of TIERS) {
    const limit = nameDistance(kind, tier);
    assert.equal(nameOpacity(kind, tier, limit), 0, 'nothing exactly at the limit');
    assert.equal(nameOpacity(kind, tier, limit + 1), 0);
    assert.ok(Math.abs(nameOpacity(kind, tier, limit - NAME_FADE_RANGE) - 1) < 1e-9);
    assert.equal(nameOpacity(kind, tier, 1.45), 1);
    const half = nameOpacity(kind, tier, limit - NAME_FADE_RANGE / 2); assert.ok(half > 0.45 && half < 0.55, `${kind} ${tier}: ${half}`);
    let last = 0; for (let d = limit; d >= limit - NAME_FADE_RANGE; d -= 0.01) { const value = nameOpacity(kind, tier, d); assert.ok(value >= last - 1e-9); last = value; }
  }
  assert.equal(nameOpacity('country', 1, NaN), 0);
});

test('names fade out toward the edge of the globe and are gone just before it', () => {
  assert.equal(facingOpacity(1), 1); assert.equal(facingOpacity(FACING_FULL), 1); assert.equal(facingOpacity(FACING_HIDDEN), 0);
  assert.equal(facingOpacity(0), 0); assert.equal(facingOpacity(-0.5), 0); assert.equal(facingOpacity(NaN), 0);
  const middle = facingOpacity((FACING_HIDDEN + FACING_FULL) / 2); assert.ok(Math.abs(middle - 0.5) < 1e-9);
  let last = 0; for (let f = FACING_HIDDEN; f <= FACING_FULL; f += 0.01) { const value = facingOpacity(f); assert.ok(value >= last - 1e-9); last = value; }
});

test('country names are spaced out, city names are not, and each takes a sensible rectangle', () => {
  assert.equal(labelWidth('city', 40, 6), 40);
  assert.ok(Math.abs(labelWidth('country', 60, 5) - (60 + 5 * COUNTRY_LETTER_SPACING_EM * COUNTRY_FONT_PX)) < 1e-9);
  const country = labelBox('country', 100, 50, 80);
  assert.deepEqual(country, { left: 60, right: 140, top: 50 - LABEL_HEIGHT_PX / 2, bottom: 50 + LABEL_HEIGHT_PX / 2 }, 'centred on the spot');
  const city = labelBox('city', 100, 50, 40);
  assert.equal(city.left, 100 - CITY_DOT_RADIUS_PX, 'starts at the dot'); assert.equal(city.right, 100 + CITY_TEXT_OFFSET_PX + 40, 'ends after the name');
  assert.equal(city.bottom - city.top, LABEL_HEIGHT_PX);
});

const box = (left, top, right, bottom) => ({ left, top, right, bottom });

test('rectangles overlap only when they really share space, with optional breathing room', () => {
  assert.equal(boxesOverlap(box(0, 0, 10, 10), box(5, 5, 15, 15)), true);
  assert.equal(boxesOverlap(box(0, 0, 10, 10), box(10, 0, 20, 10)), false, 'touching edges do not overlap');
  assert.equal(boxesOverlap(box(0, 0, 10, 10), box(12, 0, 20, 10), 3), true, 'a 3 pixel gap is not enough room');
  assert.equal(boxesOverlap(box(0, 0, 10, 10), box(14, 0, 20, 10), 3), false);
  assert.equal(boxesOverlap(box(0, 0, 10, 10), box(0, 12, 10, 20), 3), true);
  assert.equal(boxInside(box(10, 10, 90, 40), box(0, 0, 100, 50)), true);
  assert.equal(boxInside(box(10, 10, 90, 40), box(0, 0, 100, 50), 10), true);
  assert.equal(boxInside(box(5, 10, 90, 40), box(0, 0, 100, 50), 10), false);
  assert.equal(boxInside(box(10, 10, 101, 40), box(0, 0, 100, 50)), false);
});

test('a crowded spot keeps the more important name, so big countries win over small cities', () => {
  const bounds = box(0, 0, 400, 300);
  const a = { id: 'first', box: box(50, 50, 150, 64) }, b = { id: 'overlaps first', box: box(100, 52, 200, 66) }, c = { id: 'clear', box: box(220, 50, 300, 64) };
  assert.deepEqual(chooseLabels([a, b, c], [], bounds).map(x => x.id), ['first', 'clear']);
  assert.deepEqual(chooseLabels([b, a, c], [], bounds).map(x => x.id), ['overlaps first', 'clear'], 'the order given is the priority');
  assert.deepEqual(chooseLabels([a, b, c], [box(210, 40, 310, 80)], bounds).map(x => x.id), ['first'], 'a pin or button blocks the names near it');
  assert.deepEqual(chooseLabels([], [], bounds), []);
});

test('names that would be cut off at the edge of the globe area are not shown', () => {
  const bounds = box(0, 0, 400, 300);
  const inside = { id: 'inside', box: box(100, 100, 180, 114) }, nearEdge = { id: 'near edge', box: box(2, 100, 80, 114) }, off = { id: 'off', box: box(350, 100, 430, 114) };
  assert.deepEqual(chooseLabels([inside, nearEdge, off], [], bounds).map(x => x.id), ['inside']);
  assert.deepEqual(chooseLabels([nearEdge], [], bounds, 4, 0).map(x => x.id), ['near edge'], 'no margin keeps it');
});

test('two names closer than the gap are treated as touching', () => {
  const bounds = box(0, 0, 400, 300);
  const left = { id: 'left', box: box(50, 50, 100, 64) }, close = { id: 'close', box: box(102, 50, 150, 64) }, apart = { id: 'apart', box: box(110, 50, 160, 64) };
  assert.deepEqual(chooseLabels([left, close], [], bounds).map(x => x.id), ['left']);
  assert.deepEqual(chooseLabels([left, apart], [], bounds).map(x => x.id), ['left', 'apart']);
});

// ---- the data file ----

const file = new URL('../../public/assets/places.json', import.meta.url);
const raw = () => JSON.parse(readFileSync(file, 'utf8'));
const find = (list, name) => list.find(row => row[0] === name);
const near = (row, lat, lng, within = 1.5) => row && Math.abs(row[1] / 100 - lat) <= within && Math.abs(row[2] / 100 - lng) <= within;

test('the shipped names file decodes into plenty of names and stays small', () => {
  const data = raw();
  assert.ok(data.countries.length >= 200 && data.countries.length <= 260, `countries: ${data.countries.length}`);
  assert.ok(data.cities.length >= 250 && data.cities.length <= 450, `cities: ${data.cities.length}`);
  assert.equal(decodePlaces(data).length, data.countries.length + data.cities.length, 'every row decodes');
  assert.ok(statSync(file).size < 40 * 1024, 'places.json should stay under 40 KB');
  for (const list of [data.countries, data.cities]) {
    for (const tier of TIERS) assert.ok(list.some(row => row[3] === tier), `tier ${tier} has names`);
    assert.ok(list.every((row, i) => i === 0 || row[3] >= list[i - 1][3]), 'entries are in tier order, so the first ones are the most important');
  }
  const names = data.countries.map(row => row[0]); assert.equal(new Set(names).size, names.length, 'country names are unique');
});

test('well-known names sit where they belong', () => {
  const { countries, cities } = raw();
  assert.ok(near(find(cities, 'Paris'), 48.9, 2.4, 0.5), 'Paris');
  assert.ok(near(find(cities, 'Lagos'), 6.5, 3.4, 0.6), 'Lagos');
  assert.ok(near(find(cities, 'Nairobi'), -1.3, 36.8, 0.5), 'Nairobi');
  assert.ok(near(find(cities, 'Tokyo'), 35.7, 139.7, 0.6), 'Tokyo');
  assert.ok(near(find(cities, 'Lima'), -12.05, -77, 0.6), 'Lima');
  assert.ok(near(find(countries, 'Brazil'), -10, -52, 12), 'Brazil is labelled inside Brazil');
  assert.ok(near(find(countries, 'United States'), 39.5, -97.5, 8), 'the United States is labelled in the lower 48, not Alaska or Hawaii');
  assert.ok(near(find(countries, 'Australia'), -25, 134, 10), 'Australia');
  assert.ok(near(find(countries, 'Greenland'), 74, -40, 10), 'Greenland');
  assert.ok(near(find(countries, 'France'), 46.5, 2.5, 5), 'France is labelled in mainland France, not French Guiana');
  assert.equal(find(countries, 'Russia')[3], 1); assert.equal(find(countries, 'Canada')[3], 1);
  assert.equal(find(cities, 'Tokyo')[3], 1); assert.ok(find(cities, 'Valletta')[3] >= 3, 'a small capital waits for a closer zoom');
});

test('names are written in plain English, as shortened as a label needs and no further', () => {
  const { countries, cities } = raw(), all = [...countries, ...cities].map(row => row[0]);
  assert.ok(all.every(name => name.length <= MAX_NAME_LENGTH), 'no name is too long for a label');
  assert.ok(all.every(name => !/\b(Rep\.|Is\.|Ter\.|Herz\.|Dem\.|Fr\.|Br\.)/.test(name)), 'no map abbreviations');
  for (const name of ['United States', 'DR Congo', 'China', 'Astana', 'Washington, D.C.', 'Ngerulmud']) assert.ok(all.includes(name), `${name} is present`);
  for (const stale of ['Nur-Sultan', 'Melekeok', 'Washington', 'Swaziland', 'United States of America', "People's Republic of China"]) assert.ok(!all.includes(stale), `${stale} is not used`);
});

test('only places with an ISO country code are labelled, and no label is added by hand', () => {
  const names = raw().countries.map(row => row[0]);
  for (const unlabelled of ['Kosovo', 'Somaliland', 'Northern Cyprus', 'Turkish Republic of Northern Cyprus', 'Siachen Glacier']) assert.ok(!names.includes(unlabelled), `${unlabelled} has no ISO country code, so it has no label`);
  for (const labelled of ['France', 'Norway', 'Taiwan', 'Palestine', 'Western Sahara', 'Hong Kong', 'Falkland Islands']) assert.ok(names.includes(labelled), `${labelled} has an ISO code`);
  assert.ok(!raw().cities.some(row => row[0] === 'Pristina' || row[0] === 'Hargeisa'), 'cities follow the same rule as the countries they sit in');
});

test('the file records exactly which Natural Earth files it was built from', () => {
  const { source, precision } = raw();
  assert.equal(precision, 100);
  assert.match(source.name, /Natural Earth/); assert.match(source.name, /public domain/); assert.equal(source.version, 'v5.1.2');
  for (const key of ['countries', 'populated']) {
    assert.equal(source.files[key].sha256, SOURCES[key].sha256);
    assert.equal(source.files[key].url, `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/${SOURCES[key].file}`);
    assert.match(SOURCES[key].sha256, /^[0-9a-f]{64}$/);
  }
  assert.match(source.rules, /ISO 3166-1/); assert.match(source.rules, /2 million/);
});

// ---- the build script ----

const country = (name, iso, minLabel, x, y, size = 2, extra = {}) => ({
  type: 'Feature', properties: { NAME_EN: name, ISO_N3_EH: iso, MIN_LABEL: minLabel, LABEL_X: x, LABEL_Y: y, ...extra },
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [size, 0], [size, size], [0, size], [0, 0]]] },
});
const city = (name, cls, pop, iso = 'XX', lat = 10, lng = 20) => ({ type: 'Feature', properties: { NAME_EN: name, FEATURECLA: cls, POP_MAX: pop, ISO_A2: iso, LATITUDE: lat, LONGITUDE: lng }, geometry: null });
const built = (countries, populated) => {
  const text = buildPlaces({ countries: { features: countries }, populated: { features: populated } }), data = JSON.parse(text);
  return { text, data };
};

test('the build keeps only places with an ISO code and uses the label spot the source gives', () => {
  const { data } = built([country('Kept', '250', 3, 1.234, 5.678), country('No code', '-99', 3, 1, 1), country('Bad code', 'x', 3, 1, 1)], []);
  assert.deepEqual(data.countries, [['Kept', 568, 123, 2]]);
  assert.throws(() => built([{ type: 'Feature', properties: { NAME_EN: 'No spot', ISO_N3_EH: '010', MIN_LABEL: 3 }, geometry: null }], []), /no label spot/);
});

test('long names must be shortened on purpose, never cut off by accident', () => {
  assert.throws(() => built([country('A'.repeat(MAX_NAME_LENGTH + 1), '010', 3, 1, 1)], []), /too long/);
  assert.throws(() => built([country('', '010', 3, 1, 1)], []), /too long|empty/);
  const { data } = built([country('United States of America', '840', 1.7, -97, 39)], []);
  assert.equal(data.countries[0][0], 'United States');
  for (const [from, to] of Object.entries({ ...COUNTRY_NAME_OVERRIDES, ...CITY_NAME_OVERRIDES })) assert.ok(to.length <= MAX_NAME_LENGTH, `${from} -> ${to}`);
  for (const from of Object.keys(COUNTRY_NAME_OVERRIDES)) assert.ok(from.length > 20 || ['United States of America', "People's Republic of China"].includes(from), `${from} only shortened when it needs it`);
});

test('country tiers follow Natural Earth\'s own zoom hint and bigger countries come first inside a tier', () => {
  assert.deepEqual([1.7, 2.5, 2.7, 3.5, 4, 4.7, 5, 6.5].map(countryTier), [1, 1, 2, 2, 3, 3, 4, 4]);
  const { data } = built([country('Small', '001', 3, 1, 1, 1), country('Big', '002', 3, 2, 2, 8), country('Late', '003', 5, 3, 3, 9), country('Early', '004', 2, 4, 4, 0.5)], []);
  assert.deepEqual(data.countries.map(row => row[0]), ['Early', 'Big', 'Small', 'Late']);
});

test('cities are national capitals plus every other place of 2 million or more', () => {
  const { data } = built([], [
    city('Small Capital', 'Admin-0 capital', 300000), city('Big Town', 'Populated place', 2000000), city('Just Under', 'Populated place', 1999999),
    city('Region Capital', 'Admin-1 capital', 900000), city('Alt Capital', 'Admin-0 capital alt', 500000), city('Huge', 'Admin-1 region capital', 9000000),
    city('Station', 'Scientific station', 5000000), city('Old', 'Historic place', 5000000), city('Weather', 'Meteorological station', 5000000),
    city('Disputed', 'Admin-0 capital', 465000, '-99'), city('Washington', 'Admin-0 capital', 4338000, 'US'), city('Nur-Sultan', 'Admin-0 capital', 1100000, 'KZ'),
  ]);
  assert.deepEqual(data.cities.map(row => row[0]).sort(), ['Astana', 'Big Town', 'Huge', 'Small Capital', 'Washington, D.C.']);
  assert.throws(() => built([], [city('B'.repeat(31), 'Admin-0 capital', 1)]), /too long/);
  assert.throws(() => built([], [{ type: 'Feature', properties: { NAME_EN: 'Nowhere', FEATURECLA: 'Admin-0 capital', POP_MAX: 1, ISO_A2: 'XX' }, geometry: null }]), /no position/);
});

test('city tiers follow population, with capitals a step earlier', () => {
  assert.equal(cityTier(9_000_000, false), 1); assert.equal(cityTier(5_000_000, true), 1); assert.equal(cityTier(7_000_000, false), 2);
  assert.equal(cityTier(4_000_000, false), 2); assert.equal(cityTier(2_000_000, true), 2); assert.equal(cityTier(2_000_000, false), 3);
  assert.equal(cityTier(500_000, true), 3); assert.equal(cityTier(499_999, true), 4); assert.equal(cityTier(10_000, true), 4);
  const { data } = built([], [city('Mid', 'Populated place', 3_000_000), city('Giant', 'Populated place', 20_000_000), city('Hamlet', 'Admin-0 capital', 20_000), city('Twin', 'Populated place', 3_500_000)]);
  assert.deepEqual(data.cities.map(row => row[0]), ['Giant', 'Twin', 'Mid', 'Hamlet'], 'tier first, then bigger first');
});

test('coordinates are stored in hundredths of a degree and duplicate cities are dropped', () => {
  const { data } = built([], [city('Lagos', 'Populated place', 9_000_000, 'NG', 6.4532, 3.3958), city('Lagos', 'Populated place', 9_000_000, 'NG', 6.4, 3.4), city('Lagos', 'Populated place', 9_000_000, 'PT', 37.1, -8.7)]);
  assert.deepEqual(data.cities.map(row => row.slice(1, 3)), [[645, 340], [3710, -870]]);
});

test('the same input always gives exactly the same file', () => {
  const countries = [country('B', '002', 3, 2, 2), country('A', '001', 3, 1, 1)], populated = [city('Town', 'Populated place', 3_000_000)];
  assert.equal(built(countries, populated).text, built([...countries].reverse(), populated).text);
  assert.ok(built(countries, populated).text.endsWith('}\n'));
});

test('rough areas are close enough to order countries correctly', () => {
  const square = (lng, lat, size) => ({ type: 'Polygon', coordinates: [[[lng, lat], [lng + size, lat], [lng + size, lat + size], [lng, lat + size], [lng, lat]]] });
  const within = (value, expected, percent) => assert.ok(Math.abs(value - expected) / expected < percent / 100, `${value} vs ${expected}`);
  within(roughAreaKm2(square(0, 0, 1)), 12364, 2);
  within(roughAreaKm2(square(0, 60, 1)), 12364 * Math.cos(60.5 * Math.PI / 180), 3);
  const crossing = { type: 'Polygon', coordinates: [[[179, 0], [-179, 0], [-179, 2], [179, 2], [179, 0]]] };
  within(roughAreaKm2(crossing), 4 * 12364, 3); // a box that crosses the date line is 2 degrees wide, not 358
  const withHole = { type: 'Polygon', coordinates: [square(0, 0, 4).coordinates[0], [[1, 1], [1, 3], [3, 3], [3, 1], [1, 1]]] };
  within(roughAreaKm2(withHole), roughAreaKm2(square(0, 0, 4)) - roughAreaKm2(square(1, 1, 2)), 1);
  assert.equal(roughAreaKm2({ type: 'Point', coordinates: [0, 0] }), 0);
  const multi = { type: 'MultiPolygon', coordinates: [square(0, 0, 1).coordinates, square(10, 0, 1).coordinates] };
  within(roughAreaKm2(multi), 2 * 12364, 2);
});

// ---- styles, credits and notes ----

test('the page styles use the same label sizes the layout rules assume', () => {
  const css = readFileSync(new URL('../../src/styles/index.css', import.meta.url), 'utf8');
  const rule = selector => { const at = css.lastIndexOf(`${selector}{`); assert.ok(at >= 0, `${selector} rule exists`); return css.slice(at, css.indexOf('}', at)); };
  assert.match(rule('.place-country'), new RegExp(`font-size:${COUNTRY_FONT_PX}px`)); assert.match(rule('.place-country'), new RegExp(`letter-spacing:${String(COUNTRY_LETTER_SPACING_EM).replace('0.', '.')}em`));
  assert.match(rule('.place-city'), new RegExp(`font-size:${CITY_FONT_PX}px`)); assert.match(rule('.place-city'), new RegExp(`margin-left:${CITY_TEXT_OFFSET_PX}px`));
  assert.match(rule('.place'), new RegExp(`height:${LABEL_HEIGHT_PX}px`));
  assert.match(rule('.place-labels'), /pointer-events:none/);
});

test('the About panel and the asset notes credit and describe the names data', () => {
  const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /Country borders and place names: Natural Earth/); assert.match(app, /Borders and names are approximate and don't express any view by PositiviTV about disputed places/);
  assert.match(app, /Country facts: CIA World Factbook, frozen public archive, public domain/); assert.match(app, /NASA, NOAA, the CIA, the IUCN and the publishers we link to don't endorse PositiviTV/);
  const notes = readFileSync(new URL('../../public/ASSETS.md', import.meta.url), 'utf8');
  assert.match(notes, /places\.json/); assert.match(notes, /Natural Earth/); assert.match(notes, /ISO 3166-1/);
  const docs = readFileSync(new URL('../../docs/globe-detail.md', import.meta.url), 'utf8');
  assert.match(docs, /places\.json/); assert.match(docs, /places:build/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSnapshot } from '../../server/publisher-snapshot.ts';
import { projectPublisherFeed } from '../../src/lib/publisher-feed.ts';
import { countryFromHeadline, countryByName } from '../../server/publisher-location.ts';
import { buildIndex, countryForLocation } from '../../src/lib/country-facts.ts';
import { qualifierLabels } from '../../src/lib/story-utils.ts';
import { NOW, sources, control, candidate, permission } from './publisher-fixtures.mjs';

const withHome = country => sources({ alpha: { id: 'alpha', displayName: 'Alpha News', domains: ['alpha.example.org'], enabled: true, publisherFeed: permission({ defaultCountry: country }) } });
const ok = (sourceId, candidates) => ({ sourceId, ok: true, candidates });
const build = (src, ctl, title) => buildSnapshot(null, [ok('alpha', [candidate('alpha', 'a', title)])], src, control(ctl), NOW);

test('a publisher with one home country gets that country pin when the headline names no place, with its own label', () => {
  const snap = build(withHome('India'), {}, 'High-altitude bird hotspots remain outside protected areas');
  const [item] = snap.items;
  assert.equal(item.location, 'India'); assert.equal(item.locationPrecision, 'country');
  assert(item.labels.includes('country_from_publisher')); assert(!item.labels.includes('country_from_headline'));
  assert.equal(typeof item.lat, 'number');
});

test('a place named in the headline always wins over the publisher home country', () => {
  const [item] = build(withHome('India'), {}, 'Volunteers restore wetland in Kenya').items;
  assert.equal(item.location, 'Kenya'); assert(item.labels.includes('country_from_headline')); assert(!item.labels.includes('country_from_publisher'));
});

test('publishers without a home country, an unknown home country, or the resolver switched off get no pin', () => {
  assert.equal(build(sources(), {}, 'Bird hotspots remain outside protected areas').items[0].locationPrecision, 'unknown');
  assert.equal(build(withHome('Atlantis'), {}, 'Bird hotspots remain outside protected areas').items[0].locationPrecision, 'unknown');
  assert.equal(build(withHome('India'), { locationResolver: 'off' }, 'Bird hotspots remain outside protected areas').items[0].locationPrecision, 'unknown');
});

test('the publisher pin passes the public contract, shows its own honest label, and is dropped when the resolver is off', () => {
  const src = withHome('India'), ctl = control();
  const snap = build(src, {}, 'Bird hotspots remain outside protected areas');
  const stories = projectPublisherFeed(snap, ctl, src, NOW).stories;
  assert.equal(stories.length, 1); assert.equal(stories[0].location, 'India');
  assert(qualifierLabels(stories[0]).some(t => /this publisher reports on this country/.test(t)));
  const off = projectPublisherFeed(snap, control({ locationResolver: 'off' }), src, NOW).stories;
  assert.equal(off[0].lat, null); assert(!off[0].labels.includes('country_from_publisher'));
});

test('the finder now knows many more countries, still only from a clear "in X" phrase', () => {
  for (const [title, name] of [['Solar farms cut costs across Saudi Arabia', 'Saudi Arabia'], ['Wetlands return in Angola', 'Angola'], ['Turtles rescued in the Bahamas', 'Bahamas'],
    ['Reef restored in Fiji and Tonga', null], ['Forest regrows in Myanmar', 'Myanmar'], ['Forest regrows in Burma', 'Myanmar'], ['Mangroves return in Holland', 'Netherlands'],
    ['Birds return in the United Arab Emirates', 'United Arab Emirates'], ['Schools open in the Democratic Republic of the Congo', 'Democratic Republic of the Congo']])
    assert.equal(countryFromHeadline(title)?.name ?? null, name, title);
  for (const title of ['Chad wins a prize', 'Fish return in Jordan', 'Dancers in Georgia win', 'Wells open in Niger', 'Rangers in Guinea', 'Villagers in Congo']) assert.equal(countryFromHeadline(title), null, title);
});

test('every country the finder knows has a sane centre point and a matching country-facts page', () => {
  const file = JSON.parse(readFileSync(new URL('../../public/assets/country-facts.json', import.meta.url), 'utf8'));
  const index = buildIndex(file);
  const src = readFileSync(new URL('../../server/publisher-location.ts', import.meta.url), 'utf8');
  const names = [...src.matchAll(/\[(?:'([^']+)'|"([^"]+)"), (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)/g)].map(m => ({ name: m[1] ?? m[2], lat: +m[3], lng: +m[4] }));
  assert(names.length > 180);
  const missing = [];
  for (const n of names) {
    assert(Math.abs(n.lat) <= 90 && Math.abs(n.lng) <= 180 && !(n.lat === 0 && n.lng === 0), n.name);
    assert.deepEqual(countryByName(n.name), { name: n.name, lat: n.lat, lng: n.lng });
    // England, Scotland and Wales are parts of the United Kingdom, which has the one country page.
    if (!['England', 'Scotland', 'Wales'].includes(n.name) && !countryForLocation(n.name, index)) missing.push(n.name);
  }
  assert.deepEqual(missing, [], 'these finder names have no country-facts page');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { placeTagsFromPost } from '../../server/publisher-place-tags.mjs';
import { parseFeed } from '../../server/collect.mjs';
import { collectPublisherFeed } from '../../server/publisher-collect.mjs';
import { resolvePublisherPlace, combinePlaces, insideCountry, taggedCountries } from '../../server/publisher-place.ts';
import { countryBySlug, COUNTRY_NAMES } from '../../server/publisher-location.ts';
import { buildSnapshot } from '../../server/publisher-snapshot.ts';
import { projectPublisherFeed } from '../../src/lib/publisher-feed.ts';
import { qualifierLabels } from '../../src/lib/story-utils.ts';
import { NOW, sources, control, candidate, permission } from './publisher-fixtures.mjs';

// Real shapes from Mongabay's WordPress API (checked 2026-10-15 on 50 recent posts): class_list carries "location-<slug>" entries and some
// posts carry a coordinates string. The tests below use slugs and coordinates from that sample.
const post = (slugs, coordinates = '') => ({ class_list: ['post-1', 'type-post', ...slugs.map(s => 'location-' + s), 'status-publish'], coordinates });
const tagsOf = (slugs, coordinates) => placeTagsFromPost(post(slugs, coordinates));
const place = (slugs, coordinates) => resolvePublisherPlace(tagsOf(slugs, coordinates));

test('tags and coordinates are read only when well formed', () => {
  assert.deepEqual(placeTagsFromPost(post(['asia', 'india', 'south-asia'])), { slugs: ['asia', 'india', 'south-asia'], coordinates: null });
  assert.deepEqual(placeTagsFromPost(post(['south-africa'], '-23.032354562891683, 30.2880280731755')).coordinates, { lat: -23.032354562891683, lng: 30.2880280731755 });
  assert.deepEqual(placeTagsFromPost(post(['united-states'], '40.741895,-73.989308')).coordinates, { lat: 40.741895, lng: -73.989308 });
  for (const bad of ['', '0, 0', '91, 10', '10, 181', 'north, south', '1,2,3', '12.5', 'x'.repeat(200), 5, null, { lat: 1, lng: 2 }])
    assert.equal(placeTagsFromPost(post(['india'], bad)).coordinates, null, String(bad));
  assert.equal(placeTagsFromPost({ class_list: ['post-1', 'type-post'] }), undefined);
  assert.equal(placeTagsFromPost(null), undefined);
  assert.equal(placeTagsFromPost({ class_list: 'location-india' }), undefined);
  assert.deepEqual(placeTagsFromPost({ class_list: ['location-india', 'location-india', 'location-../etc', 'location-', 'location-A', 42] }).slugs, ['india']);
});

test('slugs match countries by exact name or alias only', () => {
  assert.equal(countryBySlug('south-africa').name, 'South Africa');
  assert.equal(countryBySlug('new-zealand').name, 'New Zealand');
  assert.equal(countryBySlug('burma').name, 'Myanmar');
  assert.equal(countryBySlug('ivory-coast').name, "Côte d'Ivoire");
  for (const slug of ['asia', 'south-asia', 'global', 'amazon', 'pacific-ocean', 'africa', 'georgia', 'congo', 'chad', 'arizona', 'borneo', 'sumatra', '']) assert.equal(countryBySlug(slug), null, slug);
});

// One row per kind of post seen in the 50-post sample: [tags, coordinates, expected]
const SAMPLE = [
  ['one country tag only (India, Bolivia, Belize...)', ['asia', 'india', 'south-asia'], '', { name: 'India', label: 'country_from_publisher_tag', precision: 'country' }],
  ['one country with a subregion term (Sumatra) and no coordinates', ['asia', 'indonesia', 'lampung', 'southeast-asia', 'sumatra'], '', { name: 'Indonesia', label: 'country_from_publisher_tag' }],
  ['Limpopo floods: coordinates inside the tagged country', ['africa', 'south-africa', 'southern-africa'], '-23.032354562891683, 30.2880280731755', { name: 'South Africa', label: 'area_from_publisher', lat: -23, lng: 30.3 }],
  ['Sumatran rhinos: coordinates inside Indonesia', ['asia', 'indonesia', 'lampung', 'southeast-asia', 'sumatra'], '-4.927565105865489, 105.77693902365803', { name: 'Indonesia', label: 'area_from_publisher', lat: -4.9, lng: 105.8 }],
  ['New Zealand coast (the simplified coastline must not reject it)', ['new-zealand', 'oceania', 'pacific-islands', 'polynesia'], '-35.239707, 174.244062', { name: 'New Zealand', label: 'area_from_publisher' }],
  ['New York City (a city point is accepted, shown approximately)', ['north-america', 'united-states'], '40.741895,-73.989308', { name: 'United States', label: 'area_from_publisher', lat: 40.7, lng: -74 }],
  ['Poland forest on the Belarus border', ['eastern-europe', 'europe', 'poland'], '52.632534336150705, 23.78747071037753', { name: 'Poland', label: 'area_from_publisher' }],
  ['Phoenix, Arizona', ['arizona', 'north-america', 'united-states'], '33.4484367,-112.074141', { name: 'United States', label: 'area_from_publisher' }],
  ['Global only', ['global'], '', null],
  ['Global only, even with coordinates', ['global'], '-23.0, 30.2', null],
  ['a region only (Central Africa)', ['africa', 'central-africa'], '', null],
  ['an ocean and several countries, no coordinates', ['arctic-ocean', 'asia', 'australia', 'belgium', 'japan'], '', null],
  ['two countries, no coordinates', ['asia', 'china', 'east-asia', 'laos', 'southeast-asia'], '', null],
  ['two countries, coordinates inside the second', ['bangladesh', 'india', 'south-asia', 'asia'], '27.0, 78.0', { name: 'India', label: 'area_from_publisher' }],
  ['coordinates outside the tagged country fall back to the country', ['africa', 'south-africa'], '51.5, -0.1', { name: 'South Africa', label: 'country_from_publisher_tag' }],
  ['coordinates outside the tagged countries and two countries tagged: nothing', ['bangladesh', 'india'], '51.5, -0.1', null],
  ['no tags at all', [], '-23.0, 30.2', null],
];
for (const [name, slugs, coordinates, expected] of SAMPLE)
  test('sample post: ' + name, () => {
    const got = place(slugs, coordinates);
    if (!expected) return assert.equal(got, null);
    assert(got, 'expected a place');
    for (const [k, v] of Object.entries(expected)) assert.equal(got[k], v, k);
    assert.equal(got.precision, got.label === 'area_from_publisher' ? 'region' : 'country');
  });

test('coordinates are shown rounded to one decimal place and never 0/0', () => {
  const got = place(['south-africa'], '-34.19345120034275, 18.42170191462399');
  assert.deepEqual([got.lat, got.lng], [-34.2, 18.4]);
  assert.equal(place(['south-africa'], '0, 0')?.label, 'country_from_publisher_tag');
});

test('the country boxes cover every country the finder knows and contain its centre point', () => {
  const boxes = JSON.parse(readFileSync(new URL('../../server/country-boxes.json', import.meta.url), 'utf8')).countries;
  const src = readFileSync(new URL('../../server/publisher-location.ts', import.meta.url), 'utf8');
  const centres = [...src.matchAll(/\[(?:'([^']+)'|"([^"]+)"), (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)/g)].map(m => ({ name: m[1] ?? m[2], lat: +m[3], lng: +m[4] }));
  assert(centres.length > 180);
  for (const name of COUNTRY_NAMES) assert(boxes[name]?.length, 'no boxes for ' + name);
  // A few countries have a centre point that is not inside a land part (Maldives, Kiribati, Tonga and similar scattered islands); they are listed, not hidden.
  const exempt = new Set(['Kiribati', 'Maldives', 'Micronesia', 'Marshall Islands', 'Seychelles', 'Mauritius', 'Cabo Verde', 'Tonga', 'Fiji', 'Tuvalu', 'Samoa', 'Vanuatu', 'Solomon Islands', 'Bahamas', 'The Bahamas', 'Comoros', 'Sao Tome and Principe', 'Palau', 'Saint Lucia', 'Dominica', 'Antigua and Barbuda', 'Barbados', 'Grenada', 'Saint Kitts and Nevis', 'Saint Vincent and the Grenadines', 'Trinidad and Tobago', 'Malta', 'Singapore', 'Bahrain', 'Cook Islands']);
  const outside = centres.filter(c => boxes[c.name] && !insideCountry(c.name, c.lat, c.lng, boxes) && !exempt.has(c.name)).map(c => c.name);
  assert.deepEqual(outside, []);
});

test('combining headline and publisher places', () => {
  const tag = resolvePublisherPlace(tagsOf(['south-africa'], '-23.03, 30.29'));
  const country = { name: 'South Africa', lat: -30.6, lng: 22.9, precision: 'country' };
  assert.equal(combinePlaces(null, tag).place, tag);
  assert.equal(combinePlaces(country, null).place, country);
  assert.equal(combinePlaces(country, tag).place, tag, 'a publisher point inside the headline country is closer');
  assert.equal(combinePlaces(country, resolvePublisherPlace(tagsOf(['south-africa']))).place, country);
  const conflict = combinePlaces({ ...country, name: 'Zimbabwe' }, tag);
  assert.deepEqual([conflict.place, conflict.conflict], [null, true]);
  const area = { name: 'Klamath River area, US', lat: 41.5, lng: -124, precision: 'region' };
  assert.equal(combinePlaces(area, resolvePublisherPlace(tagsOf(['united-states']))).place, area, 'a curated map area wins');
});

const withTags = (flag, over = {}) => sources({ alpha: { id: 'alpha', displayName: 'Alpha News', domains: ['alpha.example.org'], enabled: true, publisherFeed: permission(flag === undefined ? over : { placeFromPublisherTags: flag, ...over }) } });
const build = (src, ctl, title, placeTags) => buildSnapshot(null, [{ sourceId: 'alpha', ok: true, candidates: [{ ...candidate('alpha', 'a', title), placeTags }] }], src, control(ctl), NOW);
const PLAIN = 'Bird hotspots remain outside protected areas';

test('the switch is off unless a source turns it on: tags change nothing', () => {
  const t = tagsOf(['south-africa'], '-23.03, 30.29');
  for (const src of [withTags(undefined), withTags(false)]) { const [item] = build(src, {}, PLAIN, t).items; assert.equal(item.locationPrecision, 'unknown'); assert.equal(item.lat, null); }
});

test('with the switch on, a point inside the tagged country becomes an approximate area pin that passes the public contract', () => {
  const src = withTags(true), ctl = control();
  const snap = build(src, {}, PLAIN, tagsOf(['africa', 'south-africa'], '-23.03, 30.29'));
  const [item] = snap.items;
  assert.deepEqual([item.location, item.lat, item.lng, item.locationPrecision], ['South Africa', -23, 30.3, 'region']);
  assert.deepEqual(item.labels.filter(l => l.includes('publisher')), ['area_from_publisher']); assert.equal(item.mapArea, undefined);
  const stories = projectPublisherFeed(snap, ctl, src, NOW).stories;
  assert.equal(stories.length, 1, 'the public contract accepts the card');
  const [story] = stories;
  assert(qualifierLabels(story).includes('Approximate pin: placed near the location the publisher gives for this story. It may be a nearby town or site, not the exact spot.'));
  assert(!qualifierLabels(story).join(' ').includes(item.location), 'the area label names no country, because the pin may sit just across a border');
});

test('with the switch on, a single country tag becomes a labelled country pin; global or several countries get none', () => {
  const src = withTags(true), ctl = control();
  const snap = build(src, {}, PLAIN, tagsOf(['asia', 'india', 'south-asia']));
  assert.deepEqual([snap.items[0].location, snap.items[0].locationPrecision], ['India', 'country']);
  const stories = projectPublisherFeed(snap, ctl, src, NOW).stories;
  assert.equal(stories.length, 1, 'the public contract accepts the card');
  const [story] = stories;
  assert(qualifierLabels(story).includes("Approximate pin: placed in India because the publisher tags this story with that country. The headline doesn't name a place."));
  for (const slugs of [['global'], ['bangladesh', 'india'], ['africa', 'central-africa']]) assert.equal(build(src, {}, PLAIN, tagsOf(slugs)).items[0].locationPrecision, 'unknown');
});

test('headline and tags: curated area wins, agreement uses the closer point, disagreement drops the pin, resolver off drops everything', () => {
  const src = withTags(true);
  const t = tagsOf(['south-africa'], '-23.03, 30.29');
  const [agree] = build(src, {}, 'Wetlands return in South Africa', t).items;
  assert.deepEqual([agree.location, agree.locationPrecision, agree.lat], ['South Africa', 'region', -23]);
  const [clash] = build(src, {}, 'Wetlands return in Kenya', t).items;
  assert.deepEqual([clash.locationPrecision, clash.lat], ['unknown', null]);
  const [off] = build(src, { locationResolver: 'off' }, PLAIN, t).items;
  assert.equal(off.locationPrecision, 'unknown');
  const snap = build(src, {}, PLAIN, t);
  const stories = projectPublisherFeed(snap, control({ locationResolver: 'off' }), src, NOW).stories;
  assert.equal(stories[0].lat, null); assert(!stories[0].labels.some(l => l.includes('publisher')));
});

test('a conflict does not fall back to the publisher home country', () => {
  const src = withTags(true, { defaultCountry: 'India' });
  assert.equal(build(src, {}, 'Wetlands return in Kenya', tagsOf(['south-africa'], '-23.03, 30.29')).items[0].locationPrecision, 'unknown');
});

test('the public contract refuses mixed or mismatched place labels', () => {
  const src = withTags(true), ctl = control();
  const snap = build(src, {}, PLAIN, tagsOf(['south-africa'], '-23.03, 30.29'));
  const shown = change => projectPublisherFeed({ ...snap, items: snap.items.map(i => ({ ...i, ...change(i) })) }, ctl, src, NOW).stories.length;
  assert.equal(shown(() => ({})), 1);
  assert.equal(shown(i => ({ labels: [...i.labels, 'country_from_headline'] })), 0, 'two place labels');
  assert.equal(shown(() => ({ locationPrecision: 'country' })), 0, 'a country pin cannot carry the area label');
  assert.equal(shown(i => ({ labels: i.labels.filter(l => l !== 'area_from_publisher') })), 0, 'a pin needs its label');
  assert.equal(shown(() => ({ lat: null, lng: null })), 0, 'a label without a pin');
  assert.equal(shown(() => ({ mapArea: { placeId: 'x', basis: 'title', referenceUrl: 'https://x.example', areaKm: 1 } })), 0, 'a publisher area has no curated map area');
});

test('the collector reads tags from a WordPress post and keeps them on the RSS row for the same URL', async () => {
  const now = '2026-10-15T12:00:00.000Z';
  const wp = [{ title: { rendered: 'Floods in Limpopo' }, link: 'https://alpha.example.org/a', date_gmt: '2026-10-14T17:10:52', excerpt: { rendered: '' }, byline: [], ...post(['africa', 'south-africa'], '-23.03, 30.29') }];
  const cfg = { id: 'alpha', allowedDomains: ['alpha.example.org'], topic: 'animals_nature', format: 'wordpress', bylineNames: {} };
  const [row] = parseFeed(JSON.stringify(wp), cfg, now);
  assert.deepEqual(row.placeTags, { slugs: ['africa', 'south-africa'], coordinates: { lat: -23.03, lng: 30.29 } });
  const rss = `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><item><title>Floods in Limpopo</title><link>https://alpha.example.org/a</link><pubDate>Wed, 14 Oct 2026 17:10:52 GMT</pubDate><dc:creator>Rss Writer</dc:creator></item></channel></rss>`;
  const fetcher = async url => ({ text: url.includes('wp-json') ? JSON.stringify(wp) : url.includes('byline') ? '[]' : rss });
  const result = await collectPublisherFeed({ ...cfg, format: undefined, url: 'https://alpha.example.org/feed', fetchPolicyRef: 'x', supplementalUrl: 'https://alpha.example.org/wp-json/wp/v2/posts', supplementalBylineUrl: 'https://alpha.example.org/wp-json/wp/v2/byline' }, now, fetcher, async () => {});
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].author, 'Rss Writer');
  assert.deepEqual(result.candidates[0].placeTags.slugs, ['africa', 'south-africa']);
});

test('no source uses the publisher place switch yet, and the metadata request does not ask for place fields', () => {
  const config = JSON.parse(readFileSync(new URL('../../config/feeds.json', import.meta.url), 'utf8'));
  for (const [id, source] of Object.entries(config.sources)) assert.notEqual(source.publisherFeed?.placeFromPublisherTags, true, id);
  for (const feed of config.feeds) if (feed.supplementalUrl) assert(!/class_list|coordinates|location/.test(feed.supplementalUrl), feed.id);
});

test('taggedCountries ignores regions and duplicates', () => {
  assert.deepEqual(taggedCountries(tagsOf(['asia', 'india', 'south-asia', 'india'])).map(c => c.name), ['India']);
  assert.deepEqual(taggedCountries(undefined), []);
});

test('only the two cleared Mongabay terms records list place tags and coordinates, and the About dialog carries the approved pin sentence', () => {
  const config = JSON.parse(readFileSync(new URL('../../config/feeds.json', import.meta.url), 'utf8'));
  const tagField = 'location tags (used only to place a pin; not shown as article text)';
  const pointField = 'publisher map coordinates (rounded to about 11 km; used only to place a pin)';
  for (const [id, source] of Object.entries(config.sources)) {
    const fields = source.publisherFeed?.permittedFields ?? [];
    const cleared = id === 'mongabay' || id === 'mongabay-upbeat';
    assert.equal(fields.includes(tagField) && fields.includes(pointField), cleared, id);
    if (cleared) assert(/GC reviewed 2026-10-15: location tags and coordinates are facts used only for pin placement, not a modification under CC BY-ND 4\.0\./.test(source.publisherFeed.notes), id);
  }
  const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
  assert(app.includes('Map pins are approximate. They come from a place named in the headline or from the location the publisher gives for the story, and each card says which.'));
});

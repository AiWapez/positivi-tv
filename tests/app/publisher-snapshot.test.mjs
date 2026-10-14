import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../../server/collect.mjs';
import { buildSnapshot, serializeSnapshot, shortSummary, headlineSimilarity } from '../../server/publisher-snapshot.ts';
import { NOW, DAY, ago, sources, feeds, control, rss, item, candidate } from './publisher-fixtures.mjs';
const ok = (sourceId, candidates) => ({ sourceId, ok: true, candidates });
const fail = (sourceId, code = 'HTTP_503') => ({ sourceId, ok: false, code });
const build = (results, previous = null, overrides = {}) => buildSnapshot(previous, results, overrides.sources ?? sources(), control(overrides.control), overrides.now ?? NOW);

test('invalid, missing, future and out-of-window dates drop single items without failing the batch', () => {
  const [alpha] = feeds();
  const xml = rss([item('alpha.example.org', 'good', 'Volunteers restore wetland'), item('alpha.example.org', 'bad', 'Town restores pond', { pubDate: 'not a date' }),
    item('alpha.example.org', 'none', 'Village opens library', { pubDate: '' }), item('alpha.example.org', 'future', 'Park opens', { pubDate: 'Tue, 01 Jan 2030 00:00:00 GMT' })]);
  const parsed = parseFeed(xml, alpha, NOW, 100);
  assert.deepEqual(parsed.map(c => c.title), ['Volunteers restore wetland']);
  const snap = build([ok('alpha', [...parsed, candidate('alpha', 'x', 'Village opens library', { publishedAt: 'nonsense' }), candidate('alpha', 'old', 'Village opens library', { publishedAt: ago(9) })])]);
  assert.equal(snap.items.length, 1);
  assert.equal(snap.sources.alpha.excluded.INVALID_DATE, 1); assert.equal(snap.sources.alpha.excluded.OUTSIDE_WINDOW, 1);
});

test('publication date, retrieval time and event date stay separate; nothing is filled with "now"', () => {
  const c = candidate('alpha', 'a', 'Volunteers restore wetland', { publishedAt: ago(2) });
  const [s] = build([ok('alpha', [c])]).items;
  assert.equal(s.publishedAt, ago(2)); assert.equal(s.fetchedAt, NOW); assert(!('eventDate' in s));
  assert(s.labels.includes('event_date_unconfirmed'));
  // A later run keeps the first retrieval time (retention clock) and the original publication date.
  const later = new Date(Date.parse(NOW) + DAY).toISOString();
  const [again] = build([ok('alpha', [c])], build([ok('alpha', [c])]), { now: later }).items;
  assert.equal(again.fetchedAt, NOW); assert.equal(again.publishedAt, ago(2)); assert.equal(again.lastSeenAt, later);
});

test('unsafe and off-domain links never enter the snapshot, and article links never widen the fetch allowlist', () => {
  const [alpha] = feeds();
  const xml = rss([item('alpha.example.org', 'ok', 'Volunteers restore wetland'), { ...item('x', 'y', 'Park opens'), link: 'javascript:alert(1)' },
    { ...item('x', 'y', 'Park opens'), link: 'http://alpha.example.org/articles/plain' }, { ...item('x', 'y', 'Park opens'), link: 'https://attacker.example/articles/a' },
    { ...item('x', 'y', 'Park opens'), link: 'https://user:pw@alpha.example.org/articles/b' }, { ...item('x', 'y', 'Park opens'), link: 'https://127.0.0.1/articles/c' }]);
  assert.deepEqual(parseFeed(xml, alpha, NOW, 100).map(c => c.url), ['https://alpha.example.org/articles/ok']);
  const snap = build([ok('alpha', [candidate('alpha', 'evil', 'Park opens', { url: 'https://beta.example.org/articles/evil' }), candidate('alpha', 'js', 'Park opens', { url: 'javascript:alert(1)' })])]);
  assert.equal(snap.items.length, 0); assert.equal(snap.sources.alpha.excluded.LINK_NOT_ALLOWED, 2);
  assert.deepEqual(alpha.allowedDomains, ['alpha.example.org']);
});

test('unknown location stays null with no pin and no 0/0', () => {
  const [s] = build([ok('alpha', [candidate('alpha', 'a', 'Volunteers restore wetland')])]).items;
  assert.equal(s.lat, null); assert.equal(s.lng, null); assert.equal(s.locationPrecision, 'unknown'); assert.equal(s.location, 'Location not specified');
  assert(!s.labels.includes('country_from_headline'));
  const [k] = build([ok('alpha', [candidate('alpha', 'k', 'Volunteers restore wetland in Kenya')])]).items;
  assert.equal(k.location, 'Kenya'); assert(k.labels.includes('country_from_headline')); assert.equal(k.locationPrecision, 'country');
  const [off] = build([ok('alpha', [candidate('alpha', 'k', 'Volunteers restore wetland in Kenya')])], null, { control: { locationResolver: 'off' } }).items;
  assert.equal(off.lat, null);
});

test('same URL merges; syndicated copies never add a count or corroboration and are hidden only with the same resolved country', () => {
  const original = candidate('alpha', 'orig', 'Volunteers restore coastal wetland in Kenya for migrating birds', { publishedAt: ago(2) });
  const syndicated = candidate('beta', 'copy', 'Volunteers restore coastal wetland in Kenya for migrating birds', { publishedAt: ago(1) });
  const repeat = { ...candidate('alpha', 'orig2', 'Volunteers restore coastal wetland in Kenya for migrating birds'), url: original.url };
  const snap = build([ok('alpha', [original, repeat]), ok('beta', [syndicated])]);
  assert.equal(snap.items.length, 1); assert.equal(snap.items[0].id, original.id, 'earliest publication kept as likely original');
  assert.equal(snap.duplicates.length, 2); assert(snap.duplicates.every(d => d.kept === original.id && d.shown === false));
  assert.deepEqual(Object.keys(snap.items[0]).sort(), ['category', 'fetchedAt', 'id', 'labels', 'lastSeenAt', 'lat', 'lng', 'location', 'locationPrecision', 'publishedAt', 'sourceId', 'summary', 'title', 'url', 'version']);
  const unlocated = build([ok('alpha', [candidate('alpha', 'l1', 'Community opens new public library', { publishedAt: ago(2) })]), ok('beta', [candidate('beta', 'l2', 'Community opens new public library')])]);
  assert.equal(unlocated.items.length, 2, 'two unlocated stories may be different towns, so both stay');
  assert(unlocated.duplicates.some(d => d.shown === true));
  for (const item of unlocated.items) assert.deepEqual(Object.keys(item).sort(), Object.keys(snap.items[0]).sort());
});

test('headline similarity proposes; only near-identical cross-source copies with the same location are hidden', () => {
  assert(headlineSimilarity('Volunteers restore coastal wetland for birds', 'Volunteers restore wetland for birds on coast') >= 0.6);
  const kenya = candidate('alpha', 'k', 'Volunteers plant 10,000 trees in Kenya', { publishedAt: ago(2) });
  const uganda = candidate('beta', 'u', 'Volunteers plant 10,000 trees in Uganda', { publishedAt: ago(1) });
  const distinct = build([ok('alpha', [kenya]), ok('beta', [uganda])]);
  assert.equal(distinct.items.length, 2, 'different resolved countries are different stories');
  assert(distinct.duplicates.some(d => d.basis === 'headline_similarity' && d.shown === true), 'recorded as a proposal only');
  const sameSource = build([ok('alpha', [candidate('alpha', 'm', 'Sea turtles hatch on protected beach in Mexico'), candidate('alpha', 'b', 'Sea turtles hatch on protected beach in Brazil')])]);
  assert.equal(sameSource.items.length, 2, 'one source publishing two similar stories keeps both');
  const a = candidate('alpha', 'a', 'Volunteers restore coastal wetland for migrating birds', { publishedAt: ago(6) });
  const b = candidate('beta', 'b', 'Volunteers restore coastal wetland for migrating birds', { publishedAt: ago(1) });
  assert.equal(build([ok('alpha', [a]), ok('beta', [b])]).items.length, 2, 'outside three days nothing is hidden');
  assert(headlineSimilarity('Rover sets record drive', 'Community opens shelter') < 0.6);
});

test('a headline corrected into an excluded one removes the old card instead of carrying it', () => {
  const first = build([ok('alpha', [candidate('alpha', 'w', 'Volunteers restore wetland')])]);
  const later = new Date(Date.parse(NOW) + 3600000).toISOString();
  const second = build([ok('alpha', [candidate('alpha', 'w', 'Wetland restoration halted after two volunteers killed')])], first, { now: later });
  assert.equal(second.items.length, 0); assert.equal(second.sources.alpha.carried, 0);
});

test('retention is applied when storing, and update-only or truncated items are not listed', () => {
  const short = sources({ alpha: { ...sources().alpha, publisherFeed: { ...sources().alpha.publisherFeed, retentionDays: 1 } } });
  const first = build([ok('alpha', [candidate('alpha', 'w', 'Volunteers restore wetland')])], null, { sources: short });
  const later = new Date(Date.parse(NOW) + 2 * DAY).toISOString();
  assert.equal(build([fail('alpha'), ok('beta', [])], first, { sources: short, now: later }).items.length, 0, 'carried items past retention are dropped');
  assert.equal(build([ok('alpha', [candidate('alpha', 'w', 'Volunteers restore wetland')])], first, { sources: short, now: later }).items.length, 0, 'still-listed items past retention are dropped');
  const snap = build([ok('alpha', [candidate('alpha', 'u', 'Volunteers restore wetland', { dateSource: 'updated' }), candidate('alpha', 't', 'Village opens library', { titleTruncated: true })])]);
  assert.equal(snap.items.length, 0); assert.equal(snap.sources.alpha.excluded.NO_PUBLICATION_DATE, 1); assert.equal(snap.sources.alpha.excluded.TITLE_TOO_LONG, 1);
  const [alpha] = feeds();
  const atom = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Village opens library</title><link href="https://alpha.example.org/articles/atom"/><updated>' + ago(1) + '</updated></entry></feed>';
  assert.equal(parseFeed(atom, alpha, NOW, 100)[0].dateSource, 'updated');
});

test('a failed source keeps its previous eligible items; a recovered source refreshes them', () => {
  const first = build([ok('alpha', [candidate('alpha', 'a', 'Volunteers restore wetland')]), ok('beta', [candidate('beta', 'b', 'Rover sets record drive')])]);
  const later = new Date(Date.parse(NOW) + 3600000).toISOString();
  const second = build([fail('alpha'), ok('beta', [candidate('beta', 'b', 'Rover sets record drive')])], first, { now: later });
  assert.deepEqual(second.items.map(i => i.id).sort(), ['alpha-a', 'beta-b']);
  assert.equal(second.sources.alpha.status, 'failed'); assert.equal(second.sources.alpha.carried, 1); assert.equal(second.sources.alpha.lastSuccessAt, NOW);
  // Carried items still age out of the window.
  const old = build([fail('alpha'), ok('beta', [])], first, { now: new Date(Date.parse(NOW) + 8 * DAY).toISOString() });
  assert.equal(old.items.length, 0);
});

test('versions are stable for unchanged content and increase when the headline changes', () => {
  const first = build([ok('alpha', [candidate('alpha', 'a', 'Volunteers restore wetland')])]);
  assert.equal(build([ok('alpha', [candidate('alpha', 'a', 'Volunteers restore wetland')])], first).items[0].version, 1);
  assert.equal(build([ok('alpha', [candidate('alpha', 'a', 'Volunteers restore a wetland')])], first).items[0].version, 2);
});

test('disabled sources and global caps bound the snapshot', () => {
  const disabled = sources({ alpha: { ...sources().alpha, publisherFeed: { ...sources().alpha.publisherFeed, enabled: false } } });
  const snap = build([ok('alpha', [candidate('alpha', 'a', 'Volunteers restore wetland')])], null, { sources: disabled });
  assert.equal(snap.items.length, 0); assert.equal(snap.sources.alpha.status, 'disabled');
  const titles = ['Volunteers restore wetland', 'Rover sets record drive', 'Community opens shelter', 'Teen wins championship', 'Village opens library', 'Bees return to meadow'];
  const many = titles.map((t, i) => candidate('alpha', 'n' + i, t));
  assert.equal(build([ok('alpha', many)], null, { control: { maxPerSource: 3 } }).items.length, 3);
});

test('summaries are stored only where terms allow; shortened at sentence boundaries', () => {
  const body = 'The rover drove farther than any before it. Engineers celebrated the milestone on Tuesday. More details follow in a long paragraph that keeps going well past the limit for a card summary and should never be cut in the middle of a sentence because that would misquote the source, which matters even more for public-domain text that readers may compare with the original page.';
  const snap = build([ok('alpha', [candidate('alpha', 'a', 'Volunteers restore wetland', { body })]), ok('beta', [candidate('beta', 'b', 'Rover sets record drive', { body })])]);
  const byId = Object.fromEntries(snap.items.map(i => [i.sourceId, i]));
  assert.equal(byId.alpha.summary, null, 'no-derivatives source: description is screened but never stored');
  assert.equal(byId.beta.summary, 'The rover drove farther than any before it. Engineers celebrated the milestone on Tuesday.');
  assert.equal(shortSummary('Too short.'), null);
});

test('snapshot serialization is size-bounded', () => {
  const snap = build([ok('alpha', [candidate('alpha', 'a', 'Volunteers restore wetland')])]);
  assert.doesNotThrow(() => serializeSnapshot(snap));
  assert.throws(() => serializeSnapshot({ ...snap, items: Array.from({ length: 501 }, () => snap.items[0]) }));
  assert.throws(() => serializeSnapshot({ ...snap, duplicates: [{ kept: 'x'.repeat(600 * 1024), suppressed: 'y', similarity: 1, basis: 'same_url' }] }));
});

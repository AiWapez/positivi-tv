import test from 'node:test';
import assert from 'node:assert/strict';
import { publishEdition } from '../../server/publish.ts';
import { buildFeed } from '../../src/lib/publication.ts';
import { applyHumanDecision } from '../../src/goodsignal/index.ts';
import { context, story, NOW } from '../goodsignal/fixtures.mjs';
const empty = () => ({ schemaVersion: 1, revision: 'empty', updatedAt: null, stories: [], statuses: {} });
const sources = () => Object.fromEntries(Object.entries(context().sources).map(([id,s]) => [id, { ...s, displayName: 'Synthetic publisher' }]));
const publish = (items = [story()], previous = empty()) => publishEdition(items, sources(), previous, NOW);
test('reviewed candidate projects through edition and public feed without private fields', () => {
  const publication = publish(), feed = buildFeed(publication, NOW);
  assert.equal(feed.stories.length, 1); assert.equal(feed.stories[0].sourceName, 'Synthetic publisher');
  assert.equal(feed.stories[0].sourceUrl, story().url); assert.equal(feed.manifest.stories[story().id].status, 'approved');
  for (const key of ['body','outcomeQuote','quantities','evidence','review','impact','expiresAt','policyVersion']) assert(!Object.hasOwn(feed.stories[0], key), key);
  assert(!JSON.stringify(publication).includes(story().body));
});
test('pending, forged approval without review, and plan-only records never publish', () => {
  for (const patch of [{ status: 'pending', review: undefined }, { review: undefined }, { stage: 'plan' }]) assert.equal(publish([story(patch)]).stories.length, 0);
});
test('no current news is an honest empty edition, not a synthetic fallback', () => {
  assert.equal(buildFeed(publish([]), NOW).stories.length, 0);
});
test('withdrawals and version changes remove queued cards and disable manifest status', () => {
  const publication = publish(); const id = story().id;
  publication.statuses[id] = { status: 'withdrawn', version: 2 };
  const feed = buildFeed(publication, NOW); assert.equal(feed.stories.length, 0); assert.equal(feed.manifest.stories[id].status, 'withdrawn');
  publication.statuses[id] = { status: 'approved', version: 2 }; assert.equal(buildFeed(publication, NOW).stories.length, 0);
});
test('rights expiry and event ageing are checked at request time', () => {
  const publication = publish(); const id = story().id;
  const time = new Date(Date.parse(NOW) + 100 * 86400000).toISOString();
  const feed = buildFeed(publication, time); assert.equal(feed.stories.length, 0); assert.equal(feed.manifest.stories[id].status, 'withdrawn');
  publication.stories[0].expiresAt = NOW; assert.equal(buildFeed(publication, NOW).stories.length, 0);
});
test('archived event remains labelled archive and keeps publication date distinct', () => {
  const s = story({ eventDate: { value: '2019', precision: 'year', basis: 'source', quote: '2019' } });
  const archived = applyHumanDecision(s, { ...s.review, action: 'archive' }, context());
  const feed = buildFeed(publish([archived]), NOW); assert.equal(feed.stories.length, 1); assert.equal(feed.stories[0].archive, true);
  assert.equal(feed.stories[0].eventDate, '2019'); assert.equal(feed.stories[0].publishedAt, s.publishedAt);
});
test('ambiguous geography stays in list data with no invented coordinates', () => {
  const feed = buildFeed(publish([story({ location: { kind: 'unknown', points: [] } })]), NOW);
  assert.equal(feed.stories[0].lat, null); assert.equal(feed.stories[0].lng, null);
});
test('old private workspace cannot resurrect a committed withdrawal', () => {
  const previous = publish(); previous.statuses[story().id] = { version: 2, status: 'withdrawn' }; previous.stories = [];
  assert.equal(publish([story()], previous).stories.length, 0);
});
test('unsafe URLs, unexpected images, and stale policies fail closed at delivery', () => {
  for (const patch of [{ sourceUrl: 'javascript:alert(1)' }, { image: 'https://example.org/image.jpg' }, { policyVersion: 'old' }]) {
    const publication = publish(); Object.assign(publication.stories[0], patch); assert.equal(buildFeed(publication, NOW).stories.length, 0);
  }
});

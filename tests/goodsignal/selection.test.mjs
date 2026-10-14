import test from 'node:test';
import assert from 'node:assert/strict';
import { composeEdition, selectPersonalFeed, freshness, dateBounds, DAY } from '../../src/goodsignal/index.ts';
import { context, story, pool, NOW } from './fixtures.mjs';

test('every allocation preserves event, URL, and ID uniqueness', () => {
  const ps = pool(); ps.push(story({ id: 'duplicate', clusterId: ps[0].clusterId, humanStory: true, impact: 1 }));
  const e = composeEdition(ps, context());
  assert.equal(new Set(e.stories.map(s => s.clusterId)).size, e.stories.length);
  assert.equal(new Set(e.stories.map(s => s.id)).size, e.stories.length);
  assert.equal(new Set(e.stories.map(s => s.url)).size, e.stories.length);
});
test('regional and human allocations share the approval gate', () => {
  const ps = pool(12).map(s => ({ ...s, humanStory: true, review: undefined }));
  assert.equal(composeEdition(ps, context()).stories.length, 0);
});
test('small editions never overflow floors', () => {
  assert.equal(composeEdition(pool(), context(), { size: 1 }).stories.length, 1);
  assert.equal(composeEdition(pool(), context(), { size: 0 }).stories.length, 0);
});
test('supply shortages report coverage gaps without fabricating stories', () => {
  const e = composeEdition([story()], context());
  assert.equal(e.stories.length, 1); assert(e.coverageGaps.includes('africa')); assert(e.coverageGaps.includes('oceania'));
});
test('thin single-publisher supply relaxes caps explicitly', () => {
  const e = composeEdition(pool(15).map(s => ({ ...s, sourceId: 'source-0', url: 'https://source-0.example.org/articles/' + s.id })), context(), { size: 10 });
  assert.equal(e.stories.length, 10); assert(e.relaxations.includes('source'));
});
test('duplicate IDs with conflicting versions are conservatively excluded', () => {
  const s = story(); assert.equal(composeEdition([s, { ...s, version: 2 }], context()).stories.length, 0);
});
test('stale events do not backfill the recent edition', () => {
  assert.equal(composeEdition([story({ eventDate: { value: '2019', precision: 'year', basis: 'source', quote: '2019' } })], context()).stories.length, 0);
});
test('freshness uses earliest plausible event time', () => {
  const s = story({ eventDate: { value: '2026-10', precision: 'month', basis: 'reviewer' } });
  const days = (Date.parse(NOW) - dateBounds(s.eventDate).start) / DAY;
  assert.equal(freshness(s, NOW), 2 ** (-days / 10));
});
test('hidden secondary topic stays excluded even in discovery', () => {
  const s = story({ topics: ['education', 'health_medicine'] });
  assert.equal(selectPersonalFeed([s], context(), { hiddenTopics: ['health_medicine'], discovery: true }).stories.length, 0);
});
test('source, ID, and selected-topic filters apply before ranking', () => {
  assert.equal(selectPersonalFeed([story()], context(), { blockedSources: ['source-0'] }).stories.length, 0);
  assert.equal(selectPersonalFeed([story()], context(), { hiddenIds: ['story-0'] }).stories.length, 0);
  assert.equal(selectPersonalFeed([story()], context(), { onlyTopics: ['arts_culture'] }).stories.length, 0);
});
test('seen high-affinity story cannot beat an unseen low-affinity story', () => {
  const seen = story({ id: 'seen', impact: 1, topics: ['science_space'] });
  const unseen = story({ id: 'unseen', impact: 0, topics: ['education'] });
  const p = { affinity: { science_space: 1, education: .2 }, seenClusters: { [seen.clusterId]: '2026-10-01T00:00:00Z' } };
  const result = selectPersonalFeed([seen, unseen], context(), p, { replay: true, size: 2 });
  assert.deepEqual(result.stories.map(s => s.id), ['unseen', 'seen']);
});
test('another publisher of a seen event is still seen', () => {
  const s = story();
  assert.equal(selectPersonalFeed([s], context(), { seenClusters: { [s.clusterId]: NOW } }).stories.length, 0);
});
test('cold start preserves incoming edition order', () => {
  const ps = pool(8).reverse();
  assert.deepEqual(selectPersonalFeed(ps, context(), {}, { size: 8 }).stories.map(s => s.id), ps.map(s => s.id));
});
test('selection is reproducible and input records are untouched', () => {
  const ps = pool(), before = structuredClone(ps);
  assert.deepEqual(composeEdition(ps, context()), composeEdition(ps, context()));
  assert.deepEqual(ps, before);
});
test('bad configuration throws rather than producing an unbounded list', () => {
  assert.throws(() => composeEdition(pool(), context(), { size: Infinity }));
  assert.throws(() => selectPersonalFeed(pool(), context(), {}, { size: -1 }));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTour, scheduleChannel, currentSegment, makeManifest, checkBeforeDisplay, tickerStories, cardDuration, withdrawStory, reviseStory, publicCard } from '../../src/goodsignal/index.ts';
import { story, pool, context, NOW } from './fixtures.mjs';

test('opening morning preference cannot select outside the first three', () => {
  const ps = pool(); ps.at(-1).location.points[0].lng = -10;
  assert(ps.slice(0, 3).some(s => s.id === buildTour(ps, context())[0].id));
});
test('every choice respects the window and a twice-passed item plays next', () => {
  const ps = pool(50), tour = buildTour(ps, context()), remaining = [...ps], waits = new Map();
  for (const selected of tour) {
    const window = remaining.slice(0, 3), forced = window.find(s => (waits.get(s.id) ?? 0) >= 2);
    assert(window.some(s => s.id === selected.id));
    if (forced) assert.equal(selected.id, forced.id);
    for (const s of window) if (s.id !== selected.id) waits.set(s.id, (waits.get(s.id) ?? 0) + 1);
    remaining.splice(remaining.findIndex(s => s.id === selected.id), 1);
  }
  assert.equal(remaining.length, 0);
});
test('global-only and unknown-only tours keep all stories', () => {
  for (const kind of ['global', 'unknown']) {
    const ps = pool(9).map(s => ({ ...s, location: { kind, points: [] } }));
    assert.equal(buildTour(ps, context()).length, 9);
    assert(scheduleChannel(ps, context()).every(s => s.view === 'pulled_back'));
  }
});
test('a cycle has no repeated event, including syndicated stories', () => {
  const ps = pool(12); ps.push(story({ id: 'syndicated', clusterId: ps[0].clusterId }));
  const tour = buildTour(ps, context());
  assert.equal(tour.length, 12); assert.equal(new Set(tour.map(s => s.clusterId)).size, tour.length);
});
test('continuous playback repeats only after each complete cycle', () => {
  const schedule = scheduleChannel(pool(5), context(), { hours: .1, continuous: true });
  for (const cycle of new Set(schedule.map(s => s.cycle))) {
    const slots = schedule.filter(s => s.cycle === cycle);
    assert.equal(new Set(slots.map(s => s.clusterId)).size, slots.length);
  }
  assert(schedule.some(s => s.cycle > 0));
});
test('noncontinuous playback ends after one slate', () => assert.equal(scheduleChannel(pool(5), context()).length, 5));
test('two viewers at the same UTC time resolve the same slot', () => {
  const schedule = scheduleChannel(pool(), context());
  const t = new Date(Date.parse(NOW) + 100_000).toISOString();
  assert.deepEqual(currentSegment(schedule, t), currentSegment(schedule, t));
  assert.equal(currentSegment(schedule, schedule[0].endsAt).storyId, schedule[1].storyId);
});
test('a withdrawn queued story cannot start with an updated manifest', () => {
  const s = story(), segment = scheduleChannel([s], context())[0];
  assert.equal(checkBeforeDisplay(segment, makeManifest([withdrawStory(s)], context(), 'v2'), NOW).allowed, false);
});
test('corrected pending version invalidates an older scheduled item', () => {
  const s = story(), segment = scheduleChannel([s], context())[0];
  const revised = reviseStory(s, { summary: 'Corrected pending summary' });
  assert.equal(revised.review, undefined); assert.equal(revised.version, 2);
  assert.equal(checkBeforeDisplay(segment, makeManifest([revised], context(), 'v2'), NOW).allowed, false);
});
test('stale, future, or absent manifests fail closed', () => {
  const segment = scheduleChannel([story()], context())[0], m = makeManifest([story()], context(), 'v1');
  for (const manifest of [null, { ...m, generatedAt: '2026-10-14T07:29:00Z' }, { ...m, generatedAt: '2026-10-14T07:31:00Z' }])
    assert.equal(checkBeforeDisplay(segment, manifest, NOW).allowed, false);
  assert.equal(checkBeforeDisplay(segment, m, NOW).allowed, true);
});
test('version mismatch fails even if an updated story is approved', () => {
  const segment = scheduleChannel([story()], context())[0];
  const m = makeManifest([story({ version: 2 })], context(), 'v2');
  assert.equal(checkBeforeDisplay(segment, m, NOW).reason, 'VERSION_CHANGED');
});
test('ticker excludes current and next events and withdrawn IDs', () => {
  const ps = pool(6), schedule = scheduleChannel(ps, context());
  const result = tickerStories(ps, schedule, context({ withdrawnIds: [ps[3].id] }));
  assert(!result.some(s => [schedule[0].clusterId, schedule[1].clusterId].includes(s.clusterId)));
  assert(!result.some(s => s.id === ps[3].id));
});
test('public cards omit article text, review notes, and evidence quotations', () => {
  const card = publicCard(story(), context());
  for (const key of ['body', 'review', 'evidence', 'outcomeQuote', 'quantities']) assert.equal(Object.hasOwn(card, key), false);
});
test('global cards stay worldwide, invalid geometry becomes unknown', () => {
  assert.equal(publicCard(story({ location: { kind: 'global', points: [] } }), context()).location.kind, 'global');
  assert.equal(publicCard(story({ location: { kind: 'city', points: [{ name: 'x', lat: 150, lng: 0, precisionKm: 0 }] } }), context()).location.kind, 'unknown');
});
test('public projection applies current approval and source permissions', () => {
  assert.throws(() => publicCard(story({ status: 'pending' }), context()));
  assert.throws(() => publicCard(story(), context({ withdrawnIds: ['story-0'] })));
});
test('reading time has a useful minimum and a bounded maximum', () => {
  assert.equal(cardDuration(story({ summary: 'Short.' })), 20);
  assert.equal(cardDuration(story({ summary: 'Word '.repeat(2000) })), 45);
});

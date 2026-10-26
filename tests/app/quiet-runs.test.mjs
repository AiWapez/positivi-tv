import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSnapshot } from '../../server/publisher-snapshot.ts';
import { buildRunReport } from '../../server/run-report.ts';
import { quietSourceLines } from '../../server/publisher-refresh.ts';
import { projectPublisherFeed, STREAK_LIMIT } from '../../src/lib/publisher-feed.ts';
import { NOW, DAY, sources, control, candidate, permission } from './publisher-fixtures.mjs';

// Quiet-source counts (Security Lead, October 26, 2026). Synthetic sources and invented headlines only.
const GOOD = 'Volunteers restore wetland in Kenya';
const ok = (sourceId, candidates = []) => ({ sourceId, ok: true, candidates });
const fail = (sourceId, code = 'HTTP_503') => ({ sourceId, ok: false, code });
const at = days => new Date(Date.parse(NOW) + days * DAY).toISOString();
const build = (results, previous = null, now = NOW, srcs = sources()) => buildSnapshot(previous, results, srcs, control(), now);
const withQuiet = (snapshot, id, fields) => ({ ...snapshot, sources: { ...snapshot.sources, [id]: { ...snapshot.sources[id], ...fields } } });

test('quietRuns counts runs in a row that reached the feed but found nothing, and starts again at 0 when items return', () => {
  let snap = build([ok('alpha'), ok('beta', [candidate('beta', 'b1', GOOD)])]);
  assert.equal(snap.sources.alpha.quietRuns, 1);
  assert.equal(snap.sources.beta.quietRuns, 0);
  snap = build([ok('alpha'), ok('beta', [candidate('beta', 'b1', GOOD)])], snap, at(1));
  assert.equal(snap.sources.alpha.quietRuns, 2);
  snap = build([ok('alpha', [candidate('alpha', 'a1', GOOD)]), ok('beta')], snap, at(2));
  assert.equal(snap.sources.alpha.quietRuns, 0);
  assert.equal(snap.sources.beta.quietRuns, 1);
});

test('unreachedRuns counts runs in a row that could not reach the feed and does not mix with quietRuns', () => {
  let snap = build([fail('alpha'), ok('beta')]);
  assert.equal(snap.sources.alpha.unreachedRuns, 1); assert.equal(snap.sources.alpha.quietRuns, 0);
  assert.equal(snap.sources.beta.unreachedRuns, 0); assert.equal(snap.sources.beta.quietRuns, 1);
  snap = build([fail('alpha'), ok('beta')], snap, at(1));
  assert.equal(snap.sources.alpha.unreachedRuns, 2);
  snap = build([ok('alpha'), ok('beta')], snap, at(2));
  assert.equal(snap.sources.alpha.unreachedRuns, 0); assert.equal(snap.sources.alpha.quietRuns, 1);
});

test('a switched-off source holds both counts at 0', () => {
  const off = sources({ alpha: { ...sources().alpha, enabled: false } });
  const first = build([ok('alpha'), ok('beta')]);
  const snap = build([ok('alpha'), ok('beta')], withQuiet(first, 'alpha', { quietRuns: 5, unreachedRuns: 5 }), at(1), off);
  assert.equal(snap.sources.alpha.status, 'disabled');
  assert.equal(snap.sources.alpha.quietRuns, 0); assert.equal(snap.sources.alpha.unreachedRuns, 0);
});

test('a stored count is used only as a whole number from 0 to 10,000, and it never grows past 10,000', () => {
  const first = build([ok('alpha'), ok('beta')]);
  const start = value => build([ok('alpha'), ok('beta')], withQuiet(first, 'alpha', { quietRuns: value }), at(1)).sources.alpha.quietRuns;
  assert.equal(start(41), 42);
  assert.equal(start(0), 1);
  assert.equal(start(STREAK_LIMIT), STREAK_LIMIT, 'capped');
  assert.equal(start(STREAK_LIMIT - 1), STREAK_LIMIT);
  for (const bad of [-1, 1.5, STREAK_LIMIT + 1, 1e308, Infinity, NaN, '5', '', null, true, [], {}, undefined])
    assert.equal(start(bad), 1, `${JSON.stringify(bad)} counts as 0`);
  const startUnreached = value => build([fail('alpha'), ok('beta')], withQuiet(first, 'alpha', { unreachedRuns: value }), at(1)).sources.alpha.unreachedRuns;
  assert.equal(startUnreached(7), 8); assert.equal(startUnreached('9'), 1); assert.equal(startUnreached(STREAK_LIMIT + 1), 1);
});

test('a snapshot from another policy version starts every count again', () => {
  const first = build([ok('alpha'), ok('beta')]);
  const older = { ...withQuiet(first, 'alpha', { quietRuns: 9, unreachedRuns: 9 }), policy: 'publisher-feed-0.0.1' };
  const snap = build([ok('alpha'), ok('beta')], older, at(1));
  assert.equal(snap.sources.alpha.quietRuns, 1); assert.equal(snap.sources.alpha.unreachedRuns, 0);
});

test('the counts never change which stories are listed, carried or picked', () => {
  const picked = candidate('beta', '0123456789abcdef01234567', 'Wetland group plans new reserve in Kenya');
  const ctl = { pickedStories: [{ id: picked.id, approvedAt: '2026-10-14', approvedBy: 'Alex' }] };
  const results = day => [ok('alpha', [candidate('alpha', 'a1', GOOD)]), day === 0 ? ok('beta', [picked, candidate('beta', 'b1', GOOD)]) : ok('beta')];
  const base = buildSnapshot(null, results(0), sources(), control(ctl), NOW);
  assert(base.items.some(i => i.picked), 'the pick is listed on the first run');
  const calm = withQuiet(withQuiet(base, 'alpha', { quietRuns: 0, unreachedRuns: 0 }), 'beta', { quietRuns: 0, unreachedRuns: 0 });
  const loud = withQuiet(withQuiet(base, 'alpha', { quietRuns: 10000, unreachedRuns: 10000 }), 'beta', { quietRuns: 3, unreachedRuns: 'junk' });
  // Next run: beta's feed is empty, so its items are carried. The stored counts differ and nothing else does.
  const nextCalm = buildSnapshot(calm, results(1), sources(), control(ctl), at(1));
  const nextLoud = buildSnapshot(loud, results(1), sources(), control(ctl), at(1));
  assert(nextCalm.items.length >= 2);
  assert.deepEqual(nextLoud.items, nextCalm.items, 'same stored stories');
  assert.equal(nextLoud.revision, nextCalm.revision);
  // The public list read from two snapshots that differ only in the counts is identical.
  const publicList = snap => projectPublisherFeed(snap, control(ctl), sources(), at(1));
  assert.deepEqual(publicList(loud), publicList(calm));
  assert.deepEqual(publicList(nextLoud), publicList(nextCalm));
});

test('the run report shows both counts as plain numbers and nothing else about them', () => {
  const first = build([ok('alpha'), fail('beta')]);
  const second = build([ok('alpha'), fail('beta')], first, at(1));
  const report = buildRunReport({ snapshot: second, status: 'ok' }, control(), sources());
  assert.equal(report.sources.alpha.quietRuns, 2); assert.equal(report.sources.alpha.unreachedRuns, 0);
  assert.equal(report.sources.beta.quietRuns, 0); assert.equal(report.sources.beta.unreachedRuns, 2);
  assert.equal(report.sources.beta.collection, 'not reached');
  const bad = withQuiet(second, 'alpha', { quietRuns: -4, unreachedRuns: '7' });
  const cleaned = buildRunReport({ snapshot: bad, status: 'ok' }, control(), sources());
  assert.equal(cleaned.sources.alpha.quietRuns, 0); assert.equal(cleaned.sources.alpha.unreachedRuns, 0);
});

test('a label-only source never appears in the report or the log line, whatever its counts are', () => {
  const labelOnly = sources({ alpha: { ...sources().alpha, publisherFeed: permission({ labelOnly: true, labelOnlySince: '2026-10-23', teachingDescription: true }) } });
  let snap = build([ok('alpha'), ok('beta')], null, NOW, labelOnly);
  snap = build([ok('alpha'), ok('beta')], snap, at(1), labelOnly);
  assert.equal(snap.sources.alpha.quietRuns, 2, 'counted privately');
  const report = buildRunReport({ snapshot: snap, status: 'ok' }, control(), labelOnly);
  assert.equal(report.sourcesInTesting, 1);
  assert(!('alpha' in report.sources));
  assert(!JSON.stringify(report).includes('alpha'));
  assert.deepEqual(quietSourceLines(snap, labelOnly).filter(l => l.includes('alpha')), []);
  // Even if the source's setting were missing, the snapshot's own label-only count keeps it out.
  const marked = withQuiet(snap, 'alpha', { labelOnly: 2 });
  assert.deepEqual(quietSourceLines(marked, sources()).filter(l => l.includes('alpha')), []);
});

test('the log line is counts only and appears only after two quiet or unreached runs in a row', () => {
  let snap = build([ok('alpha'), fail('beta')]);
  assert.deepEqual(quietSourceLines(snap, sources()), []);
  snap = build([ok('alpha'), fail('beta')], snap, at(1));
  const lines = quietSourceLines(snap, sources());
  assert.deepEqual(lines, ['quiet source: alpha quietRuns=2 unreachedRuns=0', 'quiet source: beta quietRuns=0 unreachedRuns=2']);
  for (const line of lines) assert(!/http|\.org|\.com|HTTP_|[0-9a-f]{24}/.test(line), 'no host, code or story id');
});

test('the docs record the counts and that a policy-version change resets them', async () => {
  const doc = await readFile(new URL('../../docs/publisher-feed.md', import.meta.url), 'utf8');
  assert(/quietRuns/.test(doc) && /unreachedRuns/.test(doc));
  assert(/policy.version change starts a fresh snapshot/i.test(doc));
});

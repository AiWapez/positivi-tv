import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSnapshot } from '../../server/publisher-snapshot.ts';
import { buildRunReport } from '../../server/run-report.ts';
import { projectPublisherFeed, isLabelOnly } from '../../src/lib/publisher-feed.ts';
import { NOW, sources, control, candidate, permission } from './publisher-fixtures.mjs';

// Label-only mode (General Counsel, October 23, 2026). Synthetic sources and invented headlines only.
const GOOD = 'Volunteers restore wetland in Kenya';       // the rules list this
const BAD = 'Three killed in bus crash near capital';     // a hard ban
const SOFT = 'Wetland group plans new reserve in Kenya';  // held back only for a mild reason
const labelOnlySources = (value = true) => sources({ alpha: { ...sources().alpha, publisherFeed: permission({ labelOnly: value, labelOnlySince: '2026-10-23', teachingDescription: true }) } });
const run = (srcs, cands, ctl = {}, previous = null) => {
  const seen = [];
  const snapshot = buildSnapshot(previous, [{ sourceId: 'alpha', ok: true, candidates: cands.alpha ?? [] }, { sourceId: 'beta', ok: true, candidates: cands.beta ?? [] }],
    srcs, control(ctl), NOW, undefined, (record, body) => seen.push({ record, body }));
  return { snapshot, seen };
};
const alpha = (slug, title) => candidate('alpha', slug, title);

test('a label-only source is screened and sent to the teaching batch, but nothing from it is ever listed', () => {
  const { snapshot, seen } = run(labelOnlySources(), { alpha: [alpha('a1', GOOD), alpha('a2', BAD), alpha('a3', SOFT)] });
  assert.equal(snapshot.items.length, 0);
  assert.equal(snapshot.sources.alpha.listed, 0);
  assert.equal(snapshot.sources.alpha.labelOnly, 3);
  assert.equal(seen.length, 3, 'all three reached the observer that feeds the private batch');
  assert.deepEqual(seen.map(s => s.record.decision).sort(), ['exclude', 'exclude', 'list']);
  assert(seen.find(s => s.record.decision === 'list'), 'the story the rules would list is still recorded as a list decision');
  assert(seen.every(s => s.body === 'Synthetic description.'), 'the private description is kept for the batch');
});

test('other sources in the same run are unaffected', () => {
  const { snapshot } = run(labelOnlySources(), { alpha: [alpha('a1', GOOD)], beta: [candidate('beta', 'b1', 'Rover sets record drive')] });
  assert.deepEqual(snapshot.items.map(i => i.sourceId), ['beta']);
  assert.equal(snapshot.sources.beta.labelOnly, undefined);
});

test('a pick for a label-only story is refused, and the same pick works once the source is normal', () => {
  const id = 'alpha-' + 'ab12cd34ef56ab12cd34ef56';
  const pick = { id, approvedAt: '2026-10-23', approvedBy: 'Alex' };
  const cand = candidate('alpha', 'soft', SOFT, { id });
  assert.equal(run(labelOnlySources(), { alpha: [cand] }, { pickedStories: [pick] }).snapshot.items.length, 0);
  assert.equal(run(sources(), { alpha: [cand] }, { pickedStories: [pick] }).snapshot.items.length, 1, 'control: without label-only the pick lists');
});

test('items already stored for a source are not carried once it is label-only', () => {
  const first = run(sources(), { alpha: [alpha('a1', GOOD)] }).snapshot;
  assert.equal(first.items.length, 1);
  const later = run(labelOnlySources(), { alpha: [] }, {}, first).snapshot;
  assert.equal(later.items.length, 0);
});

test('the public view drops a row from a label-only source even if an older snapshot holds one', () => {
  const stored = run(sources(), { alpha: [alpha('a1', GOOD)] }).snapshot;
  assert.equal(projectPublisherFeed(stored, control(), sources(), NOW).stories.length, 1, 'control: normal source is shown');
  assert.equal(projectPublisherFeed(stored, control(), labelOnlySources(), NOW).stories.length, 0);
});

test('only an absent value or exactly false is public; a malformed value stays private', () => {
  assert.equal(isLabelOnly(undefined), false);
  assert.equal(isLabelOnly({}), false);
  assert.equal(isLabelOnly({ labelOnly: false }), false);
  for (const value of [true, 'true', 'false', 1, 0, null, 'yes']) assert.equal(isLabelOnly({ labelOnly: value }), true, String(value));
  const stored = run(sources(), { alpha: [alpha('a1', GOOD)] }).snapshot;
  assert.equal(projectPublisherFeed(stored, control(), labelOnlySources('true'), NOW).stories.length, 0, 'the string "true" still keeps it private');
  assert.equal(run(labelOnlySources('true'), { alpha: [alpha('a1', GOOD)] }).snapshot.items.length, 0);
});

test('the run report never names a label-only source: one neutral count, no per-source numbers', () => {
  const { snapshot } = run(labelOnlySources(), { alpha: [alpha('a1', GOOD), alpha('a2', BAD)], beta: [candidate('beta', 'b1', 'Rover sets record drive')] });
  const report = buildRunReport({ snapshot, status: 'ok' }, control(), labelOnlySources());
  assert.equal(report.sourcesInTesting, 1);
  assert.equal('alpha' in report.sources, false, 'the source in testing is not named');
  assert.equal(report.sources.beta.listed, 1);
  assert.equal('labelOnly' in report.sources.beta, false, 'no per-source label-only line');
  assert(!report.paused.sources.includes('alpha'));
  const text = JSON.stringify(report);
  assert(!text.includes('alpha') && !text.includes('wetland') && !text.includes('http'), 'no name, no text, no link');
  // Once the source leaves the mode it is named again, with its ordinary counts.
  const left = buildRunReport({ snapshot: run(labelOnlySources(false), { alpha: [alpha('a1', GOOD)] }).snapshot, status: 'ok' }, control(), labelOnlySources(false));
  assert.equal(left.sourcesInTesting, 0);
  assert.equal(left.sources.alpha.listed, 1);
});

test('every source in the live config that is label-only records the date it entered the mode', async () => {
  const feeds = JSON.parse(await readFile(new URL('../../config/feeds.json', import.meta.url), 'utf8'));
  for (const [id, source] of Object.entries(feeds.sources)) {
    const p = source.publisherFeed;
    if (!isLabelOnly(p)) continue;
    assert(typeof p.labelOnlySince === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.labelOnlySince) && Number.isFinite(Date.parse(p.labelOnlySince + 'T00:00:00Z')), `${id} needs labelOnlySince`);
  }
});

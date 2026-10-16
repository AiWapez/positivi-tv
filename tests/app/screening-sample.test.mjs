import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runPublisherRefresh, screeningLogActive, screeningLogLines, SCREENING_LOG_PREFIX, SCREENING_LOG_CHUNK } from '../../server/publisher-refresh.ts';
import { buildSnapshot } from '../../server/publisher-snapshot.ts';
import { createPublisherStore } from '../../server/publisher-store.ts';
import { NOW, ago, sources, feeds, control, rss, item, candidate, fakeFetcher, memoryBlob } from './publisher-fixtures.mjs';

const xml = {
  'https://alpha.example.org/feed/': rss([item('alpha.example.org', 'wetland', 'Volunteers restore wetland in Kenya'), item('alpha.example.org', 'crash', 'Three killed in bus crash')]),
  'https://beta.example.org/feed/': rss([item('beta.example.org', 'rover', 'Rover sets record drive', { description: 'The rover drove farther than any rover before it on Mars. Engineers celebrated the milestone.' })]),
};
const record = n => ({ id: `r-${n}`, source: 'alpha', url: `https://alpha.example.org/a/${n}`, title: `Title ${n}`, published: NOW, summary: null, decision: 'list', reasons: [], labels: [], category: 'Planet' });
async function run(overrides, log) {
  const store = createPublisherStore(memoryBlob()), { fetcher } = fakeFetcher(xml);
  return runPublisherRefresh({ feeds: feeds(), sources: sources(), control: control(overrides), store, fetcher, now: () => NOW, log });
}
const results = () => [
  { sourceId: 'alpha', ok: true, candidates: [
    candidate('alpha', 'good', 'Volunteers restore wetland in Kenya', { body: 'Alpha description that must never be logged.' }),
    candidate('alpha', 'bad', 'Three killed in bus crash'),
    candidate('alpha', 'old', 'Volunteers replant kelp forest', { publishedAt: ago(30) }),
    candidate('alpha', 'nodate', 'Volunteers plant trees', { dateSource: 'updated' }),
  ] },
  { sourceId: 'beta', ok: true, candidates: [candidate('beta', 'rover', 'Rover sets record drive', { body: 'The rover drove farther than any rover before it on Mars. Engineers celebrated the milestone.' })] },
];

test('the screening sample is off unless the date is valid and still ahead', () => {
  const on = value => screeningLogActive(control({ screeningLogUntil: value }), NOW);
  assert.equal(on('2026-10-15'), true);
  assert.equal(on('2026-10-14'), false, 'midnight at the start of that date has already passed');
  for (const bad of [undefined, null, '', 'tomorrow', '2026-10-15T00:00:00Z', '20261015', 20261015, true, '2026-13-45']) assert.equal(on(bad), false, String(bad));
  assert.equal(screeningLogActive(control({ screeningLogUntil: '2026-10-15' }), 'not a date'), false);
});

test('the observer sees each candidate that reached the headline rules, and changes nothing', () => {
  const seen = [];
  const withObserver = buildSnapshot(null, results(), sources(), control(), NOW, undefined, r => seen.push(r));
  const without = buildSnapshot(null, results(), sources(), control(), NOW);
  assert.deepEqual(withObserver, without);
  assert.deepEqual(seen.map(r => [r.id, r.decision]).sort((a, b) => a[0].localeCompare(b[0])), [['alpha-bad', 'exclude'], ['alpha-good', 'list'], ['beta-rover', 'list']],
    'candidates outside the window or without a publication date never reach the rules and are not recorded');
  assert(seen.find(r => r.id === 'alpha-bad').reasons.includes('HARM_EVENT'));
  assert.equal(seen.find(r => r.id === 'alpha-good').summary, null, 'a source that does not store summaries never has one recorded');
  assert.match(seen.find(r => r.id === 'beta-rover').summary, /rover drove farther/);
  assert(!JSON.stringify(seen).includes('must never be logged'));
  for (const r of seen) assert.deepEqual(Object.keys(r).sort(), ['category', 'decision', 'id', 'labels', 'published', 'reasons', 'source', 'summary', 'title', 'url']);
});

test('an observer that throws cannot change or break the snapshot', () => {
  const plain = buildSnapshot(null, results(), sources(), control(), NOW);
  assert.deepEqual(buildSnapshot(null, results(), sources(), control(), NOW, undefined, () => { throw new Error('boom'); }), plain);
});

test('log lines are short chunks with a stable prefix and shape', () => {
  const records = Array.from({ length: 12 }, (_, n) => record(n));
  const lines = screeningLogLines(records, NOW);
  assert.equal(lines.length, 3); assert.equal(SCREENING_LOG_CHUNK, 5);
  lines.forEach((line, i) => {
    assert(line.startsWith(SCREENING_LOG_PREFIX + ' '));
    const body = JSON.parse(line.slice(SCREENING_LOG_PREFIX.length + 1));
    assert.equal(body.run, NOW); assert.equal(body.part, i + 1); assert.equal(body.of, 3); assert.equal(body.total, 12);
    assert(body.records.length <= SCREENING_LOG_CHUNK);
  });
  assert.deepEqual(lines.flatMap(l => JSON.parse(l.slice(SCREENING_LOG_PREFIX.length + 1)).records.map(r => r.id)), records.map(r => r.id));
  assert.deepEqual(screeningLogLines([], NOW), []);
});

test('a scheduled run writes the sample only while the switch is on, and never logs a non-storable description', async () => {
  const off = [], expired = [], on = [];
  assert.equal((await run({}, line => off.push(line))).code, 200);
  assert.equal((await run({ screeningLogUntil: '2026-10-14' }, line => expired.push(line))).code, 200);
  assert.equal((await run({ screeningLogUntil: '2026-10-15' }, line => on.push(line))).code, 200);
  assert.deepEqual(off, []); assert.deepEqual(expired, []);
  assert.equal(on.length, 1);
  const body = JSON.parse(on[0].slice(SCREENING_LOG_PREFIX.length + 1));
  assert.equal(body.total, 3); assert.deepEqual(body.records.map(r => r.decision).sort(), ['exclude', 'list', 'list']);
  assert(!on[0].includes('A short synthetic description of the story.'), 'alpha does not store summaries, so its description is never logged');
  assert.match(on[0], /rover drove farther/, 'beta stores a shortened summary already, so it may appear');
});

test('a failing log can never fail a collection run', async () => {
  const outcome = await run({ screeningLogUntil: '2026-10-15' }, () => { throw new Error('log down'); });
  assert.equal(outcome.code, 200); assert.equal(outcome.body.listed, 2);
});

test('the checked-in switch is a plain UTC date and the docs describe the sample', async () => {
  const config = JSON.parse(await readFile(new URL('../../config/publisher-feed.json', import.meta.url), 'utf8'));
  if ('screeningLogUntil' in config) assert.match(config.screeningLogUntil, /^\d{4}-\d{2}-\d{2}$/);
  const docs = await readFile(new URL('../../docs/publisher-feed.md', import.meta.url), 'utf8');
  for (const pattern of [/Screening sample/, /screeningLogUntil/, /run log/i, /one hour/i, /Exa/, /CRAWL_UNEXPECTED_CONTENT_TYPE/]) assert.match(docs, pattern);
});

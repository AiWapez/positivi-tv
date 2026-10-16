import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runPublisherRefresh, screeningLogActive, screeningLogLines, SCREENING_LOG_PREFIX, SCREENING_LOG_MAX_LINE } from '../../server/publisher-refresh.ts';
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

// A record the size of a real one: a long link, a long headline and the rules' reasons, about 450 characters once written out.
const realistic = n => ({ id: `mongabay-${String(n).padStart(24, '0')}`, source: 'mongabay', url: `https://news.mongabay.com/2026/10/a-long-headline-about-restoring-a-river-and-the-people-who-live-beside-it-${n}/`,
  title: `Villagers restore a river and bring its fish back after twenty years of work, story number ${n}`, published: NOW, summary: null,
  decision: 'exclude', reasons: ['NO_COMPLETED_OUTCOME', 'PLAN_OR_UNCERTAIN', 'NEGATIVE_WITHOUT_RECOVERY', 'OPINION_OR_DISPUTE'], labels: [], category: null });
const parse = line => JSON.parse(line.slice(SCREENING_LOG_PREFIX.length + 1));

test('log lines have a stable prefix and shape, keep every record once and in order, and number themselves', () => {
  const records = Array.from({ length: 12 }, (_, n) => record(n));
  const lines = screeningLogLines(records, NOW);
  assert(lines.length >= 1);
  lines.forEach((line, i) => {
    assert(line.startsWith(SCREENING_LOG_PREFIX + ' '));
    const body = parse(line);
    assert.equal(body.run, NOW); assert.equal(body.part, i + 1); assert.equal(body.of, lines.length); assert.equal(body.total, 12);
  });
  assert.deepEqual(lines.flatMap(l => parse(l).records.map(r => r.id)), records.map(r => r.id));
  assert.deepEqual(screeningLogLines([], NOW), []);
});

test('no log line is longer than the limit the log reader can show, so none is ever cut off', () => {
  assert(SCREENING_LOG_MAX_LINE <= 1800, 'the log reader cuts a message off at about 2,000 characters; keep a clear margin');
  for (const count of [1, 2, 7, 50, 174, 400]) {
    const records = Array.from({ length: count }, (_, n) => realistic(n));
    const lines = screeningLogLines(records, NOW);
    for (const line of lines) {
      assert(Buffer.byteLength(line) <= SCREENING_LOG_MAX_LINE, `${count} records: a line is ${Buffer.byteLength(line)} bytes`);
      assert(line.length < 2000);
      assert.doesNotThrow(() => parse(line), 'a whole line is always valid JSON, which a cut-off line is not');
    }
    assert.deepEqual(lines.flatMap(l => parse(l).records.map(r => r.id)), records.map(r => r.id), `${count} records: every record exactly once, in order`);
    assert.deepEqual(lines.map(l => parse(l).part), lines.map((_, i) => i + 1));
    assert(lines.every(l => parse(l).of === lines.length && parse(l).total === count));
  }
});

test('lines are packed, not one record each, and letters that take several bytes are measured by bytes', () => {
  const plain = Array.from({ length: 40 }, (_, n) => realistic(n));
  assert(screeningLogLines(plain, NOW).length < 40 / 2, 'about three or four real records fit on a line');
  const wide = plain.map((r, n) => ({ ...r, title: `河川を再生した村人たち、二十年ぶりに魚が戻る ‘${n}’ — 再生の物語を伝える見出し` }));
  for (const line of screeningLogLines(wide, NOW)) assert(Buffer.byteLength(line) <= SCREENING_LOG_MAX_LINE);
});

test('a single record too long for a line is kept whole on a line of its own', () => {
  const huge = { ...realistic(1), title: 'x'.repeat(3000) };
  const lines = screeningLogLines([realistic(0), huge, realistic(2)], NOW);
  assert.deepEqual(lines.map(l => parse(l).records.map(r => r.id)), [[realistic(0).id], [huge.id], [realistic(2).id]]);
  assert.equal(parse(lines[1]).records[0].title.length, 3000);
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

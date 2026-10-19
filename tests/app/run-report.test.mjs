import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRefreshHandler } from '../../api/refresh-feeds.ts';
import { createRunReportHandler } from '../../api/run-report.ts';
import { createPublisherStore } from '../../server/publisher-store.ts';
import { RUN_REPORT_NOTE } from '../../server/run-report.ts';
import { NOW, sources, feeds, control, rss, item, fakeFetcher, memoryBlob, response } from './publisher-fixtures.mjs';

const SECRET = 'synthetic-refresh-secret';
const xml = {
  'https://alpha.example.org/feed/': rss([item('alpha.example.org', 'wetland', 'Volunteers restore wetland in Kenya'), item('alpha.example.org', 'crash', 'Three killed in bus crash')]),
  'https://beta.example.org/feed/': rss([item('beta.example.org', 'rover', 'Rover sets record drive', { description: 'The rover drove farther than any rover before it on Mars. Engineers celebrated the milestone.' })]),
};
async function call(handler, req) { const { res, state } = response(); await handler(req, res); return state; }
async function reportAfterRun(overrides = {}) {
  const blob = memoryBlob(), store = createPublisherStore(blob), { fetcher } = fakeFetcher(overrides.xml ?? xml);
  const previous = process.env.CRON_SECRET; process.env.CRON_SECRET = SECRET;
  try {
    const refresh = createRefreshHandler(() => ({ feeds: feeds(), sources: sources(), control: control(), store, fetcher, now: () => NOW }));
    await call(refresh, { method: 'GET', headers: { authorization: 'Bearer ' + SECRET } });
  } finally { previous === undefined ? delete process.env.CRON_SECRET : process.env.CRON_SECRET = previous; }
  const handler = createRunReportHandler({ control: control(overrides.control), sources: overrides.sources ?? sources(),
    readSnapshot: async () => ({ snapshot: (await store.readCurrent(false))?.snapshot ?? null, status: 'ok' }) });
  return call(handler, { method: overrides.method ?? 'GET' });
}

test('the run report gives counts per source with neutral wording and the approved note', async () => {
  const r = await reportAfterRun();
  assert.equal(r.code, 200); assert.equal(r.data.note, RUN_REPORT_NOTE); assert.equal(r.data.lane, 'on');
  const alpha = r.data.sources.alpha;
  assert.equal(alpha.collection, 'collected'); assert.equal(alpha.candidates, 2); assert.equal(alpha.listed, 1); assert.equal(alpha.notListed, 1);
  assert.equal(alpha.heldBackReasons.HARM_EVENT, 1);
  assert(r.headers['Cache-Control'].includes('no-store'));
});

test('the run report never contains headlines, descriptions, links, story ids or failure words', async () => {
  const r = await reportAfterRun();
  const text = JSON.stringify(r.data);
  for (const banned of ['wetland', 'Kenya', 'bus crash', 'rover', 'Mars', 'http', 'example.org', 'rejected', 'failed', 'Rejected', 'Failed'])
    assert(!text.includes(banned), `report must not contain "${banned}"`);
  assert(!/[0-9a-f]{24}/.test(text), 'no story ids');
});

test('an unreachable publisher is shown as "not reached", with no error text', async () => {
  const r = await reportAfterRun({ xml: { 'https://alpha.example.org/feed/': xml['https://alpha.example.org/feed/'] } });
  assert.equal(r.data.sources.beta.collection, 'not reached'); assert.equal(r.data.sources.beta.code, undefined);
});

test('a switched-off lane and a missing run are reported plainly; only GET is allowed', async () => {
  assert.equal((await reportAfterRun({ control: { enabled: false } })).data.lane, 'switched off');
  const empty = createRunReportHandler({ control: control(), sources: sources(), readSnapshot: async () => ({ snapshot: null, status: 'unavailable' }) });
  assert.equal((await call(empty, { method: 'GET' })).data.lane, 'no run yet');
  const post = await reportAfterRun({ method: 'POST' }); assert.equal(post.code, 405);
  const source = await readFile(new URL('../../api/run-report.ts', import.meta.url), 'utf8');
  assert(!/collect\.mjs|safe-fetch|publisher-refresh/.test(source), 'the report handler does not import collection code');
});

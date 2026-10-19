import test from 'node:test';
import assert from 'node:assert/strict';
import { createRefreshHandler } from '../../api/refresh-feeds.ts';
import { createStoriesHandler } from '../../api/stories.ts';
import { createPublisherStore } from '../../server/publisher-store.ts';
import { parseRemoteControl, applyRemoteControl, createRemoteControlReader, remoteConnectionString, MAX_REMOTE_WITHDRAWALS } from '../../server/remote-control.ts';
import { NOW, sources, feeds, control, rss, item, fakeFetcher, memoryBlob, response } from './publisher-fixtures.mjs';

const SECRET = 'synthetic-refresh-secret';
const AT = '2026-10-19T12:00:00.000Z';
const ID = 'alpha-0123456789abcdef01234567';
const EDITION = { schemaVersion: 1, revision: 'empty-1', updatedAt: null, stories: [], statuses: {} };
const xml = {
  'https://alpha.example.org/feed/': rss([item('alpha.example.org', 'wetland', 'Volunteers restore wetland in Kenya')]),
  'https://beta.example.org/feed/': rss([item('beta.example.org', 'rover', 'Rover sets record drive', { description: 'The rover drove farther than any rover before it on Mars. Engineers celebrated the milestone.' })]),
};
async function call(handler, req) { const { res, state } = response(); await handler(req, res); return state; }

/** One real scheduled run into memory storage, then a visitor handler over it with the given remote reader. */
async function storiesWith(readRemote) {
  const blob = memoryBlob(), store = createPublisherStore(blob), { fetcher } = fakeFetcher(xml);
  const previous = process.env.CRON_SECRET; process.env.CRON_SECRET = SECRET;
  try {
    const refresh = createRefreshHandler(() => ({ feeds: feeds(), sources: sources(), control: control(), store, fetcher, now: () => NOW }));
    const run = await call(refresh, { method: 'GET', headers: { authorization: 'Bearer ' + SECRET } });
    assert.equal(run.code, 200, JSON.stringify(run.data));
  } finally { previous === undefined ? delete process.env.CRON_SECRET : process.env.CRON_SECRET = previous; }
  return createStoriesHandler({ edition: EDITION, control: control(), sources: sources(), readSnapshot: async () => ({ snapshot: (await store.readCurrent(false)).snapshot, status: 'ok' }), readRemote, now: () => NOW });
}

test('remote controls parse story ids and article links, and nothing else', () => {
  const parsed = parseRemoteControl({ publisherLaneOff: false, withdrawnStories: [ID, ' https://alpha.example.org/articles/wetland '] }, AT);
  assert.deepEqual(parsed, { laneOff: false, withdrawn: [{ id: ID, reason: 'same-day withdrawal', at: AT }, { url: 'https://alpha.example.org/articles/wetland', reason: 'same-day withdrawal', at: AT }] });
  assert.deepEqual(parseRemoteControl({}, AT), { laneOff: false, withdrawn: [] }, 'missing keys mean no change');
  for (const bad of [null, [], 'off', { publisherLaneOff: 'yes' }, { withdrawnStories: 'one' }, { withdrawnStories: [42] }, { withdrawnStories: [''] },
    { withdrawnStories: ['not a link or id'] }, { withdrawnStories: ['ftp://alpha.example.org/x'] }, { withdrawnStories: Array(MAX_REMOTE_WITHDRAWALS + 1).fill(ID) }])
    assert.equal(parseRemoteControl(bad, AT), null, JSON.stringify(bad)?.slice(0, 60));
});

test('remote controls can only pause the lane or add withdrawals, never loosen the deployed file', () => {
  const file = control({ withdrawn: [{ id: 'beta-ffffffffffffffffffffffff', reason: 'file', at: AT }] });
  assert.equal(applyRemoteControl(file, { configured: false }), file, 'no store connected: the file alone applies');
  assert.equal(applyRemoteControl(file, { configured: true, ok: false, reason: 'unreadable' }).enabled, false, 'unreadable store pauses the lane');
  assert.equal(applyRemoteControl(file, { configured: true, ok: true, value: { laneOff: true, withdrawn: [] }, readAt: AT }).enabled, false);
  const merged = applyRemoteControl(file, { configured: true, ok: true, value: { laneOff: false, withdrawn: [{ id: ID, reason: 'same-day withdrawal', at: AT }] }, readAt: AT });
  assert.equal(merged.enabled, true); assert.equal(merged.withdrawn.length, 2, 'file withdrawals are kept and remote ones added');
  assert.equal(applyRemoteControl(control({ enabled: false }), { configured: true, ok: true, value: { laneOff: false, withdrawn: [] }, readAt: AT }).enabled, false, 'remote cannot switch on a lane the file switched off');
});

test('the reader caches good reads, keeps the last good value through an outage, and pauses on a bad value', async () => {
  let t = 0, reads = 0, mode = 'good';
  const reader = createRemoteControlReader(async () => { reads++; if (mode === 'down') throw new Error('down'); return mode === 'bad' ? { publisherLaneOff: 'maybe' } : { withdrawnStories: [ID] }; },
    { okTtlMs: 1000, failTtlMs: 100, clock: () => t });
  const first = await reader(); assert.equal(first.ok, true); await reader(); assert.equal(reads, 1, 'second read inside the cache window is free');
  mode = 'down'; t = 1500; const outage = await reader(); assert.equal(outage.ok, true, 'an unreachable store keeps the last good controls'); assert.equal(reads, 2);
  mode = 'bad'; t = 1700; const bad = await reader(); assert.equal(bad.ok, false, 'a value that is not understood pauses the lane');
  mode = 'down'; t = 1900; assert.equal((await reader()).ok, false, 'after a bad value, an outage does not bring back the older good value');
  const fresh = createRemoteControlReader(async () => { throw new Error('down'); });
  assert.deepEqual(await fresh(), { configured: true, ok: false, reason: 'unreadable' }, 'no good read yet: paused');
  assert.deepEqual(await createRemoteControlReader(null)(), { configured: false });
});

test('the connection string comes from the variables Vercel adds when a store is connected', () => {
  assert.equal(remoteConnectionString({}), null);
  assert.equal(remoteConnectionString({ EDGE_CONFIG: ' https://edge-config.vercel.com/ecfg_x?token=t ' }), 'https://edge-config.vercel.com/ecfg_x?token=t');
  assert.equal(remoteConnectionString({ GLOBAL_CONFIG: 'g', EDGE_CONFIG: 'e' }), 'g');
});

test('a same-day withdrawal by link or id removes the card and marks it withdrawn, with no redeploy', async () => {
  const before = await call(await storiesWith(async () => ({ configured: false })), { method: 'GET' });
  assert.equal(before.data.stories.length, 2);
  const target = before.data.stories.find(s => s.sourceUrl.includes('alpha.example.org'));
  for (const entry of [target.sourceUrl, target.id]) {
    const handler = await storiesWith(async () => ({ configured: true, ok: true, value: parseRemoteControl({ withdrawnStories: [entry] }, AT), readAt: AT }));
    const r = await call(handler, { method: 'GET' });
    assert.equal(r.data.stories.length, 1, entry);
    assert(!r.data.stories.some(s => s.id === target.id));
    assert.equal(r.data.manifest.stories[target.id].status, 'withdrawn');
  }
});

test('the off switch and an unreadable control store both pause the lane while the reviewed edition is still served', async () => {
  for (const readRemote of [async () => ({ configured: true, ok: true, value: { laneOff: true, withdrawn: [] }, readAt: AT }),
    async () => ({ configured: true, ok: false, reason: 'unreadable' }), async () => { throw new Error('boom'); }]) {
    const r = await call(await storiesWith(readRemote), { method: 'GET' });
    assert.equal(r.code, 200); assert.equal(r.data.publisherFeed.status, 'disabled'); assert.deepEqual(r.data.stories, []);
  }
});

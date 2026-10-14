import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRefreshHandler } from '../../api/refresh-feeds.ts';
import { createStoriesHandler } from '../../api/stories.ts';
import { createPublisherStore, createSnapshotReader, SNAPSHOT_PATH, LOCK_PATH, LOCK_STALE_MS } from '../../server/publisher-store.ts';
import { NOW, sources, feeds, control, rss, item, fakeFetcher, memoryBlob, response } from './publisher-fixtures.mjs';
const SECRET = 'synthetic-refresh-secret';
const auth = { authorization: 'Bearer ' + SECRET };
const xml = {
  'https://alpha.example.org/feed/': rss([item('alpha.example.org', 'wetland', 'Volunteers restore wetland in Kenya'), item('alpha.example.org', 'crash', 'Three killed in bus crash')]),
  'https://beta.example.org/feed/': rss([item('beta.example.org', 'rover', 'Rover sets record drive', { description: 'The rover drove farther than any rover before it on Mars. Engineers celebrated the milestone.' })]),
};
function setup(overrides = {}) {
  const blob = overrides.blob ?? memoryBlob(), store = createPublisherStore(blob), { fetcher, calls } = fakeFetcher(overrides.xml ?? xml);
  let clock = overrides.now ?? NOW;
  const deps = () => ({ feeds: feeds(), sources: overrides.sources ?? sources(), control: control(overrides.control), store, fetcher: overrides.fetcher ?? fetcher, now: () => clock });
  return { blob, store, calls, handler: createRefreshHandler(deps), setNow: t => { clock = t; } };
}
async function call(handler, req) { const { res, state } = response(); await handler(req, res); return state; }
async function withSecret(fn) {
  const previous = process.env.CRON_SECRET; process.env.CRON_SECRET = SECRET;
  try { return await fn(); } finally { previous === undefined ? delete process.env.CRON_SECRET : process.env.CRON_SECRET = previous; }
}

test('refresh endpoint denies missing or wrong secrets and non-GET methods before any fetch or storage', () => withSecret(async () => {
  const { handler, calls, blob } = setup();
  for (const authorization of [undefined, 'Bearer wrong', 'Bearer ' + SECRET + 'x']) assert.equal((await call(handler, { method: 'GET', headers: { authorization } })).code, 401);
  const post = await call(handler, { method: 'POST', headers: auth }); assert.equal(post.code, 405); assert.equal(post.headers.Allow, 'GET');
  assert.equal(calls.length, 0); assert.equal(blob.ops.length, 0);
  delete process.env.CRON_SECRET; assert.equal((await call(handler, { method: 'GET', headers: auth })).code, 401, 'no configured secret means deny');
}));

test('a scheduled run fetches only configured feed URLs, screens, and stores one bounded snapshot', () => withSecret(async () => {
  const { handler, calls, blob, store } = setup();
  const r = await call(handler, { method: 'GET', headers: auth });
  assert.equal(r.code, 200, JSON.stringify(r.data)); assert.equal(r.data.listed, 2);
  // Robots handling is exercised in collect.test.mjs; this fake fetcher does not consult it.
  assert.deepEqual([...new Set(calls)].sort(), ['https://alpha.example.org/feed/', 'https://beta.example.org/feed/']);
  assert(calls.every(u => u.startsWith('https://alpha.example.org/') || u.startsWith('https://beta.example.org/')), 'article links are never fetched');
  const { snapshot } = await store.readCurrent(true);
  assert.deepEqual(snapshot.items.map(i => i.title).sort(), ['Rover sets record drive', 'Volunteers restore wetland in Kenya']);
  assert.equal(snapshot.sources.alpha.excluded.HARM_EVENT, 1);
  assert.equal(blob.objects.has(LOCK_PATH), false, 'lock released');
  assert.equal(blob.objects.get(SNAPSHOT_PATH).options.cacheControlMaxAge, 300);
}));

test('one failing source keeps its previous items; every source failing keeps the whole previous snapshot', () => withSecret(async () => {
  const env = setup();
  await call(env.handler, { method: 'GET', headers: auth });
  const before = env.blob.objects.get(SNAPSHOT_PATH).body;
  const partial = setup({ blob: env.blob, xml: { 'https://beta.example.org/feed/': xml['https://beta.example.org/feed/'] }, now: '2026-10-14T12:00:00.000Z' });
  const r = await call(partial.handler, { method: 'GET', headers: auth });
  assert.equal(r.code, 200); assert.equal(r.data.sources.alpha.status, 'failed'); assert.equal(r.data.sources.alpha.carried, 1); assert.equal(r.data.listed, 2);
  const after = env.blob.objects.get(SNAPSHOT_PATH).body;
  const down = setup({ blob: env.blob, xml: {}, now: '2026-10-14T13:00:00.000Z' });
  const failed = await call(down.handler, { method: 'GET', headers: auth });
  assert.equal(failed.code, 502); assert.equal(env.blob.objects.get(SNAPSHOT_PATH).body, after, 'previous snapshot untouched');
  assert.notEqual(before, after);
}));

test('overlapping runs: a fresh lock blocks a second run before it fetches; a stale lock is broken', () => withSecret(async () => {
  const env = setup();
  await env.blob.put(LOCK_PATH, JSON.stringify({ token: 'other', at: NOW }), { access: 'private', allowOverwrite: false });
  const blocked = await call(env.handler, { method: 'GET', headers: auth });
  assert.equal(blocked.code, 409); assert.equal(env.calls.length, 0); assert.equal(env.blob.objects.has(SNAPSHOT_PATH), false);
  assert.equal(JSON.parse(env.blob.objects.get(LOCK_PATH).body).token, 'other', 'someone else’s lock is not removed');
  env.blob.objects.get(LOCK_PATH).uploadedAt = new Date(Date.parse(NOW) - LOCK_STALE_MS - 1000);
  const recovered = await call(env.handler, { method: 'GET', headers: auth });
  assert.equal(recovered.code, 200); assert.equal(env.blob.objects.has(LOCK_PATH), false);
}));

test('a concurrent snapshot replacement wins; the slower run overwrites nothing', () => withSecret(async () => {
  const blob = memoryBlob(); let raced = false;
  const env = setup({ blob, fetcher: async url => {
    if (!raced && url.endsWith('/feed/')) { raced = true; await blob.put(SNAPSHOT_PATH, JSON.stringify({ schemaVersion: 1, kind: 'publisher_feed', policy: 'x', revision: 'other-run', generatedAt: NOW, items: [], sources: {}, duplicates: [] }), { access: 'private', allowOverwrite: true }); }
    return { text: url.endsWith('robots.txt') ? '' : xml[url] };
  } });
  const r = await call(env.handler, { method: 'GET', headers: auth });
  assert.equal(r.code, 409); assert.equal(JSON.parse(blob.objects.get(SNAPSHOT_PATH).body).revision, 'other-run');
}));

test('global switch off: the scheduled job fetches nothing and removes the stored snapshot', () => withSecret(async () => {
  const blob = memoryBlob();
  await call(setup({ blob }).handler, { method: 'GET', headers: auth });
  assert(blob.objects.has(SNAPSHOT_PATH));
  const env = setup({ blob, control: { enabled: false } }); blob.ops.length = 0;
  const r = await call(env.handler, { method: 'GET', headers: auth });
  assert.deepEqual(r.data, { skipped: 'disabled' }); assert.equal(env.calls.length, 0);
  assert.deepEqual(blob.ops, [['del', SNAPSHOT_PATH]]); assert.equal(blob.objects.has(SNAPSHOT_PATH), false);
}));

test('refresh isolation: GET /api/stories with any query never fetches feeds and reads the stored snapshot through a cache', () => withSecret(async () => {
  const env = setup(); await call(env.handler, { method: 'GET', headers: auth });
  let reads = 0;
  const readSnapshot = createSnapshotReader(async () => { reads++; return env.store.readCurrent(false); });
  const stories = createStoriesHandler({ edition: { schemaVersion: 1, revision: 'empty-1', updatedAt: null, stories: [], statuses: {} },
    control: control(), sources: sources(), readSnapshot, now: () => NOW });
  const originalFetch = globalThis.fetch; const before = env.calls.length;
  globalThis.fetch = () => { throw new Error('network use from the visitor path'); };
  try {
    const a = await call(stories, { method: 'GET', url: '/api/stories?t=1' }), b = await call(stories, { method: 'GET', url: '/api/stories?t=2' });
    assert.equal(a.code, 200); assert.equal(a.data.stories.length, 2); assert.equal(a.data.revision, b.data.revision);
    assert.equal(reads, 1, 'second request served from memory'); assert.equal(env.calls.length, before, 'no publisher contacted');
    for (const key of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) assert(a.headers[key].includes('no-store'));
  } finally { globalThis.fetch = originalFetch; }
  const source = await readFile(new URL('../../api/stories.ts', import.meta.url), 'utf8');
  assert(!/collect\.mjs|safe-fetch|publisher-refresh/.test(source), 'the visitor handler does not import collection code');
}));

test('snapshot read failure serves the reviewed edition alone; the last good snapshot survives later failures', async () => {
  let fail = false, reads = 0, clock = 0;
  const good = { snapshot: { schemaVersion: 1, kind: 'publisher_feed', policy: 'p', revision: 'r1', generatedAt: NOW, items: [], sources: {}, duplicates: [] } };
  const reader = createSnapshotReader(async () => { reads++; if (fail) throw new Error('blob down'); return good; }, { okTtlMs: 10, failTtlMs: 10, clock: () => clock });
  assert.equal((await reader()).snapshot.revision, 'r1');
  fail = true; clock = 100; assert.equal((await reader()).snapshot.revision, 'r1', 'stale-on-error'); assert.equal(reads, 2);
  const broken = createStoriesHandler({ edition: { schemaVersion: 1, revision: 'empty-1', updatedAt: null, stories: [], statuses: {} },
    control: control(), sources: sources(), readSnapshot: async () => { throw new Error('down'); }, now: () => NOW });
  const r = await call(broken, { method: 'GET' });
  assert.equal(r.code, 200); assert.equal(r.data.publisherFeed.status, 'unavailable'); assert.deepEqual(r.data.stories, []);
});

test('a disabled lane serves the edition without attempting a snapshot read', async () => {
  const handler = createStoriesHandler({ edition: { schemaVersion: 1, revision: 'empty', updatedAt: null, stories: [], statuses: {} }, control: control({ enabled: false }), sources: sources(), readSnapshot: async () => { throw new Error('Disabled lane must not read'); }, now: () => NOW });
  const r = await call(handler, { method: 'GET', url: '/api/stories?t=123' });
  assert.equal(r.code, 200); assert.equal(r.data.publisherFeed.status, 'disabled');
});

test('fetch options from the hardened boundary are passed through unchanged for each feed', () => withSecret(async () => {
  const seen = [];
  const env = setup({ fetcher: async (url, options) => { seen.push({ url, options }); return { text: url.endsWith('robots.txt') ? '' : xml[url] }; } });
  assert.equal((await call(env.handler, { method: 'GET', headers: auth })).code, 200);
  for (const { url, options } of seen) {
    const host = new URL(url).hostname;
    assert.deepEqual(options.allowedDomains, [host]); assert(options.maxBytes > 0 && options.maxBytes <= 2 * 1024 * 1024);
    assert.equal(typeof options.robotsAllowed, 'function');
    assert.equal(await options.permitted('https://attacker.example/feed/'), false, 'a source URL cannot widen the allowlist');
    assert.equal(await options.permitted(url), true);
  }
}));

test('an invalid stored snapshot does not block refreshes; it is replaced by compare-and-swap', () => withSecret(async () => {
  const blob = memoryBlob();
  await blob.put(SNAPSHOT_PATH, '{"not":"a snapshot"', { access: 'private', allowOverwrite: true });
  const env = setup({ blob });
  const r = await call(env.handler, { method: 'GET', headers: auth });
  assert.equal(r.code, 200); assert.equal(JSON.parse(blob.objects.get(SNAPSHOT_PATH).body).kind, 'publisher_feed');
  const visitor = await createPublisherStore(blob).readCurrent(false); assert(visitor.snapshot);
}));

test('a missing ETag in a read falls back to head(), so later runs still replace the snapshot', () => withSecret(async () => {
  const blob = memoryBlob(), get = blob.get;
  blob.get = async (...args) => { const r = await get(...args); if (r) r.blob.etag = ''; return r; };
  const env = setup({ blob });
  assert.equal((await call(env.handler, { method: 'GET', headers: auth })).code, 200);
  env.setNow('2026-10-14T11:00:00.000Z');
  assert.equal((await call(env.handler, { method: 'GET', headers: auth })).code, 200);
  assert.equal(blob.objects.has(LOCK_PATH), false, 'lock released through the head() ETag');
}));

test('module graph: loading the visitor handler never loads collection or fetch code', () => {
  const script = `
    import { registerHooks } from 'node:module';
    const seen = [];
    registerHooks({ resolve(specifier, context, next) { const r = next(specifier, context); seen.push(r.url); return r; } });
    await import(${JSON.stringify(new URL('../../api/stories.ts', import.meta.url).href)});
    console.log(JSON.stringify(seen));`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const urls = JSON.parse(run.stdout.trim().split('\n').pop());
  assert(urls.some(u => u.endsWith('/server/publisher-store.ts')), 'sanity: the graph was observed');
  for (const forbidden of ['/server/collect.mjs', '/safe-fetch.node.mjs', '/server/publisher-refresh.ts', 'robots-parser', 'fast-xml-parser'])
    assert(!urls.some(u => u.includes(forbidden)), forbidden);
});

test('lock released between a failed create and the check: the run retries once instead of failing', async () => {
  const blob = memoryBlob(), store = createPublisherStore(blob), put = blob.put; let first = true;
  blob.put = async (path, body, options) => { if (path === LOCK_PATH && first) { first = false; throw new Error('Vercel Blob: This blob already exists'); } return put(path, body, options); };
  assert.equal(typeof await store.acquireLock(Date.parse(NOW)), 'string');
});

test('a stream error while reading the snapshot is a failure, not "no snapshot": carried items survive', () => withSecret(async () => {
  const blob = memoryBlob(), env = setup({ blob });
  await call(env.handler, { method: 'GET', headers: auth });
  const before = blob.objects.get(SNAPSHOT_PATH).body, get = blob.get;
  blob.get = async (path, options) => path === SNAPSHOT_PATH
    ? { statusCode: 200, blob: { etag: blob.objects.get(path).etag }, stream: new ReadableStream({ pull(c) { c.error(new Error('ECONNRESET')); } }) }
    : get(path, options);
  const r = await call(setup({ blob, xml: { 'https://beta.example.org/feed/': xml['https://beta.example.org/feed/'] } }).handler, { method: 'GET', headers: auth });
  assert.equal(r.code, 503); assert.equal(blob.objects.get(SNAPSHOT_PATH).body, before, 'nothing overwritten');
  assert.equal(blob.objects.has(LOCK_PATH), false);
  // Visitor path: an invalid object keeps the last good snapshot and retries soon.
  blob.get = get; let clock = 0;
  const store = createPublisherStore(blob), reader = createSnapshotReader(() => store.readCurrent(false), { okTtlMs: 10, failTtlMs: 10, clock: () => clock });
  assert((await reader()).snapshot);
  blob.objects.get(SNAPSHOT_PATH).body = '{broken'; clock = 100;
  assert((await reader()).snapshot, 'last good snapshot kept after an invalid read');
}));

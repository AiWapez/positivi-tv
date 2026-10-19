import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRefreshHandler } from '../../api/refresh-feeds.ts';
import { createPublisherStore } from '../../server/publisher-store.ts';
import { teachingBatchConfig, toTeachingRecords, expired, batchTag, saveTeachingBatch } from '../../server/teaching-batch.ts';
import { NOW, sources, feeds, control, rss, item, fakeFetcher, memoryBlob, response } from './publisher-fixtures.mjs';

const CONFIG = { repo: 'AiWapez/positivitv-teaching', token: 'synthetic-token-not-real' };
const TODAY = '2026-11-03T10:54:00.000Z';
const RECORD = { id: 'alpha-0123456789abcdef01234567', source: 'alpha', url: 'https://alpha.example.org/articles/wetland', title: 'Volunteers restore wetland in Kenya',
  published: '2026-11-02T08:00:00.000Z', summary: 'A private summary that must never be saved', decision: 'list', reasons: [], labels: ['event_date_unconfirmed'], category: 'Planet' };

/** A fake GitHub that records every call. */
function fakeGitHub(overrides = {}) {
  const calls = [];
  const releases = overrides.releases ?? [{ id: 1, tag_name: 'batch-2026-10-19' }, { id: 2, tag_name: 'batch-2026-10-20' }, { id: 3, tag_name: 'v1.0.0' }];
  const fetcher = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body, headers: init.headers });
    if (overrides.throws) throw new Error('network');
    const reply = (status, data) => ({ status, json: async () => data });
    if (init.method === 'GET' && url.endsWith('/releases?per_page=100')) return reply(overrides.listStatus ?? 200, releases);
    if (init.method === 'DELETE') return reply(204, null);
    if (init.method === 'POST' && url.endsWith('/releases')) return reply(overrides.createStatus ?? 201, { id: 99 });
    if (init.method === 'GET' && url.includes('/releases/tags/')) return reply(200, { id: 77, assets: [{ id: 5, name: 'batch-2026-11-03.json' }, { id: 6, name: 'other.json' }] });
    if (init.method === 'POST' && url.startsWith('https://uploads.github.com/')) return reply(overrides.uploadStatus ?? 201, {});
    return reply(404, null);
  };
  return { calls, fetcher };
}

test('the save is off unless both settings are present and the repository name is well formed', () => {
  assert.equal(teachingBatchConfig({}), null);
  assert.equal(teachingBatchConfig({ TEACHING_BATCH_REPO: 'AiWapez/x' }), null);
  assert.equal(teachingBatchConfig({ TEACHING_BATCH_TOKEN: 't' }), null);
  assert.equal(teachingBatchConfig({ TEACHING_BATCH_REPO: 'not a repo', TEACHING_BATCH_TOKEN: 't' }), null);
  assert.deepEqual(teachingBatchConfig({ TEACHING_BATCH_REPO: ' AiWapez/positivitv-teaching ', TEACHING_BATCH_TOKEN: ' t ' }), { repo: 'AiWapez/positivitv-teaching', token: 't' });
});

test('records keep only the approved fields: no description, summary, labels, category or author', () => {
  const [r] = toTeachingRecords([{ ...RECORD, author: 'Someone' }], sources(), 'publisher-feed-0.4.1');
  assert.deepEqual(Object.keys(r).sort(), ['decision', 'headline', 'link', 'policy', 'published', 'reasons', 'source'].sort());
  assert.equal(r.policy, 'publisher-feed-0.4.1'); assert.equal(r.headline, RECORD.title); assert.equal(r.link, RECORD.url);
  assert(!JSON.stringify(r).includes('private summary'));
});

test('a batch is removed once it is more than 14 days old; tags that are not batches are never touched', () => {
  assert.equal(batchTag(TODAY), 'batch-2026-11-03');
  assert.equal(expired('batch-2026-10-20', TODAY), false, '14 days old: kept one more day');
  assert.equal(expired('batch-2026-10-19', TODAY), true, '15 days old: deleted');
  for (const tag of ['v1.0.0', 'batch-latest', 'batch-2026-10-19-extra']) assert.equal(expired(tag, TODAY), false, tag);
});

test('a run deletes expired batches (release and tag), then saves today with date-only names', async () => {
  const gh = fakeGitHub(), lines = [];
  const result = await saveTeachingBatch(toTeachingRecords([RECORD], sources(), 'p'), TODAY, CONFIG, gh.fetcher, l => lines.push(l));
  assert.deepEqual(result, { saved: 1, deleted: 1, status: 'saved' });
  const deletes = gh.calls.filter(c => c.method === 'DELETE').map(c => c.url.replace('https://api.github.com/repos/AiWapez/positivitv-teaching', ''));
  assert.deepEqual(deletes, ['/releases/1', '/git/refs/tags/batch-2026-10-19']);
  const create = gh.calls.find(c => c.method === 'POST' && c.url.endsWith('/releases'));
  assert.deepEqual(JSON.parse(create.body), { tag_name: 'batch-2026-11-03', name: 'batch-2026-11-03', body: 'batch-2026-11-03', draft: false, prerelease: false });
  const upload = gh.calls.find(c => c.url.startsWith('https://uploads.github.com/'));
  assert(upload.url.endsWith('/releases/99/assets?name=batch-2026-11-03.json'));
  assert.equal(JSON.parse(upload.body).records[0].headline, RECORD.title);
  assert.deepEqual(lines, ['teaching-batch saved=1 deleted=1']);
});

test('a second run on the same day replaces that day\'s file only', async () => {
  const gh = fakeGitHub({ releases: [], createStatus: 422 });
  const result = await saveTeachingBatch([], TODAY, CONFIG, gh.fetcher, () => {});
  assert.equal(result.status, 'saved');
  const deletes = gh.calls.filter(c => c.method === 'DELETE').map(c => c.url);
  assert.deepEqual(deletes, ['https://api.github.com/repos/AiWapez/positivitv-teaching/releases/assets/5']);
  assert(gh.calls.some(c => c.url.includes('/releases/77/assets?name=batch-2026-11-03.json')));
});

test('failures are quiet: logs hold counts and status codes only, never headlines, links or the key', async () => {
  for (const overrides of [{ uploadStatus: 401 }, { listStatus: 403 }, { createStatus: 500 }, { throws: true }]) {
    const gh = fakeGitHub(overrides), lines = [];
    const result = await saveTeachingBatch(toTeachingRecords([RECORD], sources(), 'p'), TODAY, CONFIG, gh.fetcher, l => lines.push(l));
    assert.equal(result.status, 'failed', JSON.stringify(overrides));
    for (const line of lines) for (const secret of ['wetland', 'Kenya', 'http', 'synthetic-token', 'example.org']) assert(!line.includes(secret), `${line} leaks ${secret}`);
  }
  assert.deepEqual(await saveTeachingBatch([], TODAY, null, () => { throw new Error('must not call'); }), { saved: 0, deleted: 0, status: 'off' });
});

test('the save can only reach release and tag endpoints: no commit, file, branch or other ref path exists', async () => {
  const gh = fakeGitHub();
  await saveTeachingBatch([], TODAY, CONFIG, gh.fetcher, () => {});
  const allowed = [/^GET https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/releases(\?per_page=100|\/tags\/batch-\d{4}-\d{2}-\d{2})$/,
    /^POST https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/releases$/, /^DELETE https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/releases\/(assets\/)?\d+$/,
    /^DELETE https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/git\/refs\/tags\/batch-\d{4}-\d{2}-\d{2}$/,
    /^POST https:\/\/uploads\.github\.com\/repos\/[^/]+\/[^/]+\/releases\/\d+\/assets\?name=batch-\d{4}-\d{2}-\d{2}\.json$/];
  for (const c of gh.calls) assert(allowed.some(r => r.test(`${c.method} ${c.url}`)), `unexpected call ${c.method} ${c.url}`);
  const source = await readFile(new URL('../../server/teaching-batch.ts', import.meta.url), 'utf8');
  for (const banned of ['/contents', 'git/commits', 'git/trees', 'git/blobs', '/branches', '/merges', 'PUT', 'PATCH', 'heads/'])
    assert(!source.includes(banned), `teaching-batch code must not mention ${banned}`);
});

test('in the daily run, the save gets the screened records after the snapshot is stored, and cannot change the result', async () => {
  const xml = { 'https://alpha.example.org/feed/': rss([item('alpha.example.org', 'wetland', 'Volunteers restore wetland in Kenya')]),
    'https://beta.example.org/feed/': rss([item('beta.example.org', 'rover', 'Rover sets record drive', { description: 'The rover drove farther than any rover before it on Mars. Engineers celebrated the milestone.' })]) };
  const previous = process.env.CRON_SECRET; process.env.CRON_SECRET = 'synthetic-refresh-secret';
  try {
    for (const save of [async () => { throw new Error('boom'); }, null]) {
      const blob = memoryBlob(), store = createPublisherStore(blob), { fetcher } = fakeFetcher(xml);
      const got = [];
      const deps = () => ({ feeds: feeds(), sources: sources(), control: control(), store, fetcher, now: () => NOW,
        ...(save ? { saveTeaching: async (records, now) => { got.push(...records); assert(blob.objects.size > 0, 'snapshot stored first'); return save(); } } : {}) });
      const { res, state } = response();
      await createRefreshHandler(deps)({ method: 'GET', headers: { authorization: 'Bearer synthetic-refresh-secret' } }, res);
      assert.equal(state.code, 200); assert.equal(state.data.listed, 2);
      if (save) assert.equal(got.length, 2, 'both screened records were handed to the save');
    }
  } finally { previous === undefined ? delete process.env.CRON_SECRET : process.env.CRON_SECRET = previous; }
});

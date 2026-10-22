import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRefreshHandler } from '../../api/refresh-feeds.ts';
import { createPublisherStore } from '../../server/publisher-store.ts';
import { teachingBatchConfig, toTeachingRecords, expired, batchTag, saveTeachingBatch, cleanDescription, MAX_DESCRIPTION, SHORTENED } from '../../server/teaching-batch.ts';
import { buildRunReport } from '../../server/run-report.ts';
import { screeningLogLines } from '../../server/publisher-refresh.ts';
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

test('records keep only the approved fields: no summary, labels, category or author, and a description only where the source allows it', () => {
  const [r] = toTeachingRecords([{ ...RECORD, author: 'Someone' }], sources(), 'publisher-feed-0.4.1', new Map([[RECORD.id, 'Offered text that must not be kept.']]));
  assert.deepEqual(Object.keys(r).sort(), ['decision', 'description', 'headline', 'link', 'policy', 'published', 'reasons', 'source'].sort());
  assert.equal(r.description, null, 'a source without teachingDescription keeps no description, even if one is offered');
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


// ---- Context line: the publisher's own description, unchanged, private and temporary (General Counsel ruling, October 21, 2026) ----
const ALLOWED = () => sources({ alpha: { ...sources().alpha, publisherFeed: { ...sources().alpha.publisherFeed, teachingDescription: true } } });

test('a description is kept as the publisher wrote it: only tags, links, images, entities and spacing are cleaned', () => {
  assert.equal(cleanDescription('Volunteers planted 4,000 mangroves along the coast.'), 'Volunteers planted 4,000 mangroves along the coast.');
  assert.equal(cleanDescription('<p>Crews <b>restored</b> the&nbsp;reef &amp; its <a href="https://x.example/a">fish</a>.</p><img src="https://x.example/i.png" alt="photo">'), 'Crews restored the reef & its fish .'.replace(' .', '.'));
  assert.equal(cleanDescription('Line one.\n\n   Line   two  \u2019s end.'), 'Line one. Line two ’s end.');
  assert.equal(cleanDescription('See https://example.org/story now. Done.'), 'See now. Done.');
  assert.equal(cleanDescription('Rangers counted a record number of nests. The post Record nests appeared first on Example News.'), 'Rangers counted a record number of nests.');
  assert.equal(cleanDescription('A wetland returns […]'), 'A wetland returns […]', 'the publisher\'s own ellipsis stays');
  for (const empty of ['', '   ', '<img src="x">', null, undefined]) assert.equal(cleanDescription(empty), null);
});

test('a long description is cut at a whole sentence and says so; one whose first sentence is too long is not kept', () => {
  const sentence = 'Researchers described a steady recovery of the river over many seasons of careful work.';
  const long = Array.from({ length: 12 }, () => sentence).join(' ');
  const out = cleanDescription(long);
  assert(out.endsWith(SHORTENED)); assert(out.length <= MAX_DESCRIPTION);
  assert.equal(out.slice(0, -SHORTENED.length).split('. ').length >= 1, true);
  assert(out.slice(0, -SHORTENED.length).endsWith('.'), 'cut at a sentence end');
  assert(long.startsWith(out.slice(0, -SHORTENED.length)), 'the kept part is an unchanged beginning of the original');
  assert.equal(cleanDescription('A'.repeat(MAX_DESCRIPTION + 50) + '.'), null);
  assert.equal(cleanDescription('Short enough text stays whole and gets no mark.').includes('(shortened)'), false);
});

test('a description that may belong to someone else is not kept', () => {
  for (const text of ['Republished from another newsroom with permission.', 'Originally published by Partner News.', 'Reuters reports a new reef.', 'Photo courtesy of a local group.', 'All rights reserved.', 'Syndicated from a wire service.', 'AFP says the dam reopened.'])
    assert.equal(cleanDescription(text), null, text);
  assert.equal(cleanDescription('Nothing about rights here, only a recovering reef.'), 'Nothing about rights here, only a recovering reef.');
});

test('records get the cleaned description only for a source whose terms record allows it', () => {
  const map = new Map([[RECORD.id, '<p>Volunteers restored the wetland.</p>']]);
  assert.equal(toTeachingRecords([RECORD], ALLOWED(), 'p', map)[0].description, 'Volunteers restored the wetland.');
  assert.equal(toTeachingRecords([RECORD], sources(), 'p', map)[0].description, null);
  assert.equal(toTeachingRecords([RECORD], ALLOWED(), 'p', new Map())[0].description, null);
  assert.equal(toTeachingRecords([RECORD], ALLOWED(), 'p')[0].description, null);
});

test('items excluded for a blocked credit or a restrictive rights notice never reach the teaching save, so no description is kept for them', async () => {
  const alpha = { ...ALLOWED().alpha, publisherFeed: { ...ALLOWED().alpha.publisherFeed, blockedCredits: ['Wire Co'] } };
  const xml = { 'https://alpha.example.org/feed/': rss([
    item('alpha.example.org', 'ok', 'Volunteers restore wetland in Kenya', { description: 'Plain publisher text.' }),
    item('alpha.example.org', 'credit', 'Dam reopens after repair', { description: 'Text credited to Wire Co.' }),
    item('alpha.example.org', 'rights', 'Reef shows new growth', { description: 'Restricted text.', rights: 'All rights reserved' })]),
  'https://beta.example.org/feed/': rss([]) };
  const previous = process.env.CRON_SECRET; process.env.CRON_SECRET = 'synthetic-refresh-secret';
  try {
    const got = []; let seen = null;
    const { res, state } = response(), { fetcher } = fakeFetcher(xml);
    await createRefreshHandler(() => ({ feeds: feeds(), sources: sources({ alpha }), control: control(), store: createPublisherStore(memoryBlob()), fetcher, now: () => NOW,
      saveTeaching: async (records, now, descriptions) => { got.push(...records); seen = descriptions; } }))({ method: 'GET', headers: { authorization: 'Bearer synthetic-refresh-secret' } }, res);
    assert.equal(state.code, 200);
    assert.deepEqual(got.map(r => r.url), ['https://alpha.example.org/articles/ok']);
    assert.deepEqual([...seen.values()], ['Plain publisher text.']);
  } finally { previous === undefined ? delete process.env.CRON_SECRET : process.env.CRON_SECRET = previous; }
});

test('a description reaches only the private batch file: not the public snapshot, the run report, the run log, the save log or the run response', async () => {
  const SENTINEL = 'Quartz heron sentinel text that only the private batch may hold.';
  const xml = { 'https://alpha.example.org/feed/': rss([item('alpha.example.org', 'wetland', 'Volunteers restore wetland in Kenya', { description: SENTINEL })]), 'https://beta.example.org/feed/': rss([]) };
  const previous = process.env.CRON_SECRET; process.env.CRON_SECRET = 'synthetic-refresh-secret';
  try {
    const blob = memoryBlob(), store = createPublisherStore(blob), runLog = [], saveLog = [], gh = fakeGitHub(), { fetcher } = fakeFetcher(xml);
    const { res, state } = response();
    await createRefreshHandler(() => ({ feeds: feeds(), sources: ALLOWED(), control: control({ screeningLogUntil: '2026-10-20' }), store, fetcher, now: () => NOW, log: l => runLog.push(l),
      saveTeaching: (records, now, descriptions) => saveTeachingBatch(toTeachingRecords(records, ALLOWED(), 'p', descriptions), TODAY, CONFIG, gh.fetcher, l => saveLog.push(l)) }))({ method: 'GET', headers: { authorization: 'Bearer synthetic-refresh-secret' } }, res);
    assert.equal(state.code, 200);
    // The private batch file holds it, once, for that story.
    const upload = gh.calls.find(c => c.url.startsWith('https://uploads.github.com/'));
    assert.equal(JSON.parse(upload.body).records.find(r => r.link.endsWith('/wetland')).description, SENTINEL);
    // Nowhere else.
    assert(runLog.length > 0, 'the run log was active, so the check is real');
    const everywhere = { response: JSON.stringify(state.data), runLog: runLog.join('\n'), saveLog: saveLog.join('\n'),
      blob: [...blob.objects.values()].map(o => String(o.body)).join('\n'), release: gh.calls.filter(c => !c.url.startsWith('https://uploads.github.com/')).map(c => `${c.url} ${c.body ?? ''}`).join('\n'),
      report: JSON.stringify(buildRunReport({ snapshot: (await store.readCurrent(false)).snapshot, status: 'ok' }, control(), ALLOWED())),
      logLines: screeningLogLines([{ id: 'alpha-1', source: 'alpha', url: 'https://alpha.example.org/articles/wetland', title: 'Volunteers restore wetland in Kenya', published: NOW, summary: null, decision: 'list', reasons: [], labels: [], category: 'Planet' }], NOW).join('\n') };
    for (const [place, text] of Object.entries(everywhere)) assert(!text.includes('Quartz heron'), `description leaked into ${place}`);
  } finally { previous === undefined ? delete process.env.CRON_SECRET : process.env.CRON_SECRET = previous; }
});

test('only the teaching code reads the raw description; the record type used by the run log cannot carry one', async () => {
  const snap = await readFile(new URL('../../server/publisher-snapshot.ts', import.meta.url), 'utf8');
  const record = snap.slice(snap.indexOf('export interface ScreenedRecord'), snap.indexOf('const DAY'));
  assert(!/description/i.test(record), 'ScreenedRecord has no description field');
  const refresh = await readFile(new URL('../../server/publisher-refresh.ts', import.meta.url), 'utf8');
  assert(!/screeningLogLines\([^)]*descriptions/.test(refresh), 'the log call never receives the descriptions map');
});

test('the terms records carry the General Counsel wording and only enabled sources allow a teaching description', async () => {
  const config = JSON.parse(await readFile(new URL('../../config/feeds.json', import.meta.url), 'utf8'));
  const NEW = "Descriptions are never stored or shown publicly. They are kept unchanged in the private teaching batch for up to 14 days for Alex's labeling (GC ruling, October 21, 2026) and, only where this record sets archiveAllowed to true, in the private training archive (GC ruling, October 22, 2026).";
  for (const id of ['mongabay', 'mongabay-upbeat', 'globalvoices', 'globalvoices-main', 'globalvoices-featured', 'globalvoices-africa']) {
    const pf = config.sources.find?.(s => s.id === id)?.publisherFeed ?? config.sources[id]?.publisherFeed;
    assert(pf.exceptions.includes(NEW), `${id} records the October 21 ruling`);
    assert(!/used only for private screening/.test(pf.exceptions), `${id} no longer says descriptions are used only for private screening`);
    assert.equal(pf.teachingDescription, true, id);
    assert.equal(pf.summary, false, `${id} still stores no public summary`);
  }
  const list = Array.isArray(config.sources) ? config.sources : Object.values(config.sources);
  for (const s of list) if (!s.publisherFeed?.enabled) assert.notEqual(s.publisherFeed?.teachingDescription, true, `${s.id} is not enabled`);
});

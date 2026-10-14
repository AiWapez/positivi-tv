import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../../server/collect.mjs';
import { buildSnapshot } from '../../server/publisher-snapshot.ts';
import { buildCombinedFeed, projectPublisherFeed } from '../../src/lib/publisher-feed.ts';
import { validPublicStory } from '../../src/lib/publication.ts';
import { POLICY_VERSION } from '../../src/goodsignal/types.ts';
import { createSnapshotReader } from '../../server/publisher-store.ts';
import { NOW, sources, control, candidate, feeds, rss, item } from './publisher-fixtures.mjs';
const licensed = () => sources({ alpha: { ...sources().alpha, publisherFeed: { ...sources().alpha.publisherFeed,
  requiresAuthor: true, license: { name: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/' },
  blockedCredits: ['Associated Press', 'republished from'] } } });
const build = (candidates, previous = null) => buildSnapshot(previous, [{ sourceId: 'alpha', ok: true, candidates }], licensed(), control({ locationResolver: 'off' }), NOW);
const good = extra => candidate('alpha', 'forest', 'Volunteers restore wetland', { author: 'A. Reporter', ...extra });
test('a first-read cache miss does not hide the first successful collection for the full good-read TTL', async () => {
  let clock = 0, snapshot = null, reads = 0;
  const reader = createSnapshotReader(async () => { reads++; return snapshot ? { snapshot } : null; }, { clock: () => clock, okTtlMs: 1800000, failTtlMs: 60000 });
  assert.equal((await reader()).status, 'unavailable');
  snapshot = build([good()]); clock = 60001;
  assert.equal((await reader()).status, 'ok'); assert.equal(reads, 2);
});
test('collector preserves supplied RSS/Atom author credits without leaking HTML', () => {
  const [c] = parseFeed(rss([item('alpha.example.org', 'forest', 'Volunteers restore wetland', { 'dc:creator': '<b>A. Reporter</b>', 'dc:rights': 'CC BY 3.0' })]), feeds()[0], NOW);
  assert.equal(c.author, 'A. Reporter'); assert.equal(c.rights, 'CC BY 3.0');
  const atom = '<feed><entry><title>Volunteers restore wetland</title><link href="https://alpha.example.org/articles/forest"/><published>2026-10-13T00:00:00Z</published><author><name>A. Reporter</name></author><author><name>B. Reporter</name></author></entry></feed>';
  assert.equal(parseFeed(atom, feeds()[0], NOW)[0].author, 'A. Reporter, B. Reporter');
});
test('licensed sources require author credit; syndicated and explicitly restricted items are omitted', () => {
  for (const change of [{ author: null }, { author: '' }, { author: 'x'.repeat(501) }, { author: 'Associated Press' }, { rights: 'All rights reserved' }, { body: 'This was republished from another outlet.' }]) assert.equal(build([good(change)]).items.length, 0);
});
test('public licensed card carries author, license and original URL without body or rights text', () => {
  const snapshot = build([good()]);
  const [card] = projectPublisherFeed(snapshot, control({ locationResolver: 'off' }), licensed(), NOW).stories;
  assert.equal(card.attribution.author, 'A. Reporter'); assert.equal(card.attribution.licenseName, 'CC BY 3.0');
  assert.equal(card.attribution.licenseUrl, 'https://creativecommons.org/licenses/by/3.0/');
  assert.equal(card.sourceUrl, good().url); assert.equal(card.lat, null); assert.equal(card.summary, null);
  assert.equal(Object.hasOwn(card, 'body'), false); assert.equal(Object.hasOwn(card, 'rights'), false);
  assert(validPublicStory({ ...card, expiresAt: '2026-11-01T00:00:00Z', policyVersion: POLICY_VERSION }));
  assert(!validPublicStory({ ...card, attribution: { ...card.attribution, licenseUrl: 'javascript:alert(1)' }, expiresAt: '2026-11-01T00:00:00Z', policyVersion: POLICY_VERSION }));
});
test('a later permission change immediately hides stored rows lacking required attribution', () => {
  const snapshot = build([good()]); delete snapshot.items[0].author;
  assert.equal(projectPublisherFeed(snapshot, control(), licensed(), NOW).stories.length, 0);
});
test('author corrections increment versions instead of silently reusing an old card version', () => {
  const snapshot = build([good()]); const next = build([good({ author: 'B. Reporter' })], snapshot);
  assert.equal(next.items[0].version, snapshot.items[0].version + 1);
});
test('release content gate accepts publisher-only content and refuses empty or stale snapshots', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const config = (await import('../../config/feeds.json', { with: { type: 'json' } })).default;
  const settings = (await import('../../config/publisher-feed.json', { with: { type: 'json' } })).default;
  const now = new Date().toISOString(), dir = await mkdtemp(join(tmpdir(), 'ptv-release-'));
  try {
    const snapshot = buildSnapshot(null, [{ sourceId: 'nasa', ok: true, candidates: [{ ...good(), id: 'nasa-synthetic', sourceId: 'nasa', url: 'https://www.nasa.gov/article/synthetic-test', publishedAt: now, firstRetrievedAt: now }] }], config.sources, settings, now);
    const path = join(dir, 'snapshot.json'); await writeFile(path, JSON.stringify(snapshot));
    const script = new URL('../../scripts/release-check.mjs', import.meta.url).pathname;
    let run = spawnSync(process.execPath, [script, '--publisher-snapshot', path], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout + run.stderr); assert.match(run.stdout, /0 reviewed stories and 1 publisher-feed/);
    run = spawnSync(process.execPath, [script], { encoding: 'utf8' }); assert.equal(run.status, 1); assert.match(run.stderr, /Release blocked/);
    snapshot.generatedAt = new Date(Date.now() - 3 * 86400000).toISOString(); await writeFile(path, JSON.stringify(snapshot));
    run = spawnSync(process.execPath, [script, '--publisher-snapshot', path], { encoding: 'utf8' }); assert.equal(run.status, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

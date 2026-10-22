import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, readdir, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { archiveAllowedFor, buildArchive, serializeArchive, archiveFilePath, ARCHIVE_FIELDS, LINK_ONLY_REASONS } from '../../server/private-archive.ts';
import { runBuildArchive, insideRepo } from '../../scripts/build-archive.mjs';
import { sources, permission } from './publisher-fixtures.mjs';

const run = promisify(execFile);
const ROOT = new URL('../../', import.meta.url).pathname;
// Synthetic stories only. No real publisher text is used in tests.
const rec = (slug, overrides = {}) => ({ source: 'Alpha News', link: `https://alpha.example.org/articles/${slug}`, headline: `Synthetic headline ${slug}`, published: '2026-10-21T08:00:00.000Z',
  decision: 'exclude', reasons: ['NO_COMPLETED_OUTCOME'], policy: 'publisher-feed-0.5.0', description: `Synthetic description ${slug}.`, ...overrides });
const ALLOWED = () => sources({ alpha: { ...sources().alpha, publisherFeed: permission({ archiveAllowed: true }) } });

test('every source states archiveAllowed explicitly, true only for the nine enabled sources General Counsel named', async () => {
  const config = JSON.parse(await readFile(new URL('../../config/feeds.json', import.meta.url), 'utf8'));
  const TRUE = ['nasa', 'nsf', 'noaa', 'mongabay', 'mongabay-upbeat', 'globalvoices', 'globalvoices-main', 'globalvoices-featured', 'globalvoices-africa'];
  for (const [id, source] of Object.entries(config.sources)) {
    const pf = source.publisherFeed;
    assert.equal(typeof pf.archiveAllowed, 'boolean', `${id} sets archiveAllowed explicitly`);
    assert.equal(pf.archiveAllowed, TRUE.includes(id), `${id} matches the October 22 ruling`);
    if (pf.archiveAllowed) assert.equal(source.enabled && pf.enabled, true, `${id} is enabled`);
    assert.match(pf.retentionNote ?? '', /30 days|7 days/, `${id} has a retention note`);
    assert.match(pf.retentionNote, /October 22, 2026/, `${id} retention note cites the ruling`);
  }
  assert.equal(config.sources['mongabay-india'].publisherFeed.archiveAllowed, false, 'Mongabay India stays out');
  assert.equal(config.sources.theconversation.publisherFeed.archiveAllowed, false, 'a source not named stays out');
});

test('a source name is archived only when every source using it is on and allows it', () => {
  assert.equal(archiveAllowedFor('Alpha News', ALLOWED()), true);
  assert.equal(archiveAllowedFor('Alpha News', sources()), false, 'no setting means no');
  assert.equal(archiveAllowedFor('Nobody', ALLOWED()), false, 'unknown name');
  assert.equal(archiveAllowedFor('Alpha News', sources({ alpha: { ...sources().alpha, publisherFeed: permission({ archiveAllowed: 'true' }) } })), false, 'only the boolean true counts');
  assert.equal(archiveAllowedFor('Alpha News', sources({ alpha: { ...sources().alpha, enabled: false, publisherFeed: permission({ archiveAllowed: true }) } })), false, 'a switched-off source is not archived');
  const shared = { ...ALLOWED(), alpha2: { id: 'alpha2', displayName: 'Alpha News', domains: ['alpha.example.org'], enabled: true, publisherFeed: permission({ archiveAllowed: false }) } };
  assert.equal(archiveAllowedFor('Alpha News', shared), false, 'one source without permission blocks the shared name');
});

test('the archive keeps exactly the fields General Counsel listed and nothing else', () => {
  assert.deepEqual([...ARCHIVE_FIELDS], ['source', 'link', 'headline', 'description', 'published', 'label', 'reasons', 'policy', 'labelDate']);
  const batch = [rec('a', { summary: 'must not copy', authors: ['A Writer'], image: 'https://alpha.example.org/x.jpg', decision: 'list', reasons: [] })];
  const { records, counts } = buildArchive(batch, [{ link: batch[0].link, label: ' Keep ', at: '2026-10-22T15:22:20.615Z' }], ALLOWED(), '2026-10-22');
  assert.equal(counts.archived, 1);
  assert.deepEqual(Object.keys(records[0]).sort(), [...ARCHIVE_FIELDS].sort());
  assert.equal(records[0].label, 'keep', 'label normalised');
  assert.equal(records[0].labelDate, '2026-10-22');
  assert.equal(records[0].description, 'Synthetic description a.', 'description is stored unchanged');
  const line = serializeArchive(records);
  assert(!/must not copy|A Writer|x\.jpg/.test(line));
  assert.deepEqual(Object.keys(JSON.parse(line)), [...ARCHIVE_FIELDS], 'fixed field order');
});

test('label date comes from the label, with the batch day as the fallback', () => {
  const batch = [rec('a'), rec('b')];
  const { records } = buildArchive(batch, [{ link: batch[0].link, label: 'reject', at: '2026-10-23T01:00:00Z' }, { link: batch[1].link, label: 'unsure' }], ALLOWED(), '2026-10-22');
  assert.deepEqual(records.map(r => r.labelDate), ['2026-10-23', '2026-10-22']);
  assert.throws(() => buildArchive(batch, [], ALLOWED(), 'yesterday'));
});

test('a source without permission is left out completely and counted', () => {
  const batch = [rec('a'), rec('b', { source: 'Beta Science' })];
  const { records, counts } = buildArchive(batch, batch.map(r => ({ link: r.link, label: 'reject' })), ALLOWED(), '2026-10-22');
  assert.deepEqual(records.map(r => r.source), ['Alpha News']);
  assert.equal(counts.skippedNotAllowed, 1);
  assert(!serializeArchive(records).includes('beta.example.org'), 'not even the link of a source without permission');
});

test('a third-party credit keeps the link and label only', () => {
  assert(LINK_ONLY_REASONS.includes('THIRD_PARTY_CREDIT'));
  const batch = [rec('a', { reasons: ['THIRD_PARTY_CREDIT'] })];
  const { records, counts } = buildArchive(batch, [{ link: batch[0].link, label: 'keep' }], ALLOWED(), '2026-10-22');
  assert.equal(records[0].headline, null);
  assert.equal(records[0].description, null);
  assert.equal(records[0].link, batch[0].link);
  assert.equal(counts.linkOnly, 1);
});

test('labels that match nothing, carry an unknown label or repeat a link are counted and skipped', () => {
  const batch = [rec('a')];
  const { records, counts } = buildArchive(batch, [
    { link: 'https://alpha.example.org/articles/missing', label: 'keep' },
    { link: batch[0].link, label: 'maybe' },
    { link: batch[0].link, label: 'keep' },
    { link: batch[0].link, label: 'reject' },
    { link: 42, label: 'keep' },
  ], ALLOWED(), '2026-10-22');
  assert.equal(records.length, 1);
  assert.deepEqual(counts, { archived: 1, linkOnly: 0, skippedNotAllowed: 0, skippedNoBatchMatch: 2, skippedBadLabel: 1, skippedDuplicate: 1 });
  assert.equal(records[0].label, 'keep', 'the first label for a link wins');
});

test('output helpers', () => {
  assert.equal(serializeArchive([]), '');
  assert.equal(archiveFilePath('2026-10-22'), 'archive/2026-10-22.jsonl');
  assert.throws(() => archiveFilePath('../x'));
});

test('the archive module cannot reach the network, files, the environment or a log', async () => {
  const source = await readFile(new URL('../../server/private-archive.ts', import.meta.url), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const banned of [/\bfetch\s*\(/, /node:(fs|http|https|net|child_process)/, /process\.env/, /console\./, /api\.github\.com/, /XMLHttpRequest/]) assert(!banned.test(code), String(banned));
});

test('the script refuses to write inside the repository and prints counts only', async () => {
  assert.equal(insideRepo(path.join(ROOT, 'archive')), true);
  assert.equal(insideRepo(ROOT), true);
  assert.equal(insideRepo(path.join(tmpdir(), 'elsewhere')), false);
  const dir = await mkdtemp(path.join(tmpdir(), 'archive-test-'));
  await symlink(ROOT, path.join(dir, 'link-into-repo'));
  assert.equal(insideRepo(path.join(dir, 'link-into-repo', 'archive')), true, 'a symbolic link into the repository does not get around the rule');
  const batch = { date: '2026-10-22', records: [rec('a'), rec('b', { source: 'Beta Science' })] };
  const config = { sources: { alpha: { ...ALLOWED().alpha }, beta: { ...ALLOWED().beta } } };
  await writeFile(path.join(dir, 'batch.json'), JSON.stringify(batch));
  await writeFile(path.join(dir, 'labels.json'), JSON.stringify(batch.records.map(r => ({ link: r.link, label: 'reject', at: '2026-10-22T10:00:00Z' }))));
  await writeFile(path.join(dir, 'feeds.json'), JSON.stringify(config));
  const out = path.join(dir, 'out');
  await assert.rejects(runBuildArchive({ batchPath: path.join(dir, 'batch.json'), labelsPath: path.join(dir, 'labels.json'), outDir: path.join(ROOT, 'archive-test'), feedsPath: path.join(dir, 'feeds.json') }), /inside the PositiviTV repository/);
  const counts = await runBuildArchive({ batchPath: path.join(dir, 'batch.json'), labelsPath: path.join(dir, 'labels.json'), outDir: out, feedsPath: path.join(dir, 'feeds.json') });
  assert.equal(counts.archived, 1);
  assert.equal(counts.skippedNotAllowed, 1);
  const file = path.join(out, 'archive', '2026-10-22.jsonl');
  const lines = (await readFile(file, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(lines.length, 1);
  assert.equal(((await stat(file)).mode & 0o077), 0, 'file is private to its owner');
  assert.deepEqual(await readdir(path.join(out, 'archive')), ['2026-10-22.jsonl']);
  // Through the real command line: stdout is counts only.
  const cli = await run(process.execPath, [path.join(ROOT, 'scripts/build-archive.mjs'), '--batch', path.join(dir, 'batch.json'), '--labels', path.join(dir, 'labels.json'), '--out', path.join(dir, 'out2')]);
  assert(!/Synthetic|alpha\.example|http/.test(cli.stdout + cli.stderr), 'no story text or link is printed');
  assert.equal(JSON.parse(cli.stdout).archived, 0, 'real config has no source named Alpha News');
});

test('the repository documents the archive rules and ignores nothing it should not', async () => {
  const doc = await readFile(new URL('../../docs/publisher-feed.md', import.meta.url), 'utf8');
  for (const phrase of ['Private training archive', 'October 22, 2026', 'archiveAllowed', 'within 7 days', 'once a year', 'Security Lead']) assert(doc.includes(phrase), phrase);
  const gitignore = await readFile(new URL('../../.gitignore', import.meta.url), 'utf8');
  assert(/^\/archive\/$/m.test(gitignore), 'a stray archive folder at the top can never be committed here, and the rule does not hide other folders');
});

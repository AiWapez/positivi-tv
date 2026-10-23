import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runStricterOnly, insideRepo } from '../../scripts/check-stricter-only.mjs';

const exec = promisify(execFile);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GOOD = 'Volunteers restore wetland in Kenya';
const SOFT = 'Wetland group plans new reserve in Kenya';
const BAD = 'Three killed in bus crash near capital';

/** A tiny stand-in for a checkout of another policy version: screenHeadline always answers the same way. */
async function fakeCheckout(decision, reasons, overridable = ['NO_COMPLETED_OUTCOME', 'PLAN_OR_UNCERTAIN']) {
  const dir = await mkdtemp(path.join(tmpdir(), 'stricter-fake-'));
  await mkdir(path.join(dir, 'server'), { recursive: true }); await mkdir(path.join(dir, 'src', 'lib'), { recursive: true });
  await writeFile(path.join(dir, 'server', 'publisher-screen.ts'), `export function screenHeadline() { return { decision: ${JSON.stringify(decision)}, reasons: ${JSON.stringify(reasons)}, labels: [], category: null }; }\n`);
  await writeFile(path.join(dir, 'src', 'lib', 'publisher-feed.ts'), `export const PICK_OVERRIDABLE_REASONS = ${JSON.stringify(overridable)};\nexport const PUBLISHER_FEED_POLICY = 'fake-1';\n`);
  return dir;
}
async function dataFolder() {
  const dir = await mkdtemp(path.join(tmpdir(), 'stricter-data-'));
  const lines = [
    { link: 'https://x.example/1', headline: GOOD, description: 'd', label: 'keep' },
    { link: 'https://x.example/2', headline: SOFT, description: 'd', label: 'keep' },
    { link: 'https://x.example/3', headline: BAD, description: 'd', label: 'reject' },
    { link: 'https://x.example/3', headline: BAD, description: 'd', label: 'reject' },
    { link: 'https://x.example/4', headline: null, description: null, label: 'keep' },
  ];
  await writeFile(path.join(dir, '2026-10-21.jsonl'), lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  await writeFile(path.join(dir, 'batch.json'), JSON.stringify({ date: '2026-10-22', records: [{ link: 'https://x.example/5', headline: 'Student team builds solar boat', description: 'd' }] }));
  return dir;
}

test('the same rules on both sides loosen nothing', async () => {
  const data = await dataFolder();
  const counts = await runStricterOnly({ oldDir: REPO, newDir: REPO, dataDir: data });
  assert.equal(counts.storiesChecked, 4, 'duplicate links count once; a record with no headline is skipped');
  assert.equal(counts.skippedNoHeadline, 1);
  assert.equal(counts.loosened, 0); assert.equal(counts.pickLoosened, 0); assert.equal(counts.newlyHeldBack, 0); assert.equal(counts.picksLost, 0);
});

test('a loosened story is detected: old holds everything back, new lists some', async () => {
  const data = await dataFolder();
  const counts = await runStricterOnly({ oldDir: await fakeCheckout('exclude', ['HARM_EVENT']), newDir: REPO, dataDir: data });
  assert(counts.loosened >= 2, `loosened ${counts.loosened}`);
});

test('a story that becomes pickable is detected even though it was never listed', async () => {
  const data = await dataFolder();
  const counts = await runStricterOnly({ oldDir: await fakeCheckout('exclude', ['HARM_EVENT']), newDir: REPO, dataDir: data });
  assert(counts.pickLoosened >= 1, `pickLoosened ${counts.pickLoosened}`);
});

test('newly held back and picks lost are counted, by label, with no text', async () => {
  const data = await dataFolder();
  const counts = await runStricterOnly({ oldDir: await fakeCheckout('list', []), newDir: REPO, dataDir: data });
  assert.equal(counts.loosened, 0);
  assert(counts.newlyHeldBack >= 2);
  assert(counts.newlyHeldBackByLabel.keep >= 1 && counts.newlyHeldBackByLabel.reject >= 1);
  const stricter = await runStricterOnly({ oldDir: await fakeCheckout('exclude', ['NO_COMPLETED_OUTCOME']), newDir: await fakeCheckout('exclude', ['HARM_EVENT']), dataDir: data });
  assert(stricter.picksLost >= 1, 'a story pickable before and hard-banned now is a lost pick');
  assert(stricter.newReasonsByLabel.keep >= 1);
});

test('the command line prints counts only and fails when anything loosens', async () => {
  const data = await dataFolder();
  const loose = await fakeCheckout('exclude', ['HARM_EVENT']);
  await assert.rejects(exec('node', [path.join(REPO, 'scripts', 'check-stricter-only.mjs'), '--old', loose, '--new', REPO, '--data', data]), error => {
    assert.equal(error.code, 1);
    for (const banned of ['wetland', 'Wetland', 'Kenya', 'killed', 'solar', 'x.example', 'HARM_EVENT', 'NO_COMPLETED_OUTCOME']) assert(!error.stdout.includes(banned) && !error.stderr.includes(banned), banned);
    assert(JSON.parse(error.stdout).loosened > 0);
    return true;
  });
  const ok = await exec('node', [path.join(REPO, 'scripts', 'check-stricter-only.mjs'), '--old', REPO, '--new', REPO, '--data', data]);
  assert.equal(JSON.parse(ok.stdout).loosened, 0);
});

test('it refuses to read labelled sets from inside this repository, including through a link', async () => {
  await assert.rejects(runStricterOnly({ oldDir: REPO, newDir: REPO, dataDir: path.join(REPO, 'tests') }), /inside the PositiviTV repository/);
  assert.equal(insideRepo(path.join(REPO, 'docs')), true);
  assert.equal(insideRepo(await mkdtemp(path.join(tmpdir(), 'outside-'))), false);
});

test('the script has no network, log or write path beyond printing the counts', async () => {
  const source = await readFile(path.join(REPO, 'scripts', 'check-stricter-only.mjs'), 'utf8');
  for (const forbidden of ['fetch(', 'node:http', 'node:https', 'node:net', 'writeFile', 'appendFile', 'process.env', 'console.error(error)', 'console.error(story', 'console.log(story'])
    assert(!source.includes(forbidden), forbidden);
});

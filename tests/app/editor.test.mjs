import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { story, context } from '../goodsignal/fixtures.mjs';
import { POLICY_VERSION } from '../../src/goodsignal/types.ts';

test('editor import, grounded review, publish, revise and withdrawal work as one flow', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'positivitv-editor-'));
  try {
    for (const path of ['scripts','src/goodsignal','src/lib','src/types','server','content']) await cp(new URL('../../' + path, import.meta.url), join(dir,path), { recursive: true });
    await writeFile(join(dir,'package.json'), '{"type":"module"}'); await mkdir(join(dir,'.editor'));
    const sources = Object.fromEntries(Object.entries(context().sources).map(([id,s]) => [id, { ...s, displayName: 'Synthetic publisher' }]));
    await writeFile(join(dir,'.editor/sources.json'), JSON.stringify(sources));
    const now = new Date().toISOString(), day = now.slice(0,10);
    const candidate = story({ status: 'pending', review: undefined, publishedAt: now, firstRetrievedAt: now, eventDate: { value: day, precision: 'day', basis: 'reviewer' } });
    await writeFile(join(dir,'candidate.json'), JSON.stringify(candidate));
    const run = (...args) => spawnSync(process.execPath, [join(dir,'scripts/editor.mjs'),...args], { cwd: dir, encoding: 'utf8' });
    let result = run('import','candidate.json'); assert.equal(result.status,0,result.stderr);
    const local = async () => JSON.parse(await readFile(join(dir,'.editor/candidates/' + candidate.id + '.json'),'utf8'));
    assert.equal((await local()).status,'pending');
    result = run('inspect',candidate.id); assert.equal(result.status,0,result.stderr); assert.equal(JSON.parse(result.stdout).assessment.recommendation,'ready_for_review');
    const decision = { ...story().review, policyVersion: POLICY_VERSION, storyVersion: 1, at: new Date().toISOString() };
    await writeFile(join(dir,'decision.json'), JSON.stringify(decision));
    result = run('review',candidate.id,'decision.json'); assert.equal(result.status,0,result.stderr);
    result = run('publish'); assert.equal(result.status,0,result.stderr);
    let edition = JSON.parse(await readFile(join(dir,'content/edition.json'),'utf8')); assert.equal(edition.stories.length,1); assert.equal(edition.stories[0].isDemo,false); assert(!JSON.stringify(edition).includes(candidate.body));
    result = run('import','candidate.json'); assert.equal(result.status,0,result.stderr); assert.equal((await local()).version,2); assert.equal((await local()).review,undefined);
    result = run('review',candidate.id,'decision.json'); assert.notEqual(result.status,0); // old approval is invalid after revision
    result = run('withdraw',candidate.id); assert.equal(result.status,0,result.stderr);
    edition = JSON.parse(await readFile(join(dir,'content/edition.json'),'utf8')); assert.equal(edition.stories.length,0); assert.equal(edition.statuses[candidate.id].status,'withdrawn');
    assert.notEqual(run('inspect','../../outside').status,0);
  } finally { await rm(dir,{ recursive:true,force:true }); }
});

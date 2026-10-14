import { readFile, writeFile, mkdir, rename, readdir, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { assessCandidate, applyHumanDecision, reviseStory, withdrawStory, validateStory } from '../src/goodsignal/index.ts';
import { publishEdition } from '../server/publish.ts';
const root = new URL('../', import.meta.url), workspace = new URL('.editor/', root), content = new URL('content/edition.json', root);
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const write = async (file, data) => { const temp = new URL(file.href + '.' + randomUUID() + '.tmp'); await writeFile(temp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 }); await rename(temp, file); };
const idPath = id => { if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id ?? '')) throw new Error('Use an ID of 1–100 letters, digits, underscores or hyphens.'); return new URL('candidates/' + id + '.json', workspace); };
await mkdir(new URL('candidates/', workspace), { recursive: true }); await mkdir(new URL('history/', workspace), { recursive: true });
const lock = new URL('editor.lock', workspace);
let locked = false;
try {
  await writeFile(lock, String(process.pid), { flag: 'wx', mode: 0o600 }); locked = true;
  const [command, arg, decision] = process.argv.slice(2), now = new Date().toISOString();
  const context = async () => ({ now, sources: await read(new URL('sources.json', workspace)) });
  const savePrivate = async s => { await write(new URL(`history/${s.id}-${s.version}-${randomUUID()}.json`, workspace), s); await write(idPath(s.id), s); };
  if (command === 'import') {
    const supplied = await read(resolve(arg)); const errors = validateStory(supplied); if (errors.length) throw new Error(errors.join(', '));
    const target = idPath(supplied.id); let previous = null;
    try { previous = await read(target); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const s = previous ? reviseStory(previous, { ...supplied, firstRetrievedAt: previous.firstRetrievedAt }) : { ...supplied, version: 1, status: 'pending' };
    delete s.review; await savePrivate(s); console.log(`Imported ${s.id} v${s.version} as pending. No publication occurred.`);
  } else if (command === 'inspect') {
    const s = await read(idPath(arg)); const c = await context();
    console.log(JSON.stringify({ id: s.id, version: s.version, title: s.title, summary: s.summary, source: s.url,
      publishedAt: s.publishedAt, eventDate: s.eventDate, originDate: s.originDate, stage: s.stage, frame: s.frame,
      outcomeQuote: s.outcomeQuote, outcomeContext: s.outcomeQuote && s.body.includes(s.outcomeQuote) ? s.body.slice(Math.max(0, s.body.indexOf(s.outcomeQuote) - 200), s.body.indexOf(s.outcomeQuote) + s.outcomeQuote.length + 200) : null,
      quantities: s.quantities, evidence: s.evidence, location: s.location, sourcePolicy: c.sources[s.sourceId], assessment: assessCandidate(s, c) }, null, 2));
  } else if (command === 'review') {
    const s = await read(idPath(arg)), review = await read(resolve(decision));
    const next = applyHumanDecision(s, review, await context()); await savePrivate(next); console.log(`Recorded ${next.status} for ${next.id} v${next.version}. Run publish after reviewing the edition.`);
  } else if (command === 'publish') {
    const c = await context(); const files = (await readdir(new URL('candidates/', workspace))).filter(f => f.endsWith('.json'));
    const candidates = await Promise.all(files.map(f => read(new URL('candidates/' + f, workspace)))); const previous = await read(content);
    const missing = previous.stories.filter(s => !candidates.some(x => x.id === s.id));
    if (missing.length) throw new Error('Restore the complete private workspace before publishing. Missing: ' + missing.map(s => s.id).join(', '));
    const edition = publishEdition(candidates, c.sources, previous, now); await write(content, edition);
    console.log(`Prepared ${edition.stories.length} reviewed cards in content/edition.json. Inspect and commit that file, then deploy. No article bodies or private notes are included.`);
  } else if (command === 'withdraw') {
    idPath(arg); const edition = await read(content), prior = edition.statuses[arg]; if (!prior) throw new Error('Unknown published ID');
    edition.statuses[arg] = { version: prior.version + 1, status: 'withdrawn' }; edition.stories = edition.stories.filter(s => s.id !== arg);
    edition.revision = `edition-${now}`; edition.updatedAt = now; await write(content, edition);
    try { await savePrivate(withdrawStory(await read(idPath(arg)))); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    console.log('Withdrawal prepared. Commit content/edition.json and deploy; existing deployments remain unchanged until then.');
  } else throw new Error('Usage: npm run editor -- import file.json | inspect ID | review ID decision.json | publish | withdraw ID');
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { if (locked) await unlink(lock); }

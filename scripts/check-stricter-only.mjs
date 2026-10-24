#!/usr/bin/env node
// Permanent "stricter only" check for screening-policy changes (General Counsel condition, October 23, 2026).
//
// Usage: node scripts/check-stricter-only.mjs --old <checkout of the old policy> --new <checkout of the new policy> --data <folder of private labelled sets> [--now <ISO time>]
//
// It loads screenHeadline from each checkout, runs both over every saved labelled story and asserts two things:
//   1. no story is listed by the new policy unless the old policy listed it, and
//   2. no story is pickable under the new policy unless it was pickable under the old one
//      (pickable = held back only for the reasons a person's pick may override).
// The labelled sets hold publisher text and are private. They are read from the folder you give it, which must be outside this repository.
// The script prints counts only: never a headline, description, link, story code or reason code. The exit code is 1 if either property fails.
//
// Accepted files in --data: archive files (*.jsonl, one JSON object per line with headline, description, label) and teaching batches (*.json,
// either a list of records or { records: [...] } with headline and description). Stories are deduplicated by link when there is one.
import { readFile, readdir, stat } from 'node:fs/promises';
import { realpathSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_NOW = '2026-10-23T12:00:00Z';
const LABELS = ['keep', 'reject', 'unsure'];

function realLocation(target) {
  let existing = path.resolve(target); const rest = [];
  while (!existsSync(existing)) { rest.unshift(path.basename(existing)); const parent = path.dirname(existing); if (parent === existing) break; existing = parent; }
  return path.join(realpathSync(existing), ...rest);
}
/** True when `target` is this repository's folder or anything inside it, including through a symbolic link. */
export function insideRepo(target, repoRoot = REPO_ROOT) {
  const relative = path.relative(realLocation(repoRoot), realLocation(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function loadPolicy(checkout) {
  const base = path.resolve(checkout);
  const screen = await import(pathToFileURL(path.join(base, 'server', 'publisher-screen.ts')).href);
  const feed = await import(pathToFileURL(path.join(base, 'src', 'lib', 'publisher-feed.ts')).href);
  if (typeof screen.screenHeadline !== 'function' || !Array.isArray(feed.PICK_OVERRIDABLE_REASONS)) throw new Error('A checkout does not hold the screening rules.');
  return { screen: screen.screenHeadline, overridable: feed.PICK_OVERRIDABLE_REASONS, version: String(feed.PUBLISHER_FEED_POLICY ?? '') };
}

async function loadStories(dataDir) {
  const names = (await readdir(dataDir)).filter(n => n.endsWith('.jsonl') || n.endsWith('.json')).sort();
  const byKey = new Map(); let skippedNoHeadline = 0;
  for (const name of names) {
    const text = await readFile(path.join(dataDir, name), 'utf8');
    let rows;
    if (name.endsWith('.jsonl')) rows = text.split('\n').filter(Boolean).map(line => JSON.parse(line));
    else { const parsed = JSON.parse(text); rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : []; }
    for (const row of rows) {
      if (!row || typeof row.headline !== 'string' || !row.headline) { skippedNoHeadline++; continue; }
      const key = typeof row.link === 'string' && row.link ? row.link : `${name}#${byKey.size}`;
      if (!byKey.has(key)) byKey.set(key, { headline: row.headline, description: typeof row.description === 'string' ? row.description : '', label: LABELS.includes(row.label) ? row.label : 'unlabelled' });
    }
  }
  return { stories: [...byKey.values()], skippedNoHeadline };
}

const pickable = (result, overridable) => result.decision === 'exclude' && result.reasons.length > 0 && result.reasons.every(r => overridable.includes(r));

/** Returns the counts only. */
export async function runStricterOnly({ oldDir, newDir, dataDir, now = DEFAULT_NOW }) {
  if (!oldDir || !newDir || !dataDir) throw new Error('Give --old, --new and --data.');
  if (insideRepo(dataDir)) throw new Error('Refusing to read labelled sets from inside the PositiviTV repository. They are private.');
  const [oldPolicy, newPolicy, data] = await Promise.all([loadPolicy(oldDir), loadPolicy(newDir), loadStories(path.resolve(dataDir))]);
  const counts = { storiesChecked: data.stories.length, skippedNoHeadline: data.skippedNoHeadline, loosened: 0, pickLoosened: 0, newlyHeldBack: 0,
    newlyHeldBackByLabel: { keep: 0, reject: 0, unsure: 0, unlabelled: 0 }, newReasonsByLabel: { keep: 0, reject: 0, unsure: 0, unlabelled: 0 }, picksLost: 0, oldPolicy: oldPolicy.version, newPolicy: newPolicy.version };
  for (const story of data.stories) {
    const input = { title: story.headline, description: story.description, defaultCategory: 'auto', now };
    const before = oldPolicy.screen(input), after = newPolicy.screen(input);
    if (after.decision === 'list' && before.decision !== 'list') counts.loosened++;
    if (pickable(after, newPolicy.overridable) && !pickable(before, oldPolicy.overridable)) counts.pickLoosened++;
    if (before.decision === 'list' && after.decision !== 'list') { counts.newlyHeldBack++; counts.newlyHeldBackByLabel[story.label]++; }
    if (after.reasons.some(r => !before.reasons.includes(r))) counts.newReasonsByLabel[story.label]++;
    if (pickable(before, oldPolicy.overridable) && !pickable(after, newPolicy.overridable)) counts.picksLost++;
  }
  return counts;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []));
  runStricterOnly({ oldDir: args.old, newDir: args.new, dataDir: args.data, now: args.now })
    .then(counts => { console.log(JSON.stringify(counts)); if (counts.loosened > 0 || counts.pickLoosened > 0) process.exitCode = 1; })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

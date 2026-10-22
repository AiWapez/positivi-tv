#!/usr/bin/env node
// Builds one day's file for the private training archive (General Counsel ruling, October 22, 2026; see docs/publisher-feed.md).
//
// Usage: node scripts/build-archive.mjs --batch <batch-YYYY-MM-DD.json> --labels <labels.json or a folder of label files> --out <folder outside this repository>
//
// It reads the day's private teaching batch and Alex's labels from files you give it and writes archive/YYYY-MM-DD.jsonl under --out.
// It makes no network request. It refuses to write anywhere inside this repository, because the archive is private and must never be
// committed here. It prints counts only, never a headline, description or link.
import { readFile, readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArchive, serializeArchive, archiveFilePath } from '../server/private-archive.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** True when `target` is the repository folder or anything inside it. */
export function insideRepo(target, repoRoot = REPO_ROOT) {
  const relative = path.relative(path.resolve(repoRoot), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function readLabels(labelsPath) {
  const info = await stat(labelsPath);
  if (info.isDirectory()) {
    const names = (await readdir(labelsPath)).filter(name => name.endsWith('.json')).sort();
    const labels = [];
    for (const name of names) labels.push(JSON.parse(await readFile(path.join(labelsPath, name), 'utf8')));
    return labels;
  }
  const parsed = JSON.parse(await readFile(labelsPath, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('The labels file must hold a list.');
  return parsed;
}

/** Returns the counts only. */
export async function runBuildArchive({ batchPath, labelsPath, outDir, repoRoot = REPO_ROOT, feedsPath = path.join(repoRoot, 'config', 'feeds.json') }) {
  if (!batchPath || !labelsPath || !outDir) throw new Error('Give --batch, --labels and --out.');
  if (insideRepo(outDir, repoRoot)) throw new Error('Refusing to write inside the PositiviTV repository. The archive is private.');
  const batch = JSON.parse(await readFile(batchPath, 'utf8'));
  const day = typeof batch?.date === 'string' ? batch.date.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(batch.records)) throw new Error('The batch file must hold a date and a list of records.');
  const config = JSON.parse(await readFile(feedsPath, 'utf8'));
  const sources = Object.fromEntries(Object.entries(config.sources).map(([id, s]) => [id, { id, displayName: s.displayName, domains: s.domains, enabled: s.enabled === true, publisherFeed: s.publisherFeed }]));
  const { records, counts } = buildArchive(batch.records, await readLabels(labelsPath), sources, day);
  const file = path.join(path.resolve(outDir), archiveFilePath(day));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, serializeArchive(records), { mode: 0o600 });
  return counts;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []));
  runBuildArchive({ batchPath: args.batch, labelsPath: args.labels, outDir: args.out })
    .then(counts => console.log(JSON.stringify(counts)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

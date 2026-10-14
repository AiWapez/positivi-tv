import { readFile, writeFile, open, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import config from '../config/feeds.json' with { type: 'json' };
import control from '../config/publisher-feed.json' with { type: 'json' };
import { fetchPermittedFeed, parseFeed } from '../server/collect.mjs';
import { buildSnapshot, serializeSnapshot } from '../server/publisher-snapshot.ts';
import { validSnapshot } from '../src/lib/publisher-feed.ts';
const output = new URL('../content/publisher-feed.local.json', import.meta.url);
const lock = new URL('../content/.publisher-feed.local.lock', import.meta.url), token = randomUUID();
const temporary = new URL(`../content/.publisher-feed.local.${token}.tmp`, import.meta.url);
let handle;
try {
  if (!control.enabled) throw new Error('Publisher feeds are disabled in config/publisher-feed.json.');
  try { handle = await open(lock, 'wx', 0o600); await handle.writeFile(token); }
  catch (e) { if (e.code === 'EEXIST') throw new Error('A local refresh is running. If it was interrupted, remove content/.publisher-feed.local.lock before retrying.'); throw e; }
  let previous = null;
  try { previous = JSON.parse(await readFile(output, 'utf8')); if (!validSnapshot(previous)) throw new Error('Invalid local snapshot. Keep a backup and remove it before retrying.'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const now = new Date().toISOString(), results = [];
  for (const feed of config.feeds.filter(f => f.lanes.includes('publisher_feed') && config.sources[f.id]?.enabled && config.sources[f.id]?.publisherFeed?.enabled)) {
    try { const response = await fetchPermittedFeed(feed); results.push({ sourceId: feed.id, ok: true, candidates: parseFeed(response.text, feed, now, 100) }); }
    catch (e) { results.push({ sourceId: feed.id, ok: false, code: String(e.code ?? e.message).slice(0, 120) }); }
  }
  if (!results.length || results.every(r => !r.ok)) throw new Error('Every source failed; the previous local snapshot was kept.');
  const snapshot = buildSnapshot(previous, results, config.sources, control, now, config.feeds.map(f => f.id));
  await writeFile(temporary, serializeSnapshot(snapshot), { flag: 'wx', mode: 0o600 }); await rename(temporary, output);
  console.log(JSON.stringify({ stories: snapshot.items.length, mapped: snapshot.items.filter(s => s.lat !== null).length, failedSources: results.filter(r => !r.ok).map(r => r.sourceId) }));
  console.log('Local snapshot saved. Run npm run dev to explore it. No API key, AI call or cloud storage was used.');
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally {
  if (handle) { await handle.close(); try { if ((await readFile(lock, 'utf8')) === token) await unlink(lock); } catch {} }
  try { await unlink(temporary); } catch {}
}

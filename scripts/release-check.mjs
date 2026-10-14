import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildCombinedFeed } from '../src/lib/publisher-feed.ts';
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const [edition, config, control] = await Promise.all([
  json(new URL('../content/edition.json', import.meta.url)), json(new URL('../config/feeds.json', import.meta.url)), json(new URL('../config/publisher-feed.json', import.meta.url)),
]);
// Explicit private snapshot input only. This read-only gate never crawls, approves or publishes.
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--publisher-snapshot')) throw new Error('Usage: npm run release:check -- [--publisher-snapshot /private/path/snapshot.json]');
const snapshot = args.length ? await json(resolve(args[1])) : null;
const feed = buildCombinedFeed(edition, { snapshot, status: snapshot ? 'ok' : 'unavailable' }, control, config.sources);
const reviewed = feed.stories.filter(s => s.provenance === 'reviewed').length;
if (!feed.stories.length) {
  console.error('Release blocked: no currently eligible stories. Supply a real publisher snapshot with --publisher-snapshot, or prepare a human-reviewed edition. Design samples never satisfy this gate.'); process.exitCode = 1;
} else if (reviewed !== edition.stories.length || snapshot && (feed.publisherFeed.status !== 'ok' || !feed.stories.some(s => s.provenance === 'publisher_feed'))) {
  console.error('Release blocked: the reviewed edition has ineligible records, or the supplied publisher snapshot is stale or has no eligible cards. Regenerate and inspect the source findings.'); process.exitCode = 1;
} else {
  console.log(`Content gate passed: ${reviewed} reviewed stories and ${feed.stories.length - reviewed} publisher-feed stories; ${feed.stories.filter(s => s.lat !== null).length} map locations.`);
  console.log('No approval was created. Browser/device checks, CI and exact-deployment verification remain separate release requirements.');
}

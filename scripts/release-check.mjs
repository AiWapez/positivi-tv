import { readFile } from 'node:fs/promises';
import { buildFeed } from '../src/lib/publication.ts';

// Read-only content gate. It never approves candidates or changes an edition.
const edition = JSON.parse(await readFile(new URL('../content/edition.json', import.meta.url), 'utf8'));
const feed = buildFeed(edition);
if (!feed.stories.length) {
  console.error('Release blocked: no currently eligible, human-reviewed stories. Review the private queue and publish an edition with npm run editor. Sample mode is for design review only.');
  process.exitCode = 1;
} else if (feed.stories.length !== edition.stories.length) {
  console.error('Release blocked: the edition includes expired, withdrawn, duplicate or invalid records. Regenerate the edition and inspect the publication findings.');
  process.exitCode = 1;
} else {
  const located = feed.stories.filter(s => s.lat !== null && s.lng !== null).length;
  console.log(`Content gate passed: ${feed.stories.length} currently eligible reviewed stories; ${located} globe locations. Edition ${feed.revision}.`);
  console.log('This checks content eligibility only. Complete the browser/device checklist and verify CI and the exact deployment before release.');
}

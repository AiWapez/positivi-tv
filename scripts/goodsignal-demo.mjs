import { composeEdition, selectPersonalFeed, scheduleChannel, makeManifest, checkBeforeDisplay } from '../src/goodsignal/index.ts';
import { pool, context } from '../tests/goodsignal/fixtures.mjs';

// Completely synthetic fixture data; this script does not fetch or publish news.
const ctx = context(), edition = composeEdition(pool(40), ctx);
const personal = selectPersonalFeed(edition.stories, ctx, { affinity: { education: 1 }, discovery: true });
const channel = scheduleChannel(edition.stories, ctx), manifest = makeManifest(edition.stories, ctx, 'synthetic-edition-1');
console.log(JSON.stringify({
  warning: 'SYNTHETIC TEST DATA ONLY. No news fetched or published.',
  edition: { stories: edition.stories.length, coverageGaps: edition.coverageGaps, relaxations: edition.relaxations },
  personal: { stories: personal.stories.length, firstIds: personal.stories.slice(0, 5).map(s => s.id) },
  channel: { segments: channel.length, firstIds: channel.slice(0, 5).map(s => s.storyId), firstDisplayCheck: channel.length ? checkBeforeDisplay(channel[0], manifest, ctx.now) : null },
}, null, 2));

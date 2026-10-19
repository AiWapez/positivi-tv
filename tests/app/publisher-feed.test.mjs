import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot } from '../../server/publisher-snapshot.ts';
import { buildCombinedFeed, projectPublisherFeed, PUBLISHER_FEED_POLICY } from '../../src/lib/publisher-feed.ts';
import { validPublicStory, buildFeed, statusMatchesProvenance } from '../../src/lib/publication.ts';
import { checkBeforeDisplay } from '../../src/goodsignal/broadcast.ts';
import { POLICY_VERSION } from '../../src/goodsignal/types.ts';
import { dateLabel, eventLabel, provenanceLabel, qualifierLabels } from '../../src/lib/story-utils.ts';
import { publishEdition } from '../../server/publish.ts';
import { context, story } from '../goodsignal/fixtures.mjs';
import feedConfig from '../../config/feeds.json' with { type: 'json' };
import controlConfig from '../../config/publisher-feed.json' with { type: 'json' };
import { NOW, DAY, ago, sources, control, candidate } from './publisher-fixtures.mjs';
const empty = { schemaVersion: 1, revision: 'empty-1', updatedAt: null, stories: [], statuses: {} };
const snap = (cands = [candidate('alpha', 'a', 'Volunteers restore wetland in Kenya'), candidate('beta', 'b', 'Rover sets record drive')]) =>
  buildSnapshot(null, [{ sourceId: 'alpha', ok: true, candidates: cands.filter(c => c.sourceId === 'alpha') }, { sourceId: 'beta', ok: true, candidates: cands.filter(c => c.sourceId === 'beta') }], sources(), control(), NOW);
const combined = (overrides = {}) => buildCombinedFeed(overrides.edition ?? empty, { snapshot: overrides.snapshot === undefined ? snap() : overrides.snapshot, status: 'ok' },
  control(overrides.control), overrides.sources ?? sources(), overrides.now ?? NOW);

test('automatic cards are labelled publisher_feed, carry visible qualifiers and a "listed" manifest status', () => {
  const feed = combined();
  assert.equal(feed.stories.length, 2);
  for (const s of feed.stories) {
    assert.equal(s.provenance, 'publisher_feed'); assert.equal(s.eventDate, null); assert.match(s.image, /^\/assets\/stories\//); assert.equal(s.archive, false);
    assert(s.labels.includes('event_date_unconfirmed'));
    assert.equal(feed.manifest.stories[s.id].status, 'listed');
    assert(validPublicStory({ ...s, expiresAt: '9999-01-01T00:00:00Z', policyVersion: POLICY_VERSION }), 'client-side validation accepts it');
    assert.equal(checkBeforeDisplay({ storyId: s.id, storyVersion: s.version }, feed.manifest, NOW).allowed, true);
    assert.equal(provenanceLabel(s), 'From publisher feeds');
    assert.match(dateLabel(s), /· Published /); assert.match(eventLabel(s), /not confirmed/);
  }
  assert.equal(feed.manifest.version, feed.revision); assert.equal(feed.publisherFeed.status, 'ok');
  const kenya = feed.stories.find(s => s.location === 'Kenya'); assert(qualifierLabels(kenya).some(t => /country/.test(t)));
});

test('public cards expose no evidence, corroboration, body, screening or duplicate fields', () => {
  for (const s of combined().stories) assert.deepEqual(Object.keys(s).sort(), ['archive', 'category', 'datePrecision', 'eventDate', 'fetchedAt', 'id', 'image', 'imageAlt',
    'imageContext', 'imageCredit', 'isDemo', 'labels', 'lat', 'lng', 'location', 'locationPrecision', 'provenance', 'publishedAt', 'sourceName', 'sourceUrl', 'summary', 'title', 'version']);
});

test('withdrawal by id or URL removes the card and marks the manifest withdrawn', () => {
  const s = snap(), [first, second] = s.items;
  const feed = combined({ snapshot: s, control: { withdrawn: [{ id: first.id, reason: 'test', at: '2026-10-14' }, { url: second.url + '?utm_source=x', reason: 'test', at: '2026-10-14' }] } });
  assert.equal(feed.stories.length, 0);
  assert.equal(feed.manifest.stories[first.id].status, 'withdrawn'); assert.equal(feed.manifest.stories[second.id].status, 'withdrawn');
  assert.equal(checkBeforeDisplay({ storyId: first.id, storyVersion: first.version }, feed.manifest, NOW).allowed, false);
});

test('a changed version is refused by the display check', () => {
  const feed = combined(), s = feed.stories[0];
  assert.equal(checkBeforeDisplay({ storyId: s.id, storyVersion: s.version + 1 }, feed.manifest, NOW).reason, 'VERSION_CHANGED');
});

test('global and per-source switches apply at request time even with an older stored snapshot', () => {
  const off = combined({ control: { enabled: false } });
  assert.equal(off.stories.length, 0); assert.equal(off.publisherFeed.status, 'disabled');
  const alphaOff = sources({ alpha: { ...sources().alpha, publisherFeed: { ...sources().alpha.publisherFeed, enabled: false } } });
  assert.deepEqual(combined({ sources: alphaOff }).stories.map(s => s.sourceName), ['Beta Science']);
  const betaGone = sources({ beta: { ...sources().beta, enabled: false } });
  assert.deepEqual(combined({ sources: betaGone }).stories.map(s => s.sourceName), ['Alpha News']);
});

test('tampered snapshot rows with unsafe or off-domain links, or a different policy, are not served', () => {
  const s = snap();
  s.items[0] = { ...s.items[0], url: 'javascript:alert(1)' }; s.items[1] = { ...s.items[1], url: 'https://attacker.example/articles/x' };
  assert.equal(combined({ snapshot: s }).stories.length, 0);
  assert.equal(combined({ snapshot: { ...snap(), policy: 'old-policy' } }).stories.length, 0);
  assert.equal(combined({ snapshot: { ...snap(), policy: PUBLISHER_FEED_POLICY } }).stories.length, 2);
});

test('freshness window, retention expiry and stale snapshots are enforced on every request', () => {
  const later = (days) => new Date(Date.parse(NOW) + days * DAY).toISOString();
  assert.equal(combined({ now: later(5.5) }).stories.length, 2, 'inside the 7-day publication window and both retention periods');
  assert.equal(combined({ now: later(5.5) }).publisherFeed.status, 'stale', 'older than staleAfterHours is reported, not hidden');
  const shortRetention = sources({ alpha: { ...sources().alpha, publisherFeed: { ...sources().alpha.publisherFeed, retentionDays: 3 } } });
  assert.deepEqual(combined({ now: later(5.5), sources: shortRetention }).stories.map(s => s.sourceName), ['Beta Science'], 'retention counts from first retrieval');
  assert.equal(combined({ now: later(8) }).stories.length, 0);
  assert.equal(combined({ now: ago(1) }).stories.length, 0, 'rows retrieved in the future are refused');
});

test('reviewed edition wins id/URL collisions and keeps "Reviewed by PositiviTV"', () => {
  const edition = publishEdition([story()], Object.fromEntries(Object.entries(context().sources).map(([id, s]) => [id, { ...s, displayName: 'Synthetic publisher' }])), empty, context().now);
  const reviewed = buildFeed(edition, context().now).stories[0];
  assert.equal(reviewed.provenance, 'reviewed'); assert.equal(provenanceLabel(reviewed), 'Reviewed by PositiviTV™');
  const host = new URL(reviewed.sourceUrl).hostname, srcs = sources({ alpha: { ...sources().alpha, domains: [host] } });
  const clash = buildSnapshot(null, [{ sourceId: 'alpha', ok: true, candidates: [{ ...candidate('alpha', 'dup', 'Volunteers restore wetland'), url: reviewed.sourceUrl, publishedAt: new Date(Date.parse(context().now) - DAY).toISOString() }] }], srcs, control(), context().now);
  const feed = buildCombinedFeed(edition, { snapshot: clash, status: 'ok' }, control(), srcs, context().now);
  assert.equal(feed.stories.length, 1); assert.equal(feed.stories[0].provenance, 'reviewed'); assert.equal(feed.manifest.stories[reviewed.id].status, 'approved');
});

test('contract: automatic rows cannot claim review, event dates, Health, unlabelled pins or 0/0', () => {
  const [s] = combined().stories, row = { ...s, expiresAt: '9999-01-01T00:00:00Z', policyVersion: POLICY_VERSION };
  assert(validPublicStory(row));
  for (const patch of [{ eventDate: '2026-10-10', datePrecision: 'day' }, { category: 'Health' }, { labels: [] }, { archive: true }, { provenance: 'sample' },
    { provenance: 'other' }, { image: 'https://alpha.example.org/x.jpg' }, { lat: 0, lng: 0, locationPrecision: 'unknown' },
    { lat: 1, lng: 2, locationPrecision: 'country', labels: ['event_date_unconfirmed'] }, { labels: ['event_date_unconfirmed', 'made_up'] }, { sourceUrl: 'http://alpha.example.org/a' }])
    assert.equal(validPublicStory({ ...row, ...patch }), false, JSON.stringify(patch));
  assert.equal(validPublicStory({ ...row, provenance: 'reviewed' }), false, 'reviewed rows need a supported event date');
  assert.equal(validPublicStory({ ...row, lat: 0, lng: 0, locationPrecision: 'country', labels: ['event_date_unconfirmed', 'country_from_headline'] }), false, '0/0 is rejected even when labelled');
});

test('no snapshot or a disabled lane serves the reviewed edition alone, honestly empty', () => {
  const none = combined({ snapshot: null });
  assert.equal(none.stories.length, 0); assert.equal(none.publisherFeed.status, 'unavailable'); assert.equal(none.manifest.version, none.revision);
  assert.equal(projectPublisherFeed(null, control(), sources(), NOW).stories.length, 0);
});

test('checked-in configuration records permissions and conservative map settings for every enabled source', () => {
  assert.equal(typeof controlConfig.enabled, 'boolean'); assert.equal(controlConfig.locationResolver, 'supported_feed');
  const ids = feedConfig.feeds.map(f => f.id);
  for (const feed of feedConfig.feeds) {
    const source = feedConfig.sources[feed.id]; assert(source, feed.id);
    assert.deepEqual([...feed.allowedDomains].sort(), [...source.domains].sort(), feed.id);
    assert(feed.url.startsWith('https://') && feed.allowedDomains.includes(new URL(feed.url).hostname), feed.id);
    if (feed.lanes.includes('publisher_feed')) {
      const p = source.publisherFeed; assert(source.enabled && p?.enabled, feed.id);
      for (const key of ['licenseOrTerms', 'policyUrl', 'checkedAt', 'attribution', 'exceptions']) assert(typeof p[key] === 'string' && p[key].length > 3, feed.id + key);
      assert(Array.isArray(p.permittedFields) && p.permittedFields.length && Number.isInteger(p.retentionDays) && p.retentionDays > 0);
      assert.notEqual(p.category, 'Health');
    }
  }
  assert.equal(feedConfig.sources.theconversation.publisherFeed.enabled, false);
  for (const blocked of ['sciencedaily', 'positivenews', 'goodnewsnetwork']) { assert(!ids.includes(blocked)); assert(feedConfig.disabledSources[blocked]); }
  assert.deepEqual(feedConfig.feeds.filter(f => f.lanes.includes('review_queue')).map(f => f.id), ['nasa'], 'the private review queue intake is unchanged');
});

test('provenance and manifest status must match: listed is never an approval and approved is never automatic', () => {
  assert(statusMatchesProvenance({ provenance: 'publisher_feed', archive: false }, 'listed'));
  assert(!statusMatchesProvenance({ provenance: 'publisher_feed', archive: false }, 'approved'));
  assert(!statusMatchesProvenance({ provenance: 'reviewed', archive: false }, 'listed'));
  assert(statusMatchesProvenance({ provenance: 'reviewed', archive: true }, 'archived'));
  assert(!statusMatchesProvenance({ provenance: 'sample', archive: false }, 'approved'));
});

test('one malformed stored row is skipped; the rest of the lane and the edition are still served', () => {
  const s = snap(); s.items.unshift({ ...s.items[0], id: 'broken', labels: null }); s.items.push(null, 42);
  const feed = combined({ snapshot: s });
  assert.equal(feed.stories.length, 2); assert(!feed.manifest.stories.broken);
});

test('an id the reviewed edition ever gave a status (including withdrawn) is never shown by the automatic lane', () => {
  const s = snap(), [first] = s.items;
  const edition = { ...empty, statuses: { [first.id]: { version: 1, status: 'withdrawn' } } };
  const feed = combined({ edition, snapshot: s });
  assert(!feed.stories.some(x => x.id === first.id)); assert.equal(feed.manifest.stories[first.id].status, 'withdrawn');
  for (const story of feed.stories) assert(statusMatchesProvenance(story, feed.manifest.stories[story.id].status));
});

test('the extra Mongabay and Global Voices feeds reuse the already-cleared licenses and stay on the same sites', () => {
  const s = feedConfig.sources, f = Object.fromEntries(feedConfig.feeds.map(x => [x.id, x]));
  assert.deepEqual(s['mongabay-upbeat'].publisherFeed.license, s.mongabay.publisherFeed.license);
  assert.equal(new URL(f['mongabay-upbeat'].url).hostname, 'news.mongabay.com');
  assert.equal(f['mongabay-upbeat'].supplementalUrl, undefined);
  for (const id of ['globalvoices-featured', 'globalvoices-africa']) {
    assert.deepEqual(s[id].publisherFeed.license, s['globalvoices-main'].publisherFeed.license, id);
    assert.equal(new URL(f[id].url).hostname, 'globalvoices.org', id);
    assert.deepEqual(s[id].publisherFeed.blockedCredits, s['globalvoices-main'].publisherFeed.blockedCredits, id);
  }
});

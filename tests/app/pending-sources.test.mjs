import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pending = JSON.parse(readFileSync(new URL('../../config/pending-sources.json', import.meta.url), 'utf8'));
const live = JSON.parse(readFileSync(new URL('../../config/feeds.json', import.meta.url), 'utf8'));

test('pending sources are switched off, never live, and carry a complete terms record for GC review', () => {
  assert(pending.feeds.length > 0);
  for (const feed of pending.feeds) {
    const source = pending.sources[feed.id]; assert(source, feed.id);
    assert.equal(live.sources[feed.id], undefined, feed.id + ' must not be in the live config yet');
    assert(!live.feeds.some(f => f.id === feed.id), feed.id);
    assert.equal(source.enabled, false, feed.id); assert.equal(source.publisherFeed.enabled, false, feed.id);
    assert.deepEqual([...feed.allowedDomains].sort(), [...source.domains].sort(), feed.id);
    assert(feed.url.startsWith('https://') && feed.allowedDomains.includes(new URL(feed.url).hostname), feed.id);
    for (const key of ['licenseOrTerms', 'policyUrl', 'checkedAt', 'attribution', 'exceptions', 'notes']) assert(typeof source.publisherFeed[key] === 'string' && source.publisherFeed[key].length > 3, feed.id + key);
    assert(source.publisherFeed.permittedFields.length && source.publisherFeed.retentionDays > 0);
    assert.notEqual(source.publisherFeed.category, 'Health');
    if (source.publisherFeed.summary === false) assert(!source.publisherFeed.permittedFields.some(f => /description/.test(f)), feed.id);
  }
});

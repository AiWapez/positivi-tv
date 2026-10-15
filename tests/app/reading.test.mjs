import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReadMap, isRecent, feedUpdatedAt, retiredFromGlobe, globeStories, unreadFirst, RECENT_DAYS } from '../../src/lib/reading.ts';

const NOW = Date.parse('2026-10-15T15:00:00Z'), DAY = 86400000;
const iso = t => new Date(t).toISOString();
const story = (id, fetchedDaysAgo = 1) => ({ id, fetchedAt: iso(NOW - fetchedDaysAgo * DAY) });

test('new this week means first collected within 7 days; older stories wait for the Previous button', () => {
  assert.equal(RECENT_DAYS, 7);
  assert.equal(isRecent(story('a', 1), NOW), true);
  assert.equal(isRecent(story('b', 6.9), NOW), true);
  assert.equal(isRecent(story('c', 7.1), NOW), false);
  assert.equal(isRecent({ fetchedAt: 'not a date' }, NOW), false);
});

test('an opened story keeps a dimmed pin until a newer daily update arrives, then leaves the globe', () => {
  const readAt = NOW - 2 * 3600000, read = { a: iso(readAt) };
  assert.equal(retiredFromGlobe({ id: 'a' }, read, readAt - 3600000), false, 'snapshot older than the read: pin stays');
  assert.equal(retiredFromGlobe({ id: 'a' }, read, readAt + 3600000), true, 'next update after the read: pin removed');
  assert.equal(retiredFromGlobe({ id: 'a' }, read, null), false, 'no update time known: never removed');
  assert.equal(retiredFromGlobe({ id: 'b' }, read, readAt + 3600000), false, 'unread stories always stay');
});

test('a week away: every unopened story is still on the globe; read ones are gone after updates', () => {
  const stories = ['a', 'b', 'c', 'd'].map(id => story(id, 3)), read = { b: iso(NOW - 6 * DAY) };
  const pins = globeStories(stories, read, NOW - DAY, null).map(s => s.id);
  assert.deepEqual(pins, ['a', 'c', 'd']);
  assert.deepEqual(globeStories(stories, read, NOW - DAY, 'b').map(s => s.id), ['a', 'b', 'c', 'd'], 'the selected story keeps its pin');
});

test('the list shows unread stories first and keeps each group in order', () => {
  const stories = ['a', 'b', 'c', 'd'].map(id => story(id));
  assert.deepEqual(unreadFirst(stories, { a: iso(NOW), c: iso(NOW) }).map(s => s.id), ['b', 'd', 'a', 'c']);
});

test('update time is the newest of the daily snapshot and the reviewed edition', () => {
  assert.equal(feedUpdatedAt({ updatedAt: null, publisherFeed: { generatedAt: iso(NOW) } }), NOW);
  assert.equal(feedUpdatedAt({ updatedAt: iso(NOW + 5), publisherFeed: { generatedAt: iso(NOW) } }), NOW + 5);
  assert.equal(feedUpdatedAt({ updatedAt: null }), null);
});

test('stored reading history is validated, pruned and capped; bad data never breaks the page', () => {
  for (const bad of [null, '', 'nonsense', '[1,2]', '"x"', '42']) assert.deepEqual(parseReadMap(bad, NOW), {});
  const parsed = parseReadMap(JSON.stringify({ ok: iso(NOW - DAY), old: iso(NOW - 200 * DAY), future: iso(NOW + 30 * DAY), junk: 5, bad: 'x' }), NOW);
  assert.deepEqual(Object.keys(parsed), ['ok']);
  const many = Object.fromEntries(Array.from({ length: 2500 }, (_, i) => ['s' + i, iso(NOW - i * 1000)]));
  const capped = parseReadMap(JSON.stringify(many), NOW);
  assert.equal(Object.keys(capped).length, 2000); assert(capped.s0 && !capped.s2400, 'keeps the most recent');
});

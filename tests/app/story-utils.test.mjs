import test from 'node:test';
import assert from 'node:assert/strict';
import { filterStories, nextStory } from '../../src/lib/story-utils.ts';
import { stories, DEMO_DATE } from '../../src/data/demo.mjs';
const filters = { category: 'All', period: '30', query: '', savedOnly: false };
test('category, search, date and saved filters use the same dataset', () => {
  const saved = new Set(['portugal','brazil']);
  const result = filterStories(stories, { ...filters, category: 'Planet', query: 'Portugal', savedOnly: true }, saved, Date.parse(DEMO_DATE));
  assert.deepEqual(result.map(s => s.id), ['portugal']);
  assert.equal(filterStories(stories, { ...filters, period: '7' }, saved, Date.parse(DEMO_DATE)).length, 4);
  assert.equal(filterStories(stories, { ...filters, period: 'all' }, saved, Date.parse(DEMO_DATE)).length, 8);
});
test('production date filtering uses the supplied clock, not the demo clock', () => {
  assert.equal(filterStories(stories, filters, new Set(), Date.parse('2027-01-01')).length, 0);
});
test('discovery respects the eligible pool and avoids current when possible', () => {
  assert.equal(nextStory([], null), null); assert.equal(nextStory([stories[0]], stories[0].id, true), stories[0]);
  assert.equal(nextStory(stories, stories[0].id), stories[1]);
  assert.notEqual(nextStory(stories, stories[0].id, true, () => 0).id, stories[0].id);
});

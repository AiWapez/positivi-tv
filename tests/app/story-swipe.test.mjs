import test from 'node:test';
import assert from 'node:assert/strict';
import { swipeIntent, swipeStories, neighborStory, swipePosition, SWIPE_MIN_DISTANCE_PX } from '../../src/lib/story-swipe.ts';

const pin = id => ({ id, lat: 10, lng: 20 });
const noPin = id => ({ id, lat: null, lng: null });

test('swiping left goes to the next story and swiping right goes back', () => {
  assert.equal(swipeIntent(-90, 4, 300), 'next');
  assert.equal(swipeIntent(90, -4, 300), 'previous');
});

test('a short, slow drag is not a swipe', () => {
  assert.equal(swipeIntent(-20, 0, 600), null);
  assert.equal(swipeIntent(SWIPE_MIN_DISTANCE_PX - 1, 0, 600), null);
  assert.equal(swipeIntent(SWIPE_MIN_DISTANCE_PX, 0, 600), 'previous');
});

test('a quick flick can be shorter than a slow swipe', () => {
  assert.equal(swipeIntent(-32, 2, 150), 'next');
  assert.equal(swipeIntent(-32, 2, 400), null);
  assert.equal(swipeIntent(-20, 0, 100), null);
});

test('moving mostly up or down never changes the story, so the page can scroll', () => {
  assert.equal(swipeIntent(-60, 100, 300), null);
  assert.equal(swipeIntent(60, -120, 300), null);
  // The sideways move must be at least 1.6 times the up-or-down move: 70 x 1.6 = 112 is more than 100, 60 x 1.6 = 96 is not.
  assert.equal(swipeIntent(-100, 70, 300), null);
  assert.equal(swipeIntent(-100, 60, 300), 'next');
});

test('a tap, or unusable numbers, is not a swipe', () => {
  assert.equal(swipeIntent(0, 0, 80), null);
  assert.equal(swipeIntent(NaN, 0, 100), null);
  assert.equal(swipeIntent(-80, Infinity, 100), null);
  assert.equal(swipeIntent(-80, 0, NaN), null);
});

test('swipe only moves through stories that have a pin, in list order', () => {
  const listed = [pin('a'), noPin('n1'), pin('b'), noPin('n2'), pin('c')];
  assert.deepEqual(swipeStories(listed, 'a').map(s => s.id), ['a', 'b', 'c']);
});

test('the open story stays in the order even without a pin, so swiping can move on from it', () => {
  const listed = [pin('a'), noPin('n1'), pin('b')];
  assert.deepEqual(swipeStories(listed, 'n1').map(s => s.id), ['a', 'n1', 'b']);
  assert.equal(neighborStory(swipeStories(listed, 'n1'), 'n1', 1).id, 'b');
  assert.equal(neighborStory(swipeStories(listed, 'n1'), 'n1', -1).id, 'a');
});

test('stories at 0,0 are still real pins and keep their place', () => {
  assert.deepEqual(swipeStories([{ id: 'z', lat: 0, lng: 0 }, noPin('n')], null).map(s => s.id), ['z']);
});

test('the next and previous story wrap around at the ends', () => {
  const items = [pin('a'), pin('b'), pin('c')];
  assert.equal(neighborStory(items, 'a', 1).id, 'b');
  assert.equal(neighborStory(items, 'c', 1).id, 'a');
  assert.equal(neighborStory(items, 'a', -1).id, 'c');
  assert.equal(neighborStory(items, 'b', -1).id, 'a');
});

test('there is nowhere to go with one story or none, and an unknown story starts at an end', () => {
  assert.equal(neighborStory([], 'a', 1), null);
  assert.equal(neighborStory([pin('a')], 'a', 1), null);
  assert.equal(neighborStory([pin('a'), pin('b')], 'missing', 1).id, 'a');
  assert.equal(neighborStory([pin('a'), pin('b')], 'missing', -1).id, 'b');
  assert.equal(neighborStory([pin('a'), pin('b')], null, 1).id, 'a');
});

test('the position under the card counts from zero and is hidden when there is nothing to swipe to', () => {
  const items = [pin('a'), pin('b'), pin('c')];
  assert.deepEqual(swipePosition(items, 'b'), { index: 1, total: 3 });
  assert.equal(swipePosition([pin('a')], 'a'), null);
  assert.equal(swipePosition(items, 'missing'), null);
  assert.equal(swipePosition(items, null), null);
});

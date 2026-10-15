import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKY_STAR_RADIUS, isSpaceStory, storyPlace, spaceTopic, skyPosition, hiddenByEarth } from '../../src/lib/space-stories.ts';

const story = (title, extra = {}) => ({ id: 'nasa-1', title, lat: null, lng: null, sourceName: 'NASA', isDemo: false, location: 'Location not specified', ...extra });

test('a NASA story with no place whose headline names something in space is a space story', () => {
  for (const title of [
    'NASA Perseverance rover finds new rock on Mars', "Webb telescope spots the most distant galaxy yet", 'Artemis crew prepares for lunar landing',
    'A comet will pass close to the Sun this month', 'Hubble captures a nebula in new detail', 'New exoplanets found around a nearby star', 'Black hole spins faster than expected',
    'Jupiter storm seen in fresh detail', 'Asteroid sample reveals ingredients for life', 'Moon dust could help grow plants',
  ]) assert.equal(isSpaceStory(story(title)), true, title);
});

test('NASA stories about Earth are not space stories, even when they mention satellites, orbit or astronauts', () => {
  for (const title of [
    'Satellites show forests regrowing across the Amazon', 'Orbiting sensors track clean air improvements', 'Astronauts photograph the recovering ozone hole from the space station',
    'New ocean data shows coral recovery', 'Rocket launch carries a climate satellite', 'NASA invests in community science',
  ]) assert.equal(isSpaceStory(story(title)), false, title);
});

test('a story needs to come from NASA, to have no place, and not to be a design sample', () => {
  assert.equal(isSpaceStory(story('Perseverance rover on Mars', { sourceName: 'Mongabay', id: 'mongabay-1' })), false, 'another publisher');
  assert.equal(isSpaceStory(story('Perseverance rover on Mars', { lat: 10, lng: 20 })), false, 'already has a place');
  assert.equal(isSpaceStory(story('Perseverance rover on Mars', { lat: 10, lng: null })), false);
  assert.equal(isSpaceStory(story('Perseverance rover on Mars', { isDemo: true })), false, 'demo samples never count');
  assert.equal(isSpaceStory(story('Perseverance rover on Mars', { sourceName: null, id: 'nasa-77' })), true, 'the id prefix also identifies NASA');
});

test('whole words only, so a place or a name does not trigger a star', () => {
  assert.equal(isSpaceStory(story('Mooney Valley reopens its library')), false);
  assert.equal(isSpaceStory(story('Marsh restored along the river')), false);
  assert.equal(isSpaceStory(story('Venus Williams opens a school')), true, 'a known limit: a person named Venus on a NASA story');
});

test('a space story shows its topic where a place would go, and any other story keeps its own place', () => {
  assert.equal(storyPlace(story('Rover on Mars')), 'Space exploration');
  assert.equal(storyPlace(story('Webb telescope finds a distant galaxy')), 'Deep space');
  assert.equal(storyPlace(story('A solar storm lights the sky')), 'Sun and space weather');
  assert.notEqual(storyPlace(story('Rover on Mars')), 'No place on Earth');
  assert.equal(storyPlace(story('Rover on Mars', { lat: 1, lng: 2, location: 'Cape Canaveral' })), 'Cape Canaveral');
  assert.equal(storyPlace(story('New ocean data', { location: 'Location not specified' })), 'Location not specified');
});

test('a star position depends only on the id, stays well away from the poles, and differs between stories', () => {
  assert.deepEqual(skyPosition('nasa-abc'), skyPosition('nasa-abc'));
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const { lat, lng } = skyPosition(`nasa-story-${i}`);
    assert.ok(lat >= -50 && lat <= 50 && lng >= -180 && lng <= 180);
    seen.add(`${lat.toFixed(2)},${lng.toFixed(2)}`);
  }
  assert.equal(seen.size, 200);
  assert.ok(SKY_STAR_RADIUS > 1.2 && SKY_STAR_RADIUS < 2.5);
});

test('the Earth hides a star behind it and not one beside or in front of it', () => {
  const camera = [0, 0, 3.45];
  assert.equal(hiddenByEarth(camera, [0, 0, -1.6]), true, 'directly behind');
  assert.equal(hiddenByEarth(camera, [0, 0, 1.6]), false, 'in front');
  assert.equal(hiddenByEarth(camera, [1.6, 0, 0]), false, 'out beside the globe');
  assert.equal(hiddenByEarth(camera, [0.5, 0, -1.6]), true, 'behind the disc, off centre');
  assert.equal(hiddenByEarth(camera, [2.2, 0, -1.6]), false, 'behind but clear of the disc edge');
  assert.equal(hiddenByEarth(camera, camera), false);
});

test('the globe draws space stories as stars, with no star button in the controls', () => {
  const globe = readFileSync(new URL('../../src/lib/globe.js', import.meta.url), 'utf8'), app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
  assert.match(globe, /isSpaceStory/); assert.match(globe, /hiddenByEarth/); assert.match(globe, /pin-star/);
  assert.doesNotMatch(app, /sky-button|spaceButtonLabel/); assert.match(app, /storyPlace/);
});

test('the camera for a space star puts it in the dark beside the globe, on the left, inside a phone screen, for any story', async () => {
  const { skyView, starAppearance, skyPosition: pos, SKY_VIEW_DISTANCE, SKY_APPARENT_DEGREES } = await import('../../src/lib/space-stories.ts');
  const disc = Math.asin(1 / SKY_VIEW_DISTANCE) * 180 / Math.PI;
  assert.ok(SKY_APPARENT_DEGREES > disc + 2, 'clear of the globe disc');
  assert.ok(SKY_APPARENT_DEGREES < 19.5, 'inside a phone screen');
  for (let i = 0; i < 300; i++) {
    const id = `nasa-story-${i}`, view = skyView(id), shown = starAppearance(pos(id), view);
    assert.equal(view.distance, SKY_VIEW_DISTANCE);
    assert.ok(view.lng >= -180 && view.lng <= 180 && view.lat >= -50 && view.lat <= 50, id);
    assert.ok(Math.abs(shown.degrees - SKY_APPARENT_DEGREES) < 0.3, `${id}: ${shown.degrees}`);
    assert.equal(shown.left, true, `${id} should be on the left`);
  }
});

test('the topic comes from the headline alone, and the first matching group wins', () => {
  assert.equal(spaceTopic('Hubble sees a comet'), 'Deep space');
  assert.equal(spaceTopic('Sunspots and a black hole'), 'Sun and space weather');
  assert.equal(spaceTopic('Artemis crew trains for the Moon'), 'Space exploration');
});

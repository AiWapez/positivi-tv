import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import {
  MIN_ZOOM_DISTANCE, MAX_ZOOM_DISTANCE, SHARP_EARTH_DISTANCE, SHARP_EARTH_WIDTH, BASE_EARTH_URL, SHARP_EARTH_URL, shouldLoadSharpEarth,
} from '../../src/lib/globe-detail.ts';
import { START_DISTANCE } from '../../src/lib/globe-touch.ts';

const input = (over = {}) => ({ distance: 2.0, saveData: false, maxTextureSize: 8192, requested: false, ...over });

test('the sharp Earth is fetched once the reader zooms in close', () => {
  assert.equal(shouldLoadSharpEarth(input({ distance: 2.0 })), true);
  assert.equal(shouldLoadSharpEarth(input({ distance: SHARP_EARTH_DISTANCE })), true);
  assert.equal(shouldLoadSharpEarth(input({ distance: MIN_ZOOM_DISTANCE })), true);
});

test('nobody downloads the sharp Earth just by opening the page, flying to a story or resetting the view', () => {
  assert.equal(shouldLoadSharpEarth(input({ distance: START_DISTANCE.default })), false);
  assert.equal(shouldLoadSharpEarth(input({ distance: START_DISTANCE.phone })), false);
  assert.equal(shouldLoadSharpEarth(input({ distance: 3.05 })), false, 'flying to a story ends at 3.05');
  assert.equal(shouldLoadSharpEarth(input({ distance: SHARP_EARTH_DISTANCE + 0.01 })), false);
});

test('it is only ever fetched once, even after a failure', () => {
  assert.equal(shouldLoadSharpEarth(input({ requested: true })), false);
});

test('a reader who asked their phone to save data keeps the lighter picture', () => {
  assert.equal(shouldLoadSharpEarth(input({ saveData: true })), false);
});

test('a graphics card that cannot hold a 4096 pixel picture keeps the lighter one', () => {
  assert.equal(shouldLoadSharpEarth(input({ maxTextureSize: 2048 })), false);
  assert.equal(shouldLoadSharpEarth(input({ maxTextureSize: SHARP_EARTH_WIDTH })), true);
  assert.equal(shouldLoadSharpEarth(input({ maxTextureSize: NaN })), false);
});

test('unusable distances never trigger a download', () => {
  assert.equal(shouldLoadSharpEarth(input({ distance: NaN })), false);
  assert.equal(shouldLoadSharpEarth(input({ distance: Infinity })), false);
});

test('the zoom range stays inside the planet and keeps room to see it whole', () => {
  assert.ok(MIN_ZOOM_DISTANCE > 1.2, 'the camera stays well above the surface (radius 1)');
  assert.ok(MIN_ZOOM_DISTANCE < 1.65, 'closer than the old limit of 1.65');
  assert.equal(MAX_ZOOM_DISTANCE, 5);
  assert.ok(SHARP_EARTH_DISTANCE < START_DISTANCE.phone && SHARP_EARTH_DISTANCE < 3.05);
});

// Read a JPEG's pixel size from its header, so the shipped pictures are checked without an image library.
function jpegSize(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8, `${path} is a JPEG`);
  let at = 2;
  while (at < bytes.length) {
    assert.equal(bytes[at], 0xff, 'marker');
    const marker = bytes[at + 1], length = bytes.readUInt16BE(at + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    at += 2 + length;
  }
  throw new Error(`no size found in ${path}`);
}
const file = url => new URL(`../../public${url}`, import.meta.url);

test('the two shipped Earth pictures are the sizes the app expects and show the same Earth', () => {
  assert.deepEqual(jpegSize(file(BASE_EARTH_URL)), { width: 2048, height: 1024 });
  assert.deepEqual(jpegSize(file(SHARP_EARTH_URL)), { width: SHARP_EARTH_WIDTH, height: 2048 });
});

test('the first-load Earth stays light so the page opens quickly', () => {
  assert.ok(statSync(file(BASE_EARTH_URL)).size < 600 * 1024, 'earth.jpg should stay under 600 KB');
  assert.ok(statSync(file(SHARP_EARTH_URL)).size < 2 * 1024 * 1024, 'earth-sharp.jpg should stay under 2 MB');
});

test('the asset notes record where both Earth pictures come from', () => {
  const notes = readFileSync(new URL('../../public/ASSETS.md', import.meta.url), 'utf8');
  assert.match(notes, /earth\.jpg/); assert.match(notes, /earth-sharp\.jpg/);
  assert.match(notes, /Blue Marble: Next Generation/);
  assert.match(notes, /not verified|could not be compared/i, 'the notes must say the original was not compared byte for byte');
});

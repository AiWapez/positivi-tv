import test from 'node:test';
import assert from 'node:assert/strict';
import { discRadiusPx, touchWindowDiameter, scrollGutterPx, START_DISTANCE, TOUCH_EDGE_PADDING_PX } from '../../src/lib/globe-touch.ts';

test('the globe outline radius matches the camera geometry at the original phone size', () => {
  // 40 degree view, camera 3.45 from the centre, 370px tall stage: about 154px, so the globe is about 308px wide.
  assert(Math.abs(discRadiusPx(3.45, 370) - 153.94) < 0.5);
});

test('zooming in makes the outline bigger and zooming out makes it smaller, across the whole zoom range', () => {
  let previous = Infinity;
  for (const distance of [1.65, 2, 2.5, 3, 3.45, 3.7, 4.2, 5]) {
    const radius = discRadiusPx(distance, 370);
    assert(radius > 0 && radius < previous, `distance ${distance}`);
    previous = radius;
  }
});

test('at the closest zoom the outline is bigger than a phone stage, so the whole stage responds', () => {
  const diameter = touchWindowDiameter(1.65, 370);
  assert(diameter / 2 > Math.hypot(390, 370) / 2);
});

test('unusable input gives 0 instead of a broken size', () => {
  for (const [distance, height] of [[1, 370], [0.5, 370], [3.45, 0], [3.45, -10], [NaN, 370], [3.45, NaN], [Infinity, 370]]) {
    assert.equal(touchWindowDiameter(distance, height), 0, `distance ${distance}, height ${height}`);
  }
  assert.equal(discRadiusPx(3.45, 370, 0), 0);
  assert.equal(discRadiusPx(3.45, 370, 180), 0);
  assert.equal(discRadiusPx(3.45, 370, 40, 0), 0);
  assert.equal(scrollGutterPx(0, 3.7, 370), 0);
});

test('the touch window is the outline plus a small edge allowance', () => {
  assert.equal(touchWindowDiameter(3.45, 370), Math.round(2 * (discRadiusPx(3.45, 370) + TOUCH_EDGE_PADDING_PX)));
});

test('phones start the globe about 7 percent smaller than before', () => {
  const ratio = discRadiusPx(START_DISTANCE.phone, 370) / discRadiusPx(START_DISTANCE.default, 370);
  assert(ratio > 0.92 && ratio < 0.94, `ratio ${ratio}`);
});

test('phones keep a usable swipe strip beside the globe at common sizes and never a negative one', () => {
  // [stage width, stage height]: small phone, common phone, large phone.
  for (const [width, height] of [[360, 335], [390, 370], [430, 370]]) {
    assert(scrollGutterPx(width, START_DISTANCE.phone, height) >= 44, `${width}x${height}`);
  }
  // The old start distance left less room than the new one.
  assert(scrollGutterPx(390, START_DISTANCE.default, 370) < scrollGutterPx(390, START_DISTANCE.phone, 370));
});

test('the swipe strips never shrink below 44px, even when a selected story or a pinch brings the globe close', () => {
  // 3.05 is how close the globe flies to a selected story; 1.65 is the closest pinch zoom.
  for (const distance of [3.05, 2.5, 1.65]) {
    for (const [width, height] of [[360, 335], [390, 370], [430, 370]]) {
      assert(scrollGutterPx(width, distance, height) >= 44 - 0.5, `distance ${distance} at ${width}x${height}`);
    }
  }
  assert.equal(touchWindowDiameter(3.05, 370, 390), 302);
  assert.equal(scrollGutterPx(390, 3.05, 370), 44);
  assert.equal(scrollGutterPx(390, 1.65, 370), 44);
});

test('the cap does not touch the globe when there is already room, and wide screens are not capped at normal zoom', () => {
  assert.equal(touchWindowDiameter(START_DISTANCE.phone, 370, 390), touchWindowDiameter(START_DISTANCE.phone, 370));
  assert.equal(touchWindowDiameter(3.45, 600, 1000), touchWindowDiameter(3.45, 600));
});

test('a very narrow stage still leaves a window big enough to grab', () => {
  assert.equal(touchWindowDiameter(1.65, 370, 150), 120);
  assert.equal(touchWindowDiameter(1.65, 370, 0), touchWindowDiameter(1.65, 370));
});

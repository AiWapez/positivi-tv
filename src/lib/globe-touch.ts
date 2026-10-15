/**
 * Size of the globe as it appears on screen, so touch handling can match what the reader sees.
 * The camera always looks at the centre of the globe, so its outline is a circle in the middle of the stage.
 */
export const GLOBE_FOV_DEGREES = 40;
export const GLOBE_RADIUS = 1;
/** How far from the globe the camera starts. Phones start a little farther out so there is room to swipe past the globe. */
export const START_DISTANCE = { default: 3.45, phone: 3.7 } as const;
/** Extra pixels around the outline, so a thumb that lands right on the edge or the glow still spins the globe. */
export const TOUCH_EDGE_PADDING_PX = 6;
/** Every screen keeps at least this much width on each side where a swipe scrolls the page, however far the globe is zoomed. */
export const MIN_SCROLL_STRIP_PX = 44;
/** The touch window never shrinks below this, so the globe stays easy to grab on a very narrow stage. */
export const MIN_TOUCH_WINDOW_PX = 120;

/** Radius in pixels of the circle the globe covers on screen. Returns 0 when the inputs cannot describe a visible globe. */
export function discRadiusPx(distance: number, stageHeight: number, fovDegrees = GLOBE_FOV_DEGREES, radius = GLOBE_RADIUS): number {
  if (!(distance > radius) || !(stageHeight > 0) || !(fovDegrees > 0 && fovDegrees < 180) || !(radius > 0)) return 0;
  const focalLength = (stageHeight / 2) / Math.tan(fovDegrees * Math.PI / 360);
  return focalLength * radius / Math.sqrt(distance * distance - radius * radius);
}

/**
 * Diameter in pixels of the round area that should respond to touch. It follows the globe on screen, but when a story is
 * selected or the reader zooms in, it stops growing so that a strip of MIN_SCROLL_STRIP_PX stays free on each side of the stage.
 * Returns 0 when it cannot be worked out.
 */
export function touchWindowDiameter(distance: number, stageHeight: number, stageWidth = Infinity): number {
  const radius = discRadiusPx(distance, stageHeight);
  if (!(radius > 0)) return 0;
  const natural = Math.round(2 * (radius + TOUCH_EDGE_PADDING_PX));
  const cap = stageWidth > 0 && Number.isFinite(stageWidth) ? Math.max(MIN_TOUCH_WINDOW_PX, stageWidth - 2 * MIN_SCROLL_STRIP_PX) : Infinity;
  return Math.min(natural, cap);
}

/** Width in pixels of the strip on each side of the touch window where a swipe scrolls the page. Never negative. */
export function scrollGutterPx(stageWidth: number, distance: number, stageHeight: number): number {
  const diameter = touchWindowDiameter(distance, stageHeight, stageWidth);
  return diameter > 0 && stageWidth > 0 ? Math.max(0, (stageWidth - diameter) / 2) : 0;
}

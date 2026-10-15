/**
 * How close the globe can zoom, and when to fetch the sharper Earth picture.
 * Pure helpers, so the rules can be tested without a browser.
 *
 * Two pictures of the same NASA Blue Marble ship with the app: a lighter one that every visitor loads first
 * (earth.jpg, 2048 pixels wide) and a sharp one (earth-sharp.jpg, 4096 pixels wide, about 1.4 MB) that is only
 * fetched once somebody zooms in, so people who never zoom never download it.
 */

/** Closest the camera may come to the middle of the globe. The surface is 1 away, so 1.45 is 0.45 Earth radii above it. */
export const MIN_ZOOM_DISTANCE = 1.45;
/** Farthest the camera may go. Unchanged. */
export const MAX_ZOOM_DISTANCE = 5;
/** The start view sits at 3.45 (3.7 on phones) and flying to a story at 3.05, so a deliberate zoom is needed to cross this. */
export const SHARP_EARTH_DISTANCE = 2.7;
/** The sharp picture is this many pixels wide; a graphics card must be able to hold a texture that large. */
export const SHARP_EARTH_WIDTH = 4096;

/** Country borders are fetched the first time the camera comes this close (the flight to a story ends at 3.05, so it does not trigger them). */
export const BORDERS_LOAD_DISTANCE = 2.95;
/** Borders start to appear at this distance and are fully shown at BORDERS_FULL_DISTANCE. */
export const BORDERS_FADE_START = 2.9;
export const BORDERS_FULL_DISTANCE = 2.3;
/** Borders are a hint, not a grid: never fully opaque. */
export const BORDERS_MAX_OPACITY = 0.6;

export const BASE_EARTH_URL = '/assets/earth.jpg';
export const SHARP_EARTH_URL = '/assets/earth-sharp.jpg';

export interface SharpEarthInput {
  /** Camera distance from the middle of the globe. */
  distance: number;
  /** The reader asked their phone to save data (navigator.connection.saveData). */
  saveData?: boolean;
  /** The largest texture the graphics card accepts (renderer.capabilities.maxTextureSize). */
  maxTextureSize: number;
  /** A fetch was already started or finished, or failed once. It is never started twice. */
  requested: boolean;
}

/** True once the reader has zoomed in close enough to want the sharp picture, and nothing rules it out. */
export function shouldLoadSharpEarth({ distance, saveData = false, maxTextureSize, requested }: SharpEarthInput): boolean {
  if (requested || saveData) return false;
  if (!Number.isFinite(distance) || !Number.isFinite(maxTextureSize)) return false;
  if (maxTextureSize < SHARP_EARTH_WIDTH) return false;
  return distance <= SHARP_EARTH_DISTANCE;
}

/** True once the reader has zoomed in far enough to want country borders and they have not been requested yet. */
export function shouldLoadBorders({ distance, requested }: { distance: number; requested: boolean }): boolean {
  return !requested && Number.isFinite(distance) && distance <= BORDERS_LOAD_DISTANCE;
}

/** How visible the borders are at a camera distance: none from far away, fading in as the reader zooms, steady when close. */
export function bordersOpacity(distance: number): number {
  if (!Number.isFinite(distance) || distance >= BORDERS_FADE_START) return 0;
  if (distance <= BORDERS_FULL_DISTANCE) return BORDERS_MAX_OPACITY;
  return BORDERS_MAX_OPACITY * (BORDERS_FADE_START - distance) / (BORDERS_FADE_START - BORDERS_FULL_DISTANCE);
}

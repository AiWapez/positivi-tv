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

/**
 * Country and city names for the globe. Pure helpers, so the rules can be tested without a browser.
 *
 * The data file (public/assets/places.json) is built by scripts/build-places.mjs from Natural Earth (public domain). Coordinates are
 * integers in hundredths of a degree and the entries are already in priority order (tier 1 first, bigger places first inside a tier).
 * A name only appears once the reader has zoomed close enough for its tier, and only when it fits without covering another name or a
 * story pin. That keeps the globe calm: a few big country names first, then more as the reader keeps zooming.
 */

export type PlaceKind = 'country' | 'city';
export type PlaceTier = 1 | 2 | 3 | 4;
export interface Place { kind: PlaceKind; name: string; lat: number; lng: number; tier: PlaceTier }
export interface PlacesFile { precision: number; countries: unknown[]; cities: unknown[] }
/** A rectangle in screen pixels. */
export interface Box { left: number; top: number; right: number; bottom: number }

export const PLACES_URL = '/assets/places.json';
/** The names are fetched the first time the camera comes this close (the flight to a story ends at 3.05, so it does not trigger them). */
export const PLACES_LOAD_DISTANCE = 2.95;
/** Camera distance at or below which a name of each tier may appear. */
export const COUNTRY_NAME_DISTANCE: Record<PlaceTier, number> = { 1: 2.85, 2: 2.5, 3: 2.15, 4: 1.85 };
export const CITY_NAME_DISTANCE: Record<PlaceTier, number> = { 1: 2.45, 2: 2.05, 3: 1.8, 4: 1.62 };
/** A name fades in over this much camera distance after its tier is reached, so it never pops in at full strength. */
export const NAME_FADE_RANGE = 0.12;
/** A name on the far edge of the globe is squeezed and hard to read, so it fades out between these two values (1 is facing the camera, 0 is the edge). */
export const FACING_HIDDEN = 0.14;
export const FACING_FULL = 0.38;

/** Sizes the page styles use (src/styles/index.css, `.place-country` and `.place-city`). Keep the two in step. */
export const COUNTRY_FONT_PX = 10.5;
export const COUNTRY_LETTER_SPACING_EM = 0.09;
export const CITY_FONT_PX = 11;
/** Height of one name, and the room kept between two names. */
export const LABEL_HEIGHT_PX = 14;
export const LABEL_GAP_PX = 4;
/** Distance from a city's dot to the start of its name, and the width the dot takes on the left. */
export const CITY_TEXT_OFFSET_PX = 7;
export const CITY_DOT_RADIUS_PX = 3;
/** Names stay this far inside the edge of the globe area so none is cut off. */
export const EDGE_MARGIN_PX = 6;

const MAX_NAME_LENGTH = 40;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isTier = (value: unknown): value is PlaceTier => value === 1 || value === 2 || value === 3 || value === 4;

function decodeList(kind: PlaceKind, rows: unknown, precision: number): Place[] {
  const places: Place[] = [];
  if (!Array.isArray(rows)) return places;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const [name, lat, lng, tier] = row as unknown[];
    if (typeof name !== 'string' || !finite(lat) || !finite(lng) || !isTier(tier)) continue;
    const clean = name.replace(/\s+/g, ' ').trim();
    if (!clean || clean.length > MAX_NAME_LENGTH || /[\u0000-\u001f<>]/.test(clean)) continue;
    const a = lat / precision, o = lng / precision;
    if (a < -90 || a > 90 || o < -180 || o > 180) continue;
    places.push({ kind, name: clean, lat: a, lng: o, tier });
  }
  return places;
}

/** Turns the data file into places, countries first and then cities, each list in priority order. Anything unusable is skipped, so a damaged file shows fewer names instead of breaking the globe. */
export function decodePlaces(file: unknown): Place[] {
  const data = file as Partial<PlacesFile> | null;
  if (!data || !finite(data.precision) || data.precision <= 0) return [];
  return [...decodeList('country', data.countries, data.precision), ...decodeList('city', data.cities, data.precision)];
}

/** True once the reader has zoomed in far enough to want names and they have not been requested yet. */
export function shouldLoadPlaces({ distance, requested }: { distance: number; requested: boolean }): boolean {
  return !requested && Number.isFinite(distance) && distance <= PLACES_LOAD_DISTANCE;
}

/** The camera distance at or below which this kind and tier of name may appear. */
export function nameDistance(kind: PlaceKind, tier: PlaceTier): number {
  return (kind === 'country' ? COUNTRY_NAME_DISTANCE : CITY_NAME_DISTANCE)[tier];
}

/** How strongly a name shows for the camera distance: nothing until its tier is reached, then fading in over NAME_FADE_RANGE. */
export function nameOpacity(kind: PlaceKind, tier: PlaceTier, distance: number): number {
  if (!Number.isFinite(distance)) return 0;
  const limit = nameDistance(kind, tier);
  if (distance >= limit) return 0;
  return Math.min(1, (limit - distance) / NAME_FADE_RANGE);
}

/** How strongly a name shows for how directly it faces the camera: 0 at the edge of the globe, 1 when clearly on the near side. */
export function facingOpacity(facing: number): number {
  if (!Number.isFinite(facing) || facing <= FACING_HIDDEN) return 0;
  if (facing >= FACING_FULL) return 1;
  return (facing - FACING_HIDDEN) / (FACING_FULL - FACING_HIDDEN);
}

/** How wide a name is on screen, given the width the browser measured for its letters (country names are spaced out a little). */
export function labelWidth(kind: PlaceKind, measuredPx: number, characters: number): number {
  return kind === 'country' ? measuredPx + characters * COUNTRY_LETTER_SPACING_EM * COUNTRY_FONT_PX : measuredPx;
}

/** The rectangle a name takes at a screen position. Country names are centred on the spot; city names start just right of the dot. */
export function labelBox(kind: PlaceKind, x: number, y: number, widthPx: number): Box {
  if (kind === 'country') return { left: x - widthPx / 2, right: x + widthPx / 2, top: y - LABEL_HEIGHT_PX / 2, bottom: y + LABEL_HEIGHT_PX / 2 };
  return { left: x - CITY_DOT_RADIUS_PX, right: x + CITY_TEXT_OFFSET_PX + widthPx, top: y - LABEL_HEIGHT_PX / 2, bottom: y + LABEL_HEIGHT_PX / 2 };
}

/** True when the two rectangles overlap, counting `gap` pixels of breathing room around the first. */
export function boxesOverlap(a: Box, b: Box, gap = 0): boolean {
  return a.left - gap < b.right && a.right + gap > b.left && a.top - gap < b.bottom && a.bottom + gap > b.top;
}

/** True when the rectangle sits completely inside the bounds, with `margin` pixels to spare. */
export function boxInside(box: Box, bounds: Box, margin = 0): boolean {
  return box.left >= bounds.left + margin && box.right <= bounds.right - margin && box.top >= bounds.top + margin && box.bottom <= bounds.bottom - margin;
}

/**
 * Picks which names to show. Candidates must already be in priority order. A name is kept only when it lies inside the bounds and does
 * not overlap an obstacle (a story pin) or a name already kept, so more important names always win a crowded spot.
 */
export function chooseLabels<T extends { box: Box }>(candidates: T[], obstacles: Box[], bounds: Box, gap = LABEL_GAP_PX, margin = EDGE_MARGIN_PX): T[] {
  const kept: T[] = [];
  for (const candidate of candidates) {
    if (!boxInside(candidate.box, bounds, margin)) continue;
    if (obstacles.some(obstacle => boxesOverlap(candidate.box, obstacle, gap))) continue;
    if (kept.some(other => boxesOverlap(candidate.box, other.box, gap))) continue;
    kept.push(candidate);
  }
  return kept;
}

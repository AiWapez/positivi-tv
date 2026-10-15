import boxesFile from './country-boxes.json' with { type: 'json' };
import { countryBySlug } from './publisher-location.ts';

/**
 * Turns a publisher's own place facts into an approximate pin, or into nothing.
 *
 * Inputs (see server/publisher-place-tags.mjs): the location tags the publisher put on a post (slugs such as "south-africa") and,
 * sometimes, map coordinates the publisher chose for the story. Nothing here fetches anything, and a source only reaches this code when its
 * `placeFromPublisherTags` switch is on. No source has that switch on today.
 *
 * Order of trust, most precise first:
 *   1. The publisher's coordinates, but only if they fall inside (the padded outline of) a country the same post is tagged with. They are
 *      rounded to one decimal place (about 11 km) so a card never shows a sharper spot than "approximate", which also protects sensitive
 *      wildlife sites. Label: area_from_publisher.
 *   2. Exactly one tagged country: that country's centre. Label: country_from_publisher_tag.
 *   3. Nothing. Tags that are only a region, an ocean or "Global", several different countries without usable coordinates, and
 *      coordinates that sit outside every tagged country all give no pin.
 */
export interface PlaceTags { slugs: string[]; coordinates: { lat: number; lng: number } | null }
export interface PublisherPlace {
  name: string; lat: number; lng: number;
  precision: 'region' | 'country';
  label: 'area_from_publisher' | 'country_from_publisher_tag';
}
export type CountryBoxes = Record<string, number[][]>;
const BOXES = boxesFile.countries as CountryBoxes;
/** Coordinates are rounded to this many decimal places. */
export const COORDINATE_DECIMALS = 1;
const round = (v: number) => Number(v.toFixed(COORDINATE_DECIMALS));

/** The distinct countries a post is tagged with. Region, ocean and "Global" tags are not countries and are ignored. */
export function taggedCountries(tags: PlaceTags | undefined | null) {
  const seen = new Map<string, { name: string; lat: number; lng: number }>();
  for (const slug of tags?.slugs ?? []) { const c = countryBySlug(slug); if (c && !seen.has(c.name)) seen.set(c.name, c); }
  return [...seen.values()];
}
export function insideCountry(name: string, lat: number, lng: number, boxes: CountryBoxes = BOXES): boolean {
  return (boxes[name] ?? []).some(([s, w, n, e]) => lat >= s && lat <= n && lng >= w && lng <= e);
}
export function resolvePublisherPlace(tags: PlaceTags | undefined | null, boxes: CountryBoxes = BOXES): PublisherPlace | null {
  const countries = taggedCountries(tags);
  if (!countries.length) return null;
  const point = tags?.coordinates;
  if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180
    && !(point.lat === 0 && point.lng === 0)) {
    const home = countries.find(c => insideCountry(c.name, point.lat, point.lng, boxes));
    if (home) return { name: home.name, lat: round(point.lat), lng: round(point.lng), precision: 'region', label: 'area_from_publisher' };
  }
  if (countries.length === 1) return { name: countries[0].name, lat: countries[0].lat, lng: countries[0].lng, precision: 'country', label: 'country_from_publisher_tag' };
  return null;
}

interface HeadlinePlace { name: string; precision: 'region' | 'country' }
/**
 * Combines what the headline rules found with what the publisher tagged.
 * - A curated map area from the headline (a region with a recorded reference) always wins.
 * - A headline country with a publisher point inside that same country: the publisher's point, because it is closer.
 * - A headline country and a publisher tag for a different country: they disagree, so no pin at all.
 * - Otherwise whichever one exists.
 */
export function combinePlaces<H extends HeadlinePlace>(headline: H | null, tag: PublisherPlace | null): { place: H | PublisherPlace | null; conflict: boolean } {
  if (!tag) return { place: headline, conflict: false };
  if (!headline) return { place: tag, conflict: false };
  if (headline.precision === 'region') return { place: headline, conflict: false };
  if (headline.name !== tag.name) return { place: null, conflict: true };
  return { place: tag.precision === 'region' ? tag : headline, conflict: false };
}

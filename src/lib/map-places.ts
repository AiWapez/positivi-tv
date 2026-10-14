/** Small, sourced gazetteer of physical features, never a list of story fixtures.
 * Coordinates are reference points for broad areas, not exact event sites or statistical accuracy estimates.
 * Extend only with an unambiguous name and an independently checked coordinate source.
 */
export const MAP_PLACES = [
  { id: 'ca-clayoquot-sound', name: 'Clayoquot Sound, Canada', aliases: ['Clayoquot Sound'], lat: 49.233333, lng: -126.044444,
    areaKm: 100, referenceUrl: 'https://geonames.nrcan.gc.ca/search-place-names/unique?id=JADRA',
    referenceNote: 'Official Canadian Geographical Names Database reference point for the sound.', checkedAt: '2026-10-14' },
  { id: 'us-klamath-river', name: 'Klamath River area, US', aliases: ['Klamath River'], lat: 41.51, lng: -123.98,
    areaKm: 450, referenceUrl: 'https://www.cnrfc.noaa.gov/obsRiver.php?id=KLMC1',
    referenceNote: 'NOAA reference point on the lower river. Marker represents the river area, not the dam-removal or salmon-observation site.', checkedAt: '2026-10-14' },
] as const;
export interface MapArea { placeId: string; basis: 'title' | 'feed_description'; referenceUrl: string; areaKm: number }
export function validMapArea(area: unknown, lat: number | null, lng: number | null, name: string): area is MapArea {
  if (!area || typeof area !== 'object') return false;
  const a = area as MapArea, p = MAP_PLACES.find(p => p.id === a.placeId);
  return !!p && (a.basis === 'title' || a.basis === 'feed_description') && a.referenceUrl === p.referenceUrl
    && a.areaKm === p.areaKm && lat === p.lat && lng === p.lng && name === p.name;
}

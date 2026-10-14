import { MAP_PLACES } from '../src/lib/map-places.ts';
import type { MapArea } from '../src/lib/map-places.ts';
import { countryFromHeadline } from './publisher-location.ts';
export interface FeedLocation {
  name: string; lat: number; lng: number; precision: 'region' | 'country'; mapArea?: MapArea;
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ACTION = /\b(?:restor\w*|replant\w*|rebuild\w*|rescu\w*|protect\w*|return\w*|reopen\w*|open(?:s|ed)?|rewild\w*|reintroduc\w*|regrow\w*|clean(?:s|ed|up)?|thriv\w*)\b/i;
const PHYSICAL = /\b(?:kelp|forests?|reefs?|salmon|dams?|rivers?|wetlands?|shelters?|schools?|libraries|library|homes?|parks?|habitats?|wildlife|trees?|coral|animals?)\b/i;
const NONLOCAL = /\b(?:Mars|Moon|lunar|rovers?|galax\w*|telescopes?|asteroids?|exoplanets?|spacecraft|satellites?|headquarters|headquartered|based|born|hometown|conference|award|prize|researchers?|scientists?|study|elsewhere|abroad|overseas|distant)\b/i;
const normalize = (s: string) => s.normalize('NFC').replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
/** Conservative relation rules over permitted feed text only. Never fetches articles or calls a geocoder.
 * A name is not sufficient: require a physical outcome and a local relation/scene-setting opening.
 * Multiple named features, author origins, off-Earth and nonlocal research stories abstain.
 * Text rules are fallible; cards explicitly disclose the broad reference area and its source.
 */
export function locateFeedOutcome(title: string, description: string): FeedLocation | null {
  const t = normalize(title), d = normalize(description).slice(0, 1000);
  const action = ACTION.exec(t);
  if (!action || !PHYSICAL.test(t) || NONLOCAL.test(t)) return null;
  const matches = MAP_PLACES.filter(p => p.aliases.some(alias => new RegExp(`(?<![\\p{L}])${esc(alias)}(?![\\p{L}])`, 'u').test(`${t} ${d}`)));
  if (matches.length > 1) return null;
  const p = matches[0];
  if (p) {
    for (const alias of p.aliases) {
      const a = esc(alias), relation = new RegExp(`\\b(?:in|across|along|on|at|to)\\s+(?:the\\s+)?${a}(?![\\p{L}])`, 'iu');
      const titleMatch = relation.exec(t);
      const scene = new RegExp(`^(?:In|Along|Across|On|At)\\s+(?:the\\s+)?${a},`, 'u').test(t);
      let basis: MapArea['basis'] | null = titleMatch && (titleMatch.index > action.index || scene)
        && !/\b(?:based|born|headquartered|raised|trained|working|living|studying)\s*$/i.test(t.slice(0, titleMatch.index)) ? 'title' : null;
      // Only a geographical scene-setting lead counts in a description; incidental later mentions do not.
      const lead = new RegExp(`^(?:(?:In|Along|Across|On|At)\\s+(?:the\\s+)?${a}(?=,|\\s)|(?:The\\s+)?${a}\\s+(?:in|has|now|is|was)\\b)`, 'u');
      if (!basis && lead.test(d) && !/\b(?:headquarters|born|based|researchers?|scientists?|conference|award)\b/i.test(d.split(/[.!?]/)[0])) basis = 'feed_description';
      if (basis) return { name: p.name, lat: p.lat, lng: p.lng, precision: 'region', mapArea: { placeId: p.id, basis, referenceUrl: p.referenceUrl, areaKm: p.areaKm } };
    }
    return null;
  }
  const country = countryFromHeadline(t);
  // "Volunteers in X restore ..." may locate the volunteers, rather than the outcome.
  const outcomeCountry = countryFromHeadline(t.slice(action.index));
  const scene = /^(?:In|Across|Throughout|Around)\s+[^,]+,/u.test(t);
  return country && (outcomeCountry?.name === country.name || scene) ? { ...country, precision: 'country' } : null;
}

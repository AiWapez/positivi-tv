/**
 * Strict headline-only country resolver for the automatic publisher-feed lane.
 *
 * It returns a country only when the headline says the story happened "in", "across", "throughout" or
 * "around" exactly one recognised country, and no other recognised country is named anywhere in the
 * headline, and the phrase is not an origin or base ("based in", "born in", "made in", "headquartered in"
 * and similar). It never reads the description, the publisher's location, the feed's regional theme or an
 * incidental mention, and it never returns 0/0. The pin is an approximate country centre, labelled as such.
 *
 * Known limitations: no cities, regions or oceans; demonyms ("Kenyan") are ignored; ambiguous names
 * (Chad, Jordan, Georgia, Guinea, Niger, Congo, Korea, Turkey, Dominica, America) are not resolved
 * (only the full names "Democratic Republic of the Congo", "Republic of the Congo", "South Korea" and "North Korea" are);
 * a headline can say "in X" about a team, product or person who is not where the event happened;
 * multi-country stories are left unlocated. Wrong pins remain possible, so the card says
 * "Country from headline (approximate)" and the maintainer can withdraw a card.
 */
export interface CountryMatch { name: string; lat: number; lng: number }
const COUNTRIES: [string, number, number, string[]?][] = [
  ['Argentina', -38.4, -63.6], ['Australia', -25.3, 133.8], ['Austria', 47.5, 14.6], ['Bangladesh', 23.7, 90.4],
  ['Belgium', 50.5, 4.5], ['Belize', 17.2, -88.5], ['Benin', 9.3, 2.3], ['Bhutan', 27.5, 90.4], ['Bolivia', -16.3, -63.6],
  ['Botswana', -22.3, 24.7], ['Brazil', -14.2, -51.9], ['Bulgaria', 42.7, 25.5], ['Burkina Faso', 12.2, -1.6],
  ['Cambodia', 12.6, 105.0], ['Cameroon', 7.4, 12.4], ['Canada', 56.1, -106.3], ['Chile', -35.7, -71.5], ['China', 35.9, 104.2],
  ['Colombia', 4.6, -74.3], ['Costa Rica', 9.7, -83.8], ["Côte d'Ivoire", 7.5, -5.5, ['Ivory Coast', "Cote d'Ivoire"]],
  ['Croatia', 45.1, 15.2], ['Cuba', 21.5, -77.8], ['Czechia', 49.8, 15.5, ['Czech Republic']], ['Denmark', 56.3, 9.5],
  ['Ecuador', -1.8, -78.2], ['Egypt', 26.8, 30.8], ['England', 52.4, -1.5], ['Estonia', 58.6, 25.0], ['Ethiopia', 9.1, 40.5],
  ['Fiji', -17.7, 178.1], ['Finland', 61.9, 25.7], ['France', 46.2, 2.2], ['Germany', 51.2, 10.5], ['Ghana', 7.9, -1.0],
  ['Greece', 39.1, 21.8], ['Guatemala', 15.8, -90.2], ['Honduras', 15.2, -86.2], ['Hungary', 47.2, 19.5], ['Iceland', 65.0, -19.0],
  ['India', 20.6, 79.0], ['Indonesia', -0.8, 113.9], ['Ireland', 53.4, -8.2], ['Italy', 41.9, 12.6], ['Jamaica', 18.1, -77.3],
  ['Japan', 36.2, 138.3], ['Kazakhstan', 48.0, 66.9], ['Kenya', 0.0, 37.9], ['Kyrgyzstan', 41.2, 74.8], ['Laos', 19.9, 102.5],
  ['Latvia', 56.9, 24.6], ['Liberia', 6.4, -9.4], ['Lithuania', 55.2, 23.9], ['Luxembourg', 49.8, 6.1], ['Madagascar', -18.8, 46.9],
  ['Malawi', -13.3, 34.3], ['Malaysia', 4.2, 102.0], ['Mali', 17.6, -4.0], ['Mauritius', -20.3, 57.6], ['Mexico', 23.6, -102.6],
  ['Mongolia', 46.9, 103.8], ['Morocco', 31.8, -7.1], ['Mozambique', -18.7, 35.5], ['Namibia', -23.0, 18.5], ['Nepal', 28.4, 84.1],
  ['Netherlands', 52.1, 5.3, ['Holland', 'The Netherlands']], ['New Zealand', -40.9, 174.9], ['Nicaragua', 12.9, -85.2], ['Nigeria', 9.1, 8.7], ['Norway', 60.5, 8.5],
  ['Pakistan', 30.4, 69.3], ['Panama', 8.5, -80.8], ['Papua New Guinea', -6.3, 144.0], ['Paraguay', -23.4, -58.4], ['Peru', -9.2, -75.0],
  ['Philippines', 12.9, 121.8], ['Poland', 51.9, 19.1], ['Portugal', 39.4, -8.2], ['Romania', 45.9, 25.0], ['Rwanda', -1.9, 29.9],
  ['Scotland', 56.5, -4.2], ['Senegal', 14.5, -14.5], ['Serbia', 44.0, 21.0], ['Seychelles', -4.7, 55.5], ['Sierra Leone', 8.5, -11.8],
  ['Singapore', 1.35, 103.8], ['Slovakia', 48.7, 19.7], ['Slovenia', 46.2, 15.0], ['Somalia', 5.2, 46.2], ['South Africa', -30.6, 22.9],
  ['South Korea', 35.9, 127.8], ['South Sudan', 6.9, 31.3], ['Spain', 40.5, -3.7], ['Sri Lanka', 7.9, 80.8], ['Sudan', 12.9, 30.2],
  ['Sweden', 60.1, 18.6], ['Switzerland', 46.8, 8.2], ['Taiwan', 23.7, 121.0], ['Tanzania', -6.4, 34.9], ['Thailand', 15.9, 101.0],
  ['Togo', 8.6, 0.8], ['Tunisia', 33.9, 9.5], ['Türkiye', 39.0, 35.2], ['Uganda', 1.4, 32.3], ['Ukraine', 48.4, 31.2],
  ['United Kingdom', 55.4, -3.4, ['UK', 'U.K.', 'Britain', 'Great Britain']], ['United States', 39.8, -98.6, ['US', 'U.S.', 'USA', 'U.S.A.']],
  ['Uruguay', -32.5, -55.8], ['Venezuela', 6.4, -66.6], ['Vietnam', 14.1, 108.3, ['Viet Nam']], ['Wales', 52.1, -3.8],
  ['Zambia', -13.1, 27.8], ['Zimbabwe', -19.0, 29.2],
  ['Afghanistan', 33.0, 65.0], ['Albania', 41.0, 20.0], ['Algeria', 28.0, 3.0], ['Andorra', 42.5, 1.5], ['Angola', -12.5, 18.5],
  ['Antigua and Barbuda', 17.1, -61.8], ['Armenia', 40.0, 45.0], ['Azerbaijan', 40.5, 47.5], ['Bahamas', 24.2, -76.0, ['The Bahamas']],
  ['Bahrain', 26.0, 50.5], ['Barbados', 13.2, -59.5], ['Belarus', 53.0, 28.0], ['Bosnia and Herzegovina', 44.0, 18.0, ['Bosnia']],
  ['Brunei', 4.5, 114.7], ['Burundi', -3.5, 30.0], ['Cabo Verde', 16.0, -24.0, ['Cape Verde']], ['Comoros', -12.2, 44.2],
  ['Cyprus', 35.0, 33.0], ['Democratic Republic of the Congo', 0.0, 25.0, ['DR Congo', 'DRC']], ['Djibouti', 11.5, 43.0],
  ['Dominican Republic', 19.0, -70.7], ['El Salvador', 13.8, -88.9], ['Equatorial Guinea', 2.0, 10.0], ['Eritrea', 15.0, 39.0],
  ['Eswatini', -26.5, 31.5], ['Gabon', -1.0, 11.8], ['Gambia', 13.5, -16.6, ['The Gambia']], ['Grenada', 12.1, -61.7],
  ['Guinea-Bissau', 12.0, -15.0], ['Guyana', 5.0, -59.0], ['Haiti', 19.0, -72.4], ['Iran', 32.0, 53.0], ['Iraq', 33.0, 44.0],
  ['Israel', 31.5, 34.8], ['Kiribati', 1.4, 173.0], ['Kosovo', 42.6, 21.0], ['Kuwait', 29.5, 45.8], ['Lebanon', 33.8, 35.8],
  ['Lesotho', -29.5, 28.5], ['Libya', 25.0, 17.0], ['Liechtenstein', 47.3, 9.5], ['Maldives', 3.2, 73.0], ['Malta', 35.8, 14.6],
  ['Marshall Islands', 9.0, 168.0], ['Mauritania', 20.0, -12.0], ['Moldova', 47.0, 29.0], ['Monaco', 43.7, 7.4],
  ['Montenegro', 42.5, 19.3], ['Myanmar', 22.0, 98.0, ['Burma']], ['Nauru', -0.5, 166.9], ['North Korea', 40.0, 127.0],
  ['North Macedonia', 41.8, 22.0], ['Oman', 21.0, 57.0], ['Palau', 7.5, 134.5], ['Qatar', 25.5, 51.2],
  ['Republic of the Congo', -1.0, 15.0], ['Russia', 60.0, 100.0], ['Saint Kitts and Nevis', 17.3, -62.8], ['Saint Lucia', 13.9, -61.0],
  ['Saint Vincent and the Grenadines', 13.2, -61.2], ['Samoa', -13.6, -172.3], ['San Marino', 43.8, 12.4],
  ['Sao Tome and Principe', 1.0, 7.0], ['Saudi Arabia', 25.0, 45.0], ['Solomon Islands', -8.0, 159.0], ['Suriname', 4.0, -56.0],
  ['Syria', 35.0, 38.0], ['Tajikistan', 39.0, 71.0], ['Timor-Leste', -8.8, 125.9, ['East Timor']], ['Tonga', -20.0, -175.0],
  ['Trinidad and Tobago', 11.0, -61.0], ['Turkmenistan', 40.0, 60.0], ['Tuvalu', -8.0, 178.0],
  ['United Arab Emirates', 24.0, 54.0, ['UAE']], ['Uzbekistan', 41.0, 64.0], ['Vanuatu', -16.0, 167.0], ['Yemen', 15.0, 48.0],
];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Longest names first, so "South Sudan" is consumed before "Sudan" and "Papua New Guinea" stays whole. */
const NAMES = COUNTRIES.flatMap(([name, lat, lng, aliases = []]) => [name, ...aliases].map(alias => ({ alias, country: { name, lat, lng } })))
  .sort((a, b) => b.alias.length - a.alias.length);
// Names are case-sensitive (Chile is not "chile", US is not "us"); prepositions are not.
const MENTION = new RegExp('(?<![\\p{L}\\p{N}.-])(' + NAMES.map(n => esc(n.alias)).join('|') + ')(?![\\p{L}\\p{N}-])', 'gu');
const PREPOSITION = /(?:^|[\s,(—–-])(?:[Ii]n|IN|[Aa]cross|ACROSS|[Tt]hroughout|[Aa]round)\s+(?:the\s+|The\s+)?$/;
/** "in X" after these words names an origin or a base, not where the event happened. */
const ORIGIN = /(?<![\p{L}])(?:based|born|made|headquartered|founded|raised|registered|living|lives|lived|grown|grew up|trained|educated|incorporated|studying|studied|famous|popular|known|stationed|exiled|settled|working|worked)\s+(?:in|across|throughout|around)\s+(?:the\s+)?$/iu;
/** A headline opening exactly with "In X," sets the scene; any other opening clause ("Famous in France, ...") does not. */
const SCENE_OPENING = /^\s*(?:in|across|throughout|around)\s+(?:the\s+)?$/i;

const slugify = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const BY_SLUG = new Map(COUNTRIES.flatMap(([name, lat, lng, aliases = []]) => [name, ...aliases].map(alias => [slugify(alias), { name, lat, lng }] as const)));
/** A country the finder knows, by the URL-style slug a publisher uses for a location tag ("south-africa"). Exact match only. */
export function countryBySlug(slug: string): CountryMatch | null {
  const c = BY_SLUG.get(slug);
  return c ? { ...c } : null;
}
/** Every country name the finder knows (without aliases). */
export const COUNTRY_NAMES: readonly string[] = COUNTRIES.map(c => c[0]);

/** A country the finder knows, by its exact name. Used for a publisher's fixed home country, never for guessing from text. */
export function countryByName(name: string): CountryMatch | null {
  const c = COUNTRIES.find(([n]) => n === name);
  return c ? { name: c[0], lat: c[1], lng: c[2] } : null;
}

export function countryFromHeadline(title: string): CountryMatch | null {
  const text = title.normalize('NFC').replace(/\s+/g, ' ');
  const found: { country: CountryMatch; anchored: boolean }[] = [];
  for (const m of text.matchAll(MENTION)) {
    const entry = NAMES.find(n => n.alias === m[1]);
    if (!entry) continue;
    const before = text.slice(0, m.index), after = text.slice(m.index! + m[1].length);
    const inLeadingClause = text.includes(',') && m.index! < text.indexOf(',');
    // "Jamaica, Queens" or "Peru, Indiana": a country name followed by a capitalised place is a town elsewhere.
    const placeQualifier = /^,\s*\p{Lu}/u.test(after);
    found.push({ country: entry.country, anchored: PREPOSITION.test(before) && !ORIGIN.test(before)
      && !(inLeadingClause && !SCENE_OPENING.test(before)) && !placeQualifier });
  }
  const distinct = new Set(found.map(f => f.country.name));
  if (distinct.size !== 1 || !found.some(f => f.anchored)) return null;
  return { ...found[0].country };
}

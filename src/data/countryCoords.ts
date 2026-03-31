import type { Coordinates } from "../types";

// Maps country names, demonyms, cities, regions, universities, and
// common phrases to lat/lng. This is the core geographic brain of PositiviTV.
const COORDS: Record<string, Coordinates> = {
  // ── North America ──
  "united states": { lat: 38.9, lng: -77.0, name: "United States" },
  usa: { lat: 38.9, lng: -77.0, name: "United States" },
  "u.s.": { lat: 38.9, lng: -77.0, name: "United States" },
  american: { lat: 38.9, lng: -77.0, name: "United States" },
  americans: { lat: 38.9, lng: -77.0, name: "United States" },
  "new york": { lat: 40.71, lng: -74.01, name: "New York" },
  nyc: { lat: 40.71, lng: -74.01, name: "New York" },
  manhattan: { lat: 40.76, lng: -73.97, name: "New York" },
  brooklyn: { lat: 40.68, lng: -73.94, name: "Brooklyn" },
  "los angeles": { lat: 34.05, lng: -118.24, name: "Los Angeles" },
  hollywood: { lat: 34.09, lng: -118.33, name: "Los Angeles" },
  california: { lat: 36.78, lng: -119.42, name: "California" },
  chicago: { lat: 41.88, lng: -87.63, name: "Chicago" },
  houston: { lat: 29.76, lng: -95.37, name: "Houston" },
  texas: { lat: 31.97, lng: -99.9, name: "Texas" },
  "san francisco": { lat: 37.77, lng: -122.42, name: "San Francisco" },
  "silicon valley": { lat: 37.39, lng: -122.03, name: "Silicon Valley" },
  boston: { lat: 42.36, lng: -71.06, name: "Boston" },
  seattle: { lat: 47.61, lng: -122.33, name: "Seattle" },
  miami: { lat: 25.76, lng: -80.19, name: "Miami" },
  florida: { lat: 27.66, lng: -81.52, name: "Florida" },
  atlanta: { lat: 33.75, lng: -84.39, name: "Atlanta" },
  "washington dc": { lat: 38.91, lng: -77.04, name: "Washington DC" },
  washington: { lat: 38.91, lng: -77.04, name: "Washington DC" },
  philadelphia: { lat: 39.95, lng: -75.17, name: "Philadelphia" },
  denver: { lat: 39.74, lng: -104.99, name: "Denver" },
  phoenix: { lat: 33.45, lng: -112.07, name: "Phoenix" },
  detroit: { lat: 42.33, lng: -83.05, name: "Detroit" },
  "san diego": { lat: 32.72, lng: -117.16, name: "San Diego" },
  portland: { lat: 45.52, lng: -122.68, name: "Portland" },
  hawaii: { lat: 19.9, lng: -155.58, name: "Hawaii" },
  alaska: { lat: 64.2, lng: -152.49, name: "Alaska" },
  mit: { lat: 42.36, lng: -71.09, name: "MIT, Boston" },
  harvard: { lat: 42.37, lng: -71.12, name: "Harvard, Boston" },
  stanford: { lat: 37.43, lng: -122.17, name: "Stanford, California" },
  nasa: { lat: 28.57, lng: -80.65, name: "NASA, Florida" },
  pentagon: { lat: 38.87, lng: -77.06, name: "Pentagon, Virginia" },
  canada: { lat: 45.42, lng: -75.7, name: "Canada" },
  canadian: { lat: 45.42, lng: -75.7, name: "Canada" },
  toronto: { lat: 43.65, lng: -79.38, name: "Toronto" },
  vancouver: { lat: 49.28, lng: -123.12, name: "Vancouver" },
  montreal: { lat: 45.5, lng: -73.57, name: "Montreal" },
  mexico: { lat: 19.43, lng: -99.13, name: "Mexico" },
  mexican: { lat: 19.43, lng: -99.13, name: "Mexico" },

  // ── South America ──
  brazil: { lat: -15.79, lng: -47.88, name: "Brazil" },
  brazilian: { lat: -15.79, lng: -47.88, name: "Brazil" },
  "sao paulo": { lat: -23.55, lng: -46.63, name: "Sao Paulo" },
  "rio de janeiro": { lat: -22.91, lng: -43.17, name: "Rio de Janeiro" },
  argentina: { lat: -34.6, lng: -58.38, name: "Argentina" },
  "buenos aires": { lat: -34.6, lng: -58.38, name: "Buenos Aires" },
  colombia: { lat: 4.71, lng: -74.07, name: "Colombia" },
  chile: { lat: -33.45, lng: -70.67, name: "Chile" },
  chilean: { lat: -33.45, lng: -70.67, name: "Chile" },
  peru: { lat: -12.05, lng: -77.04, name: "Peru" },
  ecuador: { lat: -0.18, lng: -78.47, name: "Ecuador" },
  venezuela: { lat: 10.48, lng: -66.9, name: "Venezuela" },
  bolivia: { lat: -16.49, lng: -68.12, name: "Bolivia" },
  uruguay: { lat: -34.88, lng: -56.17, name: "Uruguay" },
  paraguay: { lat: -25.26, lng: -57.58, name: "Paraguay" },

  // ── Europe ──
  "united kingdom": { lat: 51.51, lng: -0.13, name: "United Kingdom" },
  uk: { lat: 51.51, lng: -0.13, name: "United Kingdom" },
  britain: { lat: 51.51, lng: -0.13, name: "United Kingdom" },
  british: { lat: 51.51, lng: -0.13, name: "United Kingdom" },
  england: { lat: 51.51, lng: -0.13, name: "England" },
  english: { lat: 51.51, lng: -0.13, name: "England" },
  london: { lat: 51.51, lng: -0.13, name: "London" },
  manchester: { lat: 53.48, lng: -2.24, name: "Manchester" },
  birmingham: { lat: 52.49, lng: -1.9, name: "Birmingham, UK" },
  scotland: { lat: 55.95, lng: -3.19, name: "Scotland" },
  edinburgh: { lat: 55.95, lng: -3.19, name: "Edinburgh" },
  wales: { lat: 51.48, lng: -3.18, name: "Wales" },
  oxford: { lat: 51.75, lng: -1.25, name: "Oxford" },
  cambridge: { lat: 52.21, lng: 0.12, name: "Cambridge" },
  france: { lat: 48.86, lng: 2.35, name: "France" },
  french: { lat: 48.86, lng: 2.35, name: "France" },
  paris: { lat: 48.86, lng: 2.35, name: "Paris" },
  germany: { lat: 52.52, lng: 13.41, name: "Germany" },
  german: { lat: 52.52, lng: 13.41, name: "Germany" },
  berlin: { lat: 52.52, lng: 13.41, name: "Berlin" },
  munich: { lat: 48.14, lng: 11.58, name: "Munich" },
  italy: { lat: 41.9, lng: 12.5, name: "Italy" },
  italian: { lat: 41.9, lng: 12.5, name: "Italy" },
  rome: { lat: 41.9, lng: 12.5, name: "Rome" },
  milan: { lat: 45.46, lng: 9.19, name: "Milan" },
  spain: { lat: 40.42, lng: -3.7, name: "Spain" },
  spanish: { lat: 40.42, lng: -3.7, name: "Spain" },
  madrid: { lat: 40.42, lng: -3.7, name: "Madrid" },
  barcelona: { lat: 41.39, lng: 2.17, name: "Barcelona" },
  portugal: { lat: 38.72, lng: -9.14, name: "Portugal" },
  portuguese: { lat: 38.72, lng: -9.14, name: "Portugal" },
  lisbon: { lat: 38.72, lng: -9.14, name: "Lisbon" },
  netherlands: { lat: 52.37, lng: 4.9, name: "Netherlands" },
  dutch: { lat: 52.37, lng: 4.9, name: "Netherlands" },
  amsterdam: { lat: 52.37, lng: 4.9, name: "Amsterdam" },
  belgium: { lat: 50.85, lng: 4.35, name: "Belgium" },
  belgian: { lat: 50.85, lng: 4.35, name: "Belgium" },
  brussels: { lat: 50.85, lng: 4.35, name: "Brussels" },
  switzerland: { lat: 46.95, lng: 7.45, name: "Switzerland" },
  swiss: { lat: 46.95, lng: 7.45, name: "Switzerland" },
  zurich: { lat: 47.37, lng: 8.54, name: "Zurich" },
  geneva: { lat: 46.2, lng: 6.14, name: "Geneva" },
  cern: { lat: 46.23, lng: 6.05, name: "CERN, Geneva" },
  sweden: { lat: 59.33, lng: 18.07, name: "Sweden" },
  swedish: { lat: 59.33, lng: 18.07, name: "Sweden" },
  stockholm: { lat: 59.33, lng: 18.07, name: "Stockholm" },
  norway: { lat: 59.91, lng: 10.75, name: "Norway" },
  norwegian: { lat: 59.91, lng: 10.75, name: "Norway" },
  oslo: { lat: 59.91, lng: 10.75, name: "Oslo" },
  denmark: { lat: 55.68, lng: 12.57, name: "Denmark" },
  danish: { lat: 55.68, lng: 12.57, name: "Denmark" },
  copenhagen: { lat: 55.68, lng: 12.57, name: "Copenhagen" },
  finland: { lat: 60.17, lng: 24.94, name: "Finland" },
  finnish: { lat: 60.17, lng: 24.94, name: "Finland" },
  helsinki: { lat: 60.17, lng: 24.94, name: "Helsinki" },
  ireland: { lat: 53.35, lng: -6.26, name: "Ireland" },
  irish: { lat: 53.35, lng: -6.26, name: "Ireland" },
  dublin: { lat: 53.35, lng: -6.26, name: "Dublin" },
  poland: { lat: 52.23, lng: 21.01, name: "Poland" },
  polish: { lat: 52.23, lng: 21.01, name: "Poland" },
  warsaw: { lat: 52.23, lng: 21.01, name: "Warsaw" },
  austria: { lat: 48.21, lng: 16.37, name: "Austria" },
  austrian: { lat: 48.21, lng: 16.37, name: "Austria" },
  vienna: { lat: 48.21, lng: 16.37, name: "Vienna" },
  greece: { lat: 37.98, lng: 23.73, name: "Greece" },
  greek: { lat: 37.98, lng: 23.73, name: "Greece" },
  athens: { lat: 37.98, lng: 23.73, name: "Athens" },
  czech: { lat: 50.08, lng: 14.44, name: "Czech Republic" },
  prague: { lat: 50.08, lng: 14.44, name: "Prague" },
  ukraine: { lat: 50.45, lng: 30.52, name: "Ukraine" },
  ukrainian: { lat: 50.45, lng: 30.52, name: "Ukraine" },
  kyiv: { lat: 50.45, lng: 30.52, name: "Kyiv" },
  romania: { lat: 44.43, lng: 26.1, name: "Romania" },
  hungary: { lat: 47.5, lng: 19.04, name: "Hungary" },
  budapest: { lat: 47.5, lng: 19.04, name: "Budapest" },
  iceland: { lat: 64.15, lng: -21.94, name: "Iceland" },
  "european union": { lat: 50.85, lng: 4.35, name: "EU, Brussels" },
  eu: { lat: 50.85, lng: 4.35, name: "EU, Brussels" },
  european: { lat: 50.85, lng: 4.35, name: "Europe" },
  europe: { lat: 50.85, lng: 4.35, name: "Europe" },

  // ── Asia ──
  china: { lat: 39.9, lng: 116.4, name: "China" },
  chinese: { lat: 39.9, lng: 116.4, name: "China" },
  beijing: { lat: 39.9, lng: 116.4, name: "Beijing" },
  shanghai: { lat: 31.23, lng: 121.47, name: "Shanghai" },
  shenzhen: { lat: 22.54, lng: 114.06, name: "Shenzhen" },
  hongkong: { lat: 22.32, lng: 114.17, name: "Hong Kong" },
  japan: { lat: 35.68, lng: 139.69, name: "Japan" },
  japanese: { lat: 35.68, lng: 139.69, name: "Japan" },
  tokyo: { lat: 35.68, lng: 139.69, name: "Tokyo" },
  osaka: { lat: 34.69, lng: 135.5, name: "Osaka" },
  "south korea": { lat: 37.57, lng: 126.98, name: "South Korea" },
  korean: { lat: 37.57, lng: 126.98, name: "South Korea" },
  seoul: { lat: 37.57, lng: 126.98, name: "Seoul" },
  india: { lat: 28.61, lng: 77.21, name: "India" },
  indian: { lat: 28.61, lng: 77.21, name: "India" },
  "new delhi": { lat: 28.61, lng: 77.21, name: "New Delhi" },
  mumbai: { lat: 19.08, lng: 72.88, name: "Mumbai" },
  bangalore: { lat: 12.97, lng: 77.59, name: "Bangalore" },
  singapore: { lat: 1.35, lng: 103.82, name: "Singapore" },
  thailand: { lat: 13.76, lng: 100.5, name: "Thailand" },
  thai: { lat: 13.76, lng: 100.5, name: "Thailand" },
  bangkok: { lat: 13.76, lng: 100.5, name: "Bangkok" },
  vietnam: { lat: 21.03, lng: 105.85, name: "Vietnam" },
  vietnamese: { lat: 21.03, lng: 105.85, name: "Vietnam" },
  indonesia: { lat: -6.21, lng: 106.85, name: "Indonesia" },
  indonesian: { lat: -6.21, lng: 106.85, name: "Indonesia" },
  jakarta: { lat: -6.21, lng: 106.85, name: "Jakarta" },
  philippines: { lat: 14.6, lng: 120.98, name: "Philippines" },
  filipino: { lat: 14.6, lng: 120.98, name: "Philippines" },
  malaysia: { lat: 3.14, lng: 101.69, name: "Malaysia" },
  "kuala lumpur": { lat: 3.14, lng: 101.69, name: "Kuala Lumpur" },
  taiwan: { lat: 25.03, lng: 121.57, name: "Taiwan" },
  taiwanese: { lat: 25.03, lng: 121.57, name: "Taiwan" },
  israel: { lat: 31.77, lng: 35.23, name: "Israel" },
  israeli: { lat: 31.77, lng: 35.23, name: "Israel" },
  "tel aviv": { lat: 32.09, lng: 34.78, name: "Tel Aviv" },
  "saudi arabia": { lat: 24.69, lng: 46.72, name: "Saudi Arabia" },
  saudi: { lat: 24.69, lng: 46.72, name: "Saudi Arabia" },
  "united arab emirates": { lat: 24.45, lng: 54.65, name: "UAE" },
  uae: { lat: 24.45, lng: 54.65, name: "UAE" },
  dubai: { lat: 25.2, lng: 55.27, name: "Dubai" },
  "abu dhabi": { lat: 24.45, lng: 54.65, name: "Abu Dhabi" },
  turkey: { lat: 39.93, lng: 32.85, name: "Turkey" },
  turkish: { lat: 39.93, lng: 32.85, name: "Turkey" },
  istanbul: { lat: 41.01, lng: 28.98, name: "Istanbul" },
  pakistan: { lat: 33.69, lng: 73.04, name: "Pakistan" },
  pakistani: { lat: 33.69, lng: 73.04, name: "Pakistan" },
  bangladesh: { lat: 23.81, lng: 90.41, name: "Bangladesh" },
  nepal: { lat: 27.72, lng: 85.32, name: "Nepal" },
  "sri lanka": { lat: 6.93, lng: 79.85, name: "Sri Lanka" },
  myanmar: { lat: 16.87, lng: 96.2, name: "Myanmar" },
  cambodia: { lat: 11.56, lng: 104.92, name: "Cambodia" },

  // ── Africa ──
  "south africa": { lat: -33.93, lng: 18.42, name: "South Africa" },
  "south african": { lat: -33.93, lng: 18.42, name: "South Africa" },
  "cape town": { lat: -33.93, lng: 18.42, name: "Cape Town" },
  johannesburg: { lat: -26.2, lng: 28.04, name: "Johannesburg" },
  nigeria: { lat: 9.06, lng: 7.49, name: "Nigeria" },
  nigerian: { lat: 9.06, lng: 7.49, name: "Nigeria" },
  lagos: { lat: 6.52, lng: 3.38, name: "Lagos" },
  kenya: { lat: -1.29, lng: 36.82, name: "Kenya" },
  kenyan: { lat: -1.29, lng: 36.82, name: "Kenya" },
  nairobi: { lat: -1.29, lng: 36.82, name: "Nairobi" },
  egypt: { lat: 30.04, lng: 31.24, name: "Egypt" },
  egyptian: { lat: 30.04, lng: 31.24, name: "Egypt" },
  cairo: { lat: 30.04, lng: 31.24, name: "Cairo" },
  ethiopia: { lat: 9.01, lng: 38.75, name: "Ethiopia" },
  ethiopian: { lat: 9.01, lng: 38.75, name: "Ethiopia" },
  ghana: { lat: 5.6, lng: -0.19, name: "Ghana" },
  morocco: { lat: 33.97, lng: -6.85, name: "Morocco" },
  moroccan: { lat: 33.97, lng: -6.85, name: "Morocco" },
  tanzania: { lat: -6.79, lng: 39.28, name: "Tanzania" },
  uganda: { lat: 0.35, lng: 32.58, name: "Uganda" },
  rwanda: { lat: -1.94, lng: 29.87, name: "Rwanda" },
  senegal: { lat: 14.69, lng: -17.44, name: "Senegal" },
  congo: { lat: -4.44, lng: 15.27, name: "Congo" },
  africa: { lat: -1.29, lng: 36.82, name: "Africa" },
  african: { lat: -1.29, lng: 36.82, name: "Africa" },

  // ── Oceania ──
  australia: { lat: -33.87, lng: 151.21, name: "Australia" },
  australian: { lat: -33.87, lng: 151.21, name: "Australia" },
  sydney: { lat: -33.87, lng: 151.21, name: "Sydney" },
  melbourne: { lat: -37.81, lng: 144.96, name: "Melbourne" },
  brisbane: { lat: -27.47, lng: 153.03, name: "Brisbane" },
  "new zealand": { lat: -41.29, lng: 174.78, name: "New Zealand" },
  "new zealander": { lat: -41.29, lng: 174.78, name: "New Zealand" },
  wellington: { lat: -41.29, lng: 174.78, name: "Wellington" },
  auckland: { lat: -36.85, lng: 174.76, name: "Auckland" },

  // ── Middle East ──
  iran: { lat: 35.69, lng: 51.39, name: "Iran" },
  iranian: { lat: 35.69, lng: 51.39, name: "Iran" },
  iraq: { lat: 33.31, lng: 44.37, name: "Iraq" },
  iraqi: { lat: 33.31, lng: 44.37, name: "Iraq" },
  jordan: { lat: 31.95, lng: 35.93, name: "Jordan" },
  lebanon: { lat: 33.89, lng: 35.5, name: "Lebanon" },
  qatar: { lat: 25.29, lng: 51.53, name: "Qatar" },
  kuwait: { lat: 29.38, lng: 47.99, name: "Kuwait" },
  oman: { lat: 23.59, lng: 58.55, name: "Oman" },
  bahrain: { lat: 26.23, lng: 50.59, name: "Bahrain" },

  // ── Russia and Central Asia ──
  russia: { lat: 55.76, lng: 37.62, name: "Russia" },
  russian: { lat: 55.76, lng: 37.62, name: "Russia" },
  moscow: { lat: 55.76, lng: 37.62, name: "Moscow" },
  kazakhstan: { lat: 51.17, lng: 71.43, name: "Kazakhstan" },
  uzbekistan: { lat: 41.3, lng: 69.28, name: "Uzbekistan" },

  // ── Caribbean ──
  cuba: { lat: 23.11, lng: -82.37, name: "Cuba" },
  jamaica: { lat: 18.0, lng: -76.79, name: "Jamaica" },
  "dominican republic": { lat: 18.49, lng: -69.88, name: "Dominican Republic" },
  "puerto rico": { lat: 18.47, lng: -66.11, name: "Puerto Rico" },
  haiti: { lat: 18.54, lng: -72.34, name: "Haiti" },

  // ── Common orgs / contextual ──
  "world health organization": { lat: 46.23, lng: 6.14, name: "WHO, Geneva" },
  who: { lat: 46.23, lng: 6.14, name: "WHO, Geneva" },
  "united nations": { lat: 40.75, lng: -73.97, name: "UN, New York" },
  olympic: { lat: 46.52, lng: 6.63, name: "IOC, Lausanne" },
  olympics: { lat: 46.52, lng: 6.63, name: "IOC, Lausanne" },
  "world cup": { lat: 46.52, lng: 6.63, name: "FIFA, Zurich" },
  nba: { lat: 40.75, lng: -73.99, name: "NBA, New York" },
  nfl: { lat: 40.75, lng: -73.99, name: "NFL, New York" },
  "premier league": { lat: 51.51, lng: -0.13, name: "Premier League, London" },
};

// Priority ordering: longer keys first = more specific matches win
const SORTED_ENTRIES = Object.entries(COORDS).sort(
  (a, b) => b[0].length - a[0].length
);

/**
 * Tries to extract a location from article title + description.
 * Matches against our lookup table with longest-match-first priority.
 */
export function extractLocation(article: {
  title: string;
  description: string;
}): Coordinates | null {
  const text = `${article.title} ${article.description}`.toLowerCase();

  // Skip very short text
  if (text.length < 10) return null;

  // Find the longest matching key (most specific location)
  for (const [key, coords] of SORTED_ENTRIES) {
    // Skip very short keys to avoid false positives
    if (key.length < 3) continue;

    // Word boundary check: make sure we're matching whole words
    // e.g. "thai" shouldn't match "thailand" (thailand has its own entry)
    const idx = text.indexOf(key);
    if (idx === -1) continue;

    // Simple word boundary: check char before and after match
    const before = idx === 0 ? " " : text[idx - 1];
    const after =
      idx + key.length >= text.length
        ? " "
        : text[idx + key.length];
    const wordBoundary = /[\s,.:;!?'"()\-\/]/.test(before) &&
      /[\s,.:;!?'"()\-\/]/.test(after);

    // For longer keys (4+ chars) be less strict about boundaries
    if (key.length >= 6 || wordBoundary) {
      return coords;
    }
  }

  return null;
}

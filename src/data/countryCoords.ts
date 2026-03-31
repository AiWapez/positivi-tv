import type { Coordinates } from "../types";

// Maps country names, demonyms, and major cities to lat/lng
// Falls back to country capital when a specific city is not found
const COORDS: Record<string, Coordinates> = {
  // North America
  "united states": { lat: 38.9, lng: -77.0, name: "United States" },
  usa: { lat: 38.9, lng: -77.0, name: "United States" },
  "new york": { lat: 40.71, lng: -74.01, name: "New York" },
  "los angeles": { lat: 34.05, lng: -118.24, name: "Los Angeles" },
  chicago: { lat: 41.88, lng: -87.63, name: "Chicago" },
  houston: { lat: 29.76, lng: -95.37, name: "Houston" },
  "san francisco": { lat: 37.77, lng: -122.42, name: "San Francisco" },
  boston: { lat: 42.36, lng: -71.06, name: "Boston" },
  seattle: { lat: 47.61, lng: -122.33, name: "Seattle" },
  miami: { lat: 25.76, lng: -80.19, name: "Miami" },
  atlanta: { lat: 33.75, lng: -84.39, name: "Atlanta" },
  "washington dc": { lat: 38.91, lng: -77.04, name: "Washington DC" },
  canada: { lat: 45.42, lng: -75.7, name: "Canada" },
  toronto: { lat: 43.65, lng: -79.38, name: "Toronto" },
  mexico: { lat: 19.43, lng: -99.13, name: "Mexico" },

  // South America
  brazil: { lat: -15.79, lng: -47.88, name: "Brazil" },
  "sao paulo": { lat: -23.55, lng: -46.63, name: "Sao Paulo" },
  argentina: { lat: -34.6, lng: -58.38, name: "Argentina" },
  colombia: { lat: 4.71, lng: -74.07, name: "Colombia" },
  chile: { lat: -33.45, lng: -70.67, name: "Chile" },
  peru: { lat: -12.05, lng: -77.04, name: "Peru" },

  // Europe
  "united kingdom": { lat: 51.51, lng: -0.13, name: "United Kingdom" },
  uk: { lat: 51.51, lng: -0.13, name: "United Kingdom" },
  britain: { lat: 51.51, lng: -0.13, name: "United Kingdom" },
  london: { lat: 51.51, lng: -0.13, name: "London" },
  manchester: { lat: 53.48, lng: -2.24, name: "Manchester" },
  france: { lat: 48.86, lng: 2.35, name: "France" },
  paris: { lat: 48.86, lng: 2.35, name: "Paris" },
  germany: { lat: 52.52, lng: 13.41, name: "Germany" },
  berlin: { lat: 52.52, lng: 13.41, name: "Berlin" },
  munich: { lat: 48.14, lng: 11.58, name: "Munich" },
  italy: { lat: 41.9, lng: 12.5, name: "Italy" },
  rome: { lat: 41.9, lng: 12.5, name: "Rome" },
  spain: { lat: 40.42, lng: -3.7, name: "Spain" },
  madrid: { lat: 40.42, lng: -3.7, name: "Madrid" },
  portugal: { lat: 38.72, lng: -9.14, name: "Portugal" },
  lisbon: { lat: 38.72, lng: -9.14, name: "Lisbon" },
  netherlands: { lat: 52.37, lng: 4.9, name: "Netherlands" },
  amsterdam: { lat: 52.37, lng: 4.9, name: "Amsterdam" },
  belgium: { lat: 50.85, lng: 4.35, name: "Belgium" },
  brussels: { lat: 50.85, lng: 4.35, name: "Brussels" },
  switzerland: { lat: 46.95, lng: 7.45, name: "Switzerland" },
  zurich: { lat: 47.37, lng: 8.54, name: "Zurich" },
  geneva: { lat: 46.2, lng: 6.14, name: "Geneva" },
  sweden: { lat: 59.33, lng: 18.07, name: "Sweden" },
  stockholm: { lat: 59.33, lng: 18.07, name: "Stockholm" },
  norway: { lat: 59.91, lng: 10.75, name: "Norway" },
  oslo: { lat: 59.91, lng: 10.75, name: "Oslo" },
  denmark: { lat: 55.68, lng: 12.57, name: "Denmark" },
  copenhagen: { lat: 55.68, lng: 12.57, name: "Copenhagen" },
  finland: { lat: 60.17, lng: 24.94, name: "Finland" },
  helsinki: { lat: 60.17, lng: 24.94, name: "Helsinki" },
  ireland: { lat: 53.35, lng: -6.26, name: "Ireland" },
  dublin: { lat: 53.35, lng: -6.26, name: "Dublin" },
  poland: { lat: 52.23, lng: 21.01, name: "Poland" },
  austria: { lat: 48.21, lng: 16.37, name: "Austria" },
  vienna: { lat: 48.21, lng: 16.37, name: "Vienna" },
  greece: { lat: 37.98, lng: 23.73, name: "Greece" },
  athens: { lat: 37.98, lng: 23.73, name: "Athens" },
  czech: { lat: 50.08, lng: 14.44, name: "Czech Republic" },
  prague: { lat: 50.08, lng: 14.44, name: "Prague" },
  ukraine: { lat: 50.45, lng: 30.52, name: "Ukraine" },
  romania: { lat: 44.43, lng: 26.1, name: "Romania" },
  hungary: { lat: 47.5, lng: 19.04, name: "Hungary" },
  iceland: { lat: 64.15, lng: -21.94, name: "Iceland" },

  // Asia
  china: { lat: 39.9, lng: 116.4, name: "China" },
  beijing: { lat: 39.9, lng: 116.4, name: "Beijing" },
  shanghai: { lat: 31.23, lng: 121.47, name: "Shanghai" },
  japan: { lat: 35.68, lng: 139.69, name: "Japan" },
  tokyo: { lat: 35.68, lng: 139.69, name: "Tokyo" },
  "south korea": { lat: 37.57, lng: 126.98, name: "South Korea" },
  seoul: { lat: 37.57, lng: 126.98, name: "Seoul" },
  india: { lat: 28.61, lng: 77.21, name: "India" },
  "new delhi": { lat: 28.61, lng: 77.21, name: "New Delhi" },
  mumbai: { lat: 19.08, lng: 72.88, name: "Mumbai" },
  singapore: { lat: 1.35, lng: 103.82, name: "Singapore" },
  thailand: { lat: 13.76, lng: 100.5, name: "Thailand" },
  bangkok: { lat: 13.76, lng: 100.5, name: "Bangkok" },
  vietnam: { lat: 21.03, lng: 105.85, name: "Vietnam" },
  indonesia: { lat: -6.21, lng: 106.85, name: "Indonesia" },
  jakarta: { lat: -6.21, lng: 106.85, name: "Jakarta" },
  philippines: { lat: 14.6, lng: 120.98, name: "Philippines" },
  malaysia: { lat: 3.14, lng: 101.69, name: "Malaysia" },
  taiwan: { lat: 25.03, lng: 121.57, name: "Taiwan" },
  israel: { lat: 31.77, lng: 35.23, name: "Israel" },
  "saudi arabia": { lat: 24.69, lng: 46.72, name: "Saudi Arabia" },
  "united arab emirates": { lat: 24.45, lng: 54.65, name: "UAE" },
  uae: { lat: 24.45, lng: 54.65, name: "UAE" },
  dubai: { lat: 25.2, lng: 55.27, name: "Dubai" },
  turkey: { lat: 39.93, lng: 32.85, name: "Turkey" },
  istanbul: { lat: 41.01, lng: 28.98, name: "Istanbul" },
  pakistan: { lat: 33.69, lng: 73.04, name: "Pakistan" },
  bangladesh: { lat: 23.81, lng: 90.41, name: "Bangladesh" },

  // Africa
  "south africa": { lat: -33.93, lng: 18.42, name: "South Africa" },
  "cape town": { lat: -33.93, lng: 18.42, name: "Cape Town" },
  nigeria: { lat: 9.06, lng: 7.49, name: "Nigeria" },
  lagos: { lat: 6.52, lng: 3.38, name: "Lagos" },
  kenya: { lat: -1.29, lng: 36.82, name: "Kenya" },
  nairobi: { lat: -1.29, lng: 36.82, name: "Nairobi" },
  egypt: { lat: 30.04, lng: 31.24, name: "Egypt" },
  cairo: { lat: 30.04, lng: 31.24, name: "Cairo" },
  ethiopia: { lat: 9.01, lng: 38.75, name: "Ethiopia" },
  ghana: { lat: 5.6, lng: -0.19, name: "Ghana" },
  morocco: { lat: 33.97, lng: -6.85, name: "Morocco" },
  tanzania: { lat: -6.79, lng: 39.28, name: "Tanzania" },
  uganda: { lat: 0.35, lng: 32.58, name: "Uganda" },
  rwanda: { lat: -1.94, lng: 29.87, name: "Rwanda" },

  // Oceania
  australia: { lat: -33.87, lng: 151.21, name: "Australia" },
  sydney: { lat: -33.87, lng: 151.21, name: "Sydney" },
  melbourne: { lat: -37.81, lng: 144.96, name: "Melbourne" },
  "new zealand": { lat: -41.29, lng: 174.78, name: "New Zealand" },
  wellington: { lat: -41.29, lng: 174.78, name: "Wellington" },

  // Middle East additional
  iran: { lat: 35.69, lng: 51.39, name: "Iran" },
  iraq: { lat: 33.31, lng: 44.37, name: "Iraq" },
  jordan: { lat: 31.95, lng: 35.93, name: "Jordan" },
  lebanon: { lat: 33.89, lng: 35.5, name: "Lebanon" },
  qatar: { lat: 25.29, lng: 51.53, name: "Qatar" },
  kuwait: { lat: 29.38, lng: 47.99, name: "Kuwait" },

  // Russia and Central Asia
  russia: { lat: 55.76, lng: 37.62, name: "Russia" },
  moscow: { lat: 55.76, lng: 37.62, name: "Moscow" },
  kazakhstan: { lat: 51.17, lng: 71.43, name: "Kazakhstan" },
  uzbekistan: { lat: 41.3, lng: 69.28, name: "Uzbekistan" },

  // Caribbean
  cuba: { lat: 23.11, lng: -82.37, name: "Cuba" },
  jamaica: { lat: 18.0, lng: -76.79, name: "Jamaica" },
  "dominican republic": { lat: 18.49, lng: -69.88, name: "Dominican Republic" },
  "puerto rico": { lat: 18.47, lng: -66.11, name: "Puerto Rico" },
  haiti: { lat: 18.54, lng: -72.34, name: "Haiti" },
};

/**
 * Resolves a location string (from GNews story) to coordinates.
 * Tries exact match first, then partial matching.
 * Returns null if no match found (story goes to overflow panel).
 */
export function resolveCoordinates(
  locationStr: string
): Coordinates | null {
  if (!locationStr) return null;

  const lower = locationStr.toLowerCase().trim();

  // Exact match
  if (COORDS[lower]) return COORDS[lower];

  // Check if any key is contained in the location string
  for (const [key, coords] of Object.entries(COORDS)) {
    if (lower.includes(key)) return coords;
  }

  // Check if the location string is contained in any key
  for (const [key, coords] of Object.entries(COORDS)) {
    if (key.includes(lower)) return coords;
  }

  return null;
}

/**
 * Tries to extract a country or city from GNews article metadata.
 * Looks at source country, title, and description for location clues.
 */
export function extractLocation(article: {
  title: string;
  description: string;
  source?: { name?: string; url?: string };
}): Coordinates | null {
  const searchText =
    `${article.title} ${article.description}`.toLowerCase();

  // Try each known location against the article text
  // Prioritize specific cities over countries
  const cities = Object.entries(COORDS).filter(
    ([key]) =>
      key.length > 3 &&
      !["usa", "uae"].includes(key) &&
      searchText.includes(key)
  );

  if (cities.length > 0) {
    // Return the most specific match (longest key = most specific)
    cities.sort((a, b) => b[0].length - a[0].length);
    return cities[0][1];
  }

  // Fallback: try country-level matches
  const countries = Object.entries(COORDS).filter(([key]) =>
    searchText.includes(key)
  );

  if (countries.length > 0) {
    countries.sort((a, b) => b[0].length - a[0].length);
    return countries[0][1];
  }

  return null;
}

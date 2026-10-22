export type Category = 'Planet' | 'Science' | 'Community' | 'Health';
/**
 * Where a public card came from.
 * - reviewed: approved by a recorded human editorial decision (GoodSignal edition).
 * - publisher_feed: selected automatically from a permitted publisher feed by conservative rules.
 *   Not individually reviewed. Must be labelled "From publisher feeds". When `picked` is true a person chose that story from the feed,
 *   and it is labelled "Picked by PositiviTV · From publisher feeds". It is still not fact-checked and never "Reviewed by PositiviTV".
 * - sample: fictional design fixture, never served by the API.
 */
export type Provenance = 'reviewed' | 'publisher_feed' | 'sample';
/**
 * Visible qualifiers. They exist so uncertainty reaches the reader instead of disappearing in the client.
 * - research_finding: the headline reports a study, discovery or observation, not an outcome in use.
 * - event_date_unconfirmed: only the publication date is known; the event may be older.
 * - country_from_headline: the pin is an approximate country centre taken from the headline wording.
 * - country_from_publisher: the headline names no place, so the pin is the country the publisher reports on (for example Mongabay India).
 * - country_from_publisher_tag: the publisher tags this story with exactly one country, so the pin is that country's centre.
 * - area_from_publisher: the publisher gave map coordinates for this story, checked to sit inside a country it tagged; shown rounded to about 11 km.
 */
export type StoryLabel = 'research_finding' | 'event_date_unconfirmed' | 'country_from_headline' | 'country_from_publisher' | 'country_from_publisher_tag' | 'area_from_feed' | 'area_from_publisher';
export const STORY_LABELS: readonly StoryLabel[] = ['research_finding', 'event_date_unconfirmed', 'country_from_headline', 'country_from_publisher', 'country_from_publisher_tag', 'area_from_feed', 'area_from_publisher'];
export interface Story {
  id: string; version: number; title: string; summary: string | null; category: Category;
  location: string; lat: number | null; lng: number | null;
  locationPrecision: 'city' | 'region' | 'country' | 'unknown';
  publishedAt: string; fetchedAt: string; eventDate: string | null;
  datePrecision: 'day' | 'month' | 'year' | null;
  sourceName: string | null; sourceUrl: string | null;
  image: string | null; imageAlt: string; imageCredit: string | null; imageContext?: string;
  isDemo: boolean; archive: boolean;
  provenance: Provenance; labels: StoryLabel[];
  /** true only for a publisher_feed story that a person at PositiviTV chose individually (policy 0.5.0). Shown as "Picked by PositiviTV". */
  picked?: boolean;
  attribution?: { author: string; licenseName: string; licenseUrl: string };
  mapArea?: import('../lib/map-places.ts').MapArea;
}
export const CATEGORY_COLORS = { All: '#FFE438', Planet: '#4AE18B', Science: '#29D6DA', Community: '#42ACFF', Health: '#A1E6AF' };
export type CategoryFilter = 'All' | Category;
export interface Filters { category: CategoryFilter; query: string; period: '7' | '30' | 'all'; savedOnly: boolean }
export interface PublisherFeedStatus { status: 'ok' | 'stale' | 'unavailable' | 'disabled'; revision: string | null; generatedAt: string | null }
export interface Feed { stories: Story[]; revision: string; updatedAt: string | null; checkedAt: string; publisherFeed?: PublisherFeedStatus }

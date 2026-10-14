export type Category = 'Planet' | 'Science' | 'Community' | 'Health';
/**
 * Where a public card came from.
 * - reviewed: approved by a recorded human editorial decision (GoodSignal edition).
 * - publisher_feed: selected automatically from a permitted publisher feed by conservative rules.
 *   Not individually reviewed. Must be labelled "From publisher feeds".
 * - sample: fictional design fixture, never served by the API.
 */
export type Provenance = 'reviewed' | 'publisher_feed' | 'sample';
/**
 * Visible qualifiers. They exist so uncertainty reaches the reader instead of disappearing in the client.
 * - research_finding: the headline reports a study, discovery or observation, not an outcome in use.
 * - event_date_unconfirmed: only the publication date is known; the event may be older.
 * - country_from_headline: the pin is an approximate country centre taken from the headline wording.
 */
export type StoryLabel = 'research_finding' | 'event_date_unconfirmed' | 'country_from_headline';
export const STORY_LABELS: readonly StoryLabel[] = ['research_finding', 'event_date_unconfirmed', 'country_from_headline'];
export interface Story {
  id: string; version: number; title: string; summary: string | null; category: Category;
  location: string; lat: number | null; lng: number | null;
  locationPrecision: 'city' | 'region' | 'country' | 'unknown';
  publishedAt: string; fetchedAt: string; eventDate: string | null;
  datePrecision: 'day' | 'month' | 'year' | null;
  sourceName: string | null; sourceUrl: string | null;
  image: string | null; imageAlt: string; imageCredit: string | null;
  isDemo: boolean; archive: boolean;
  provenance: Provenance; labels: StoryLabel[];
  attribution?: { author: string; licenseName: string; licenseUrl: string };
}
export const CATEGORY_COLORS = { All: '#FFE438', Planet: '#4AE18B', Science: '#29D6DA', Community: '#42ACFF', Health: '#A1E6AF' };
export type CategoryFilter = 'All' | Category;
export interface Filters { category: CategoryFilter; query: string; period: '7' | '30' | 'all'; savedOnly: boolean }
export interface PublisherFeedStatus { status: 'ok' | 'stale' | 'unavailable' | 'disabled'; revision: string | null; generatedAt: string | null }
export interface Feed { stories: Story[]; revision: string; updatedAt: string | null; checkedAt: string; publisherFeed?: PublisherFeedStatus }

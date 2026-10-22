import type { Story, Filters, StoryLabel } from '../types';
export function filterStories(stories: Story[], filters: Filters, saved: Set<string>, now = Date.now()): Story[] {
  const cutoff = filters.period === 'all' ? -Infinity : now - Number(filters.period) * 86400000;
  const query = filters.query.trim().toLocaleLowerCase();
  return stories.filter(s => (filters.category === 'All' || s.category === filters.category)
    && (!filters.savedOnly || saved.has(s.id)) && Date.parse(s.publishedAt) >= cutoff
    && `${s.title} ${s.location} ${s.category}`.toLocaleLowerCase().includes(query));
}
export function nextStory(items: Story[], current: string | null, random = false, rng = Math.random): Story | null {
  if (!items.length) return null;
  if (!random) return items[(items.findIndex(s => s.id === current) + 1) % items.length];
  const alternatives = items.filter(s => s.id !== current);
  return alternatives.length ? alternatives[Math.min(alternatives.length - 1, Math.floor(Math.max(0, rng()) * alternatives.length))] : items[0];
}
const day = (iso: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
export function dateLabel(s: Story) {
  const published = day(s.publishedAt);
  if (s.isDemo) return `Sample · ${published}`;
  if (s.provenance === 'publisher_feed') return `${s.sourceName} · Published ${published}`;
  return `${s.sourceName} · ${published}${s.archive ? ' · Archive' : ''}`;
}
export function eventLabel(s: Story) {
  if (s.provenance === 'publisher_feed') return 'Event date not confirmed; this is recently published reporting.';
  if (!s.eventDate) return null;
  return `Event: ${s.eventDate}${s.datePrecision === 'day' ? '' : ' (approximate)'}${s.archive ? ' · Archive' : ''}`;
}
/** "Reviewed by PositiviTV" is reserved for real editorial approval. A person's pick from a publisher feed is never called a review (General Counsel, October 21, 2026). */
export function provenanceLabel(s: Story): string {
  if (s.isDemo || s.provenance === 'sample') return 'Design sample';
  if (s.provenance === 'reviewed') return 'Reviewed by PositiviTV™';
  return s.picked ? 'Picked by PositiviTV · From publisher feeds' : 'From publisher feeds';
}
export const PICKED_EXPLANATION = "A person at PositiviTV chose this story from a publisher feed. It isn't fact-checked, and its event date isn't confirmed.";
const LABEL_TEXT: Record<StoryLabel, string | null> = {
  research_finding: 'Research finding, not yet an outcome in use',
  // Shown through eventLabel, so it is not repeated here.
  event_date_unconfirmed: null,
  country_from_headline: 'Pin: approximate country centre from the headline',
  // Worded per General Counsel (2026-10-15); the country name is filled in by qualifierLabels.
  country_from_publisher: 'Approximate pin: placed in {country} because this publisher covers {country}. The headline doesn\'t name a place.',
  area_from_feed: 'Approximate area identified in publisher text; not an exact event site',
  // Worded per General Counsel (2026-10-15). The country name is filled in by qualifierLabels. The area label deliberately names no
  // country: the pin may sit just across a border from the tagged country, so the card must not say which country it is in.
  country_from_publisher_tag: 'Approximate pin: placed in {country} because the publisher tags this story with that country. The headline doesn\'t name a place.',
  area_from_publisher: 'Approximate pin: placed near the location the publisher gives for this story. It may be a nearby town or site, not the exact spot.',
};
export function qualifierLabels(s: Story): string[] {
  const notes = (s.labels ?? []).map(l => LABEL_TEXT[l]?.split('{country}').join(s.location) ?? null).filter((x): x is string => !!x);
  return s.picked && s.provenance === 'publisher_feed' ? [PICKED_EXPLANATION, ...notes] : notes;
}

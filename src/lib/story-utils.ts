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
/** "Reviewed by PositiviTV" is reserved for real editorial approval. */
export function provenanceLabel(s: Story): string {
  if (s.isDemo || s.provenance === 'sample') return 'Design sample';
  return s.provenance === 'reviewed' ? 'Reviewed by PositiviTV' : 'From publisher feeds';
}
const LABEL_TEXT: Record<StoryLabel, string | null> = {
  research_finding: 'Research finding, not yet an outcome in use',
  // Shown through eventLabel, so it is not repeated here.
  event_date_unconfirmed: null,
  country_from_headline: 'Pin: approximate country centre from the headline',
};
export function qualifierLabels(s: Story): string[] {
  return (s.labels ?? []).map(l => LABEL_TEXT[l]).filter((x): x is string => !!x);
}

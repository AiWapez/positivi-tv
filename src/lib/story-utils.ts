import type { Story, Filters } from '../types';
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
export function dateLabel(s: Story) {
  const published = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(s.publishedAt));
  return s.isDemo ? `Sample · ${published}` : `${s.sourceName} · ${published}${s.archive ? ' · Archive' : ''}`;
}
export function eventLabel(s: Story) {
  if (!s.eventDate) return null;
  return `Event: ${s.eventDate}${s.datePrecision === 'day' ? '' : ' (approximate)'}${s.archive ? ' · Archive' : ''}`;
}

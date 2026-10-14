import { composeEdition, publicCard, displayEligible, POLICY_VERSION, canonicalUrl } from '../src/goodsignal/index.ts';
import type { Context, Story as Candidate, SourcePolicy, Topic } from '../src/goodsignal/types.ts';
import type { Publication, PublishedStory } from '../src/lib/publication.ts';
import type { Category } from '../src/types/index.ts';
export type Sources = Record<string, SourcePolicy & { displayName: string }>;
const categories: Partial<Record<Topic, Category>> = {
  climate_energy: 'Planet', animals_nature: 'Planet', health_medicine: 'Health',
  science_space: 'Science', technology: 'Science',
};
/** Only called by an authorized maintainer on their private editorial workspace. */
export function publishEdition(candidates: Candidate[], sources: Sources, previous: Publication, now: string): Publication {
  const context: Context = { now, sources };
  const selected = composeEdition(candidates, context).stories;
  const archive = candidates.filter(s => displayEligible(s, context, 'archive')).slice(0, 100);
  const stories: PublishedStory[] = [], statuses: Publication['statuses'] = Object.create(null);
  for (const [id, status] of Object.entries(previous.statuses)) statuses[id] = { version: status.version, status: 'withdrawn' };
  const urls = new Set<string>(), ids = new Set<string>(), clusters = new Set<string>();
  for (const s of [...selected, ...archive]) {
    const prior = previous.statuses[s.id];
    if (prior && (prior.version > s.version || prior.status === 'withdrawn' && prior.version >= s.version)) continue;
    if (ids.has(s.id) || urls.has(canonicalUrl(s.url)!) || clusters.has(s.clusterId)) continue;
    const source = sources[s.sourceId];
    if (!source?.displayName?.trim()) throw new Error('Source display name is required: ' + s.sourceId);
    const card = publicCard(s, context, s.status === 'archived' ? 'archive' : 'recent');
    const point = ['point','city','country','region'].includes(card.location.kind) && card.location.points.length === 1 ? card.location.points[0] : null;
    ids.add(s.id); urls.add(card.url); clusters.add(s.clusterId);
    const expiresAt = new Date(Date.parse(s.firstRetrievedAt) + source.permissions.retentionDays * 86400000).toISOString();
    stories.push({ id: s.id, version: s.version, title: card.title, summary: card.summary,
      category: categories[s.topics[0]] ?? 'Community', location: point?.name ?? (card.location.kind === 'global' ? 'Worldwide' : 'Location not specified'),
      lat: point?.lat ?? null, lng: point?.lng ?? null,
      locationPrecision: card.location.kind === 'city' ? 'city' : card.location.kind === 'country' ? 'country' : point ? 'region' : 'unknown',
      publishedAt: s.publishedAt, fetchedAt: s.firstRetrievedAt, eventDate: card.eventDate ?? null,
      datePrecision: card.datePrecision ?? null, sourceName: source.displayName, sourceUrl: card.url,
      image: null, imageAlt: '', imageCredit: null, isDemo: false, archive: card.archive, expiresAt, policyVersion: POLICY_VERSION });
    statuses[s.id] = { version: s.version, status: s.status === 'archived' ? 'archived' : 'approved' };
  }
  return { schemaVersion: 1, revision: `edition-${now}`, updatedAt: now, stories, statuses };
}

import type { Story, StoryLabel } from '../types/index.ts';
import { STORY_LABELS } from '../types/index.ts';
import { canonicalUrl, dateBounds } from '../goodsignal/util.ts';
import { POLICY_VERSION } from '../goodsignal/types.ts';
import { validStoryImage } from './story-images.ts';
import { validMapArea } from './map-places.ts';
export interface PublishedStory extends Story {
  expiresAt: string; policyVersion: string;
}
export interface Publication {
  schemaVersion: 1; revision: string; updatedAt: string | null;
  stories: PublishedStory[];
  statuses: Record<string, { version: number; status: 'approved' | 'archived' | 'withdrawn' | 'pending' }>;
}
export type ManifestEntry = { version: number; status: 'approved' | 'archived' | 'withdrawn' | 'pending' | 'listed' };
function validLabels(labels: unknown): labels is StoryLabel[] {
  return Array.isArray(labels) && labels.length <= STORY_LABELS.length && new Set(labels).size === labels.length
    && labels.every(l => (STORY_LABELS as readonly unknown[]).includes(l));
}
/** Labels that explain where a pin came from. A pinned card carries exactly one; an unpinned card carries none. */
const PLACE_LABELS: readonly StoryLabel[] = ['country_from_headline', 'country_from_publisher', 'country_from_publisher_tag', 'area_from_feed', 'area_from_publisher'];
const placeLabels = (s: PublishedStory) => PLACE_LABELS.filter(l => s.labels.includes(l));
function validPlacement(s: PublishedStory): boolean {
  const [label, ...more] = placeLabels(s);
  if (s.locationPrecision === 'unknown') return s.lat === null && s.mapArea === undefined && !label;
  if (!label || more.length || s.lat === null) return false;
  if (s.locationPrecision === 'country') return s.mapArea === undefined && ['country_from_headline', 'country_from_publisher', 'country_from_publisher_tag'].includes(label);
  if (s.locationPrecision === 'region')
    return label === 'area_from_feed' ? validMapArea(s.mapArea, s.lat, s.lng, s.location) : label === 'area_from_publisher' && s.mapArea === undefined;
  return false;
}
function validCommon(s: PublishedStory): boolean {
  return typeof s.id === 'string' && !!s.id.trim() && Number.isInteger(s.version) && s.version > 0
    && typeof s.title === 'string' && !!s.title.trim() && (s.summary === null || typeof s.summary === 'string')
    && ['Planet','Science','Community','Health'].includes(s.category)
    && typeof s.location === 'string' && (s.lat === null || Number.isFinite(s.lat) && Math.abs(s.lat) <= 90)
    && (s.lng === null || Number.isFinite(s.lng) && Math.abs(s.lng) <= 180)
    && ((s.lat === null) === (s.lng === null)) && ['city','region','country','unknown'].includes(s.locationPrecision)
    && (s.locationPrecision !== 'unknown' || s.lat === null) && !(s.lat === 0 && s.lng === 0)
    && typeof s.sourceName === 'string' && !!s.sourceName.trim() && typeof s.sourceUrl === 'string'
    && canonicalUrl(s.sourceUrl) === s.sourceUrl && !(new URL(s.sourceUrl).pathname === '/' && !new URL(s.sourceUrl).search)
    && typeof s.publishedAt === 'string' && Number.isFinite(Date.parse(s.publishedAt))
    && typeof s.fetchedAt === 'string' && Number.isFinite(Date.parse(s.fetchedAt))
    && typeof s.expiresAt === 'string' && Number.isFinite(Date.parse(s.expiresAt))
    && s.isDemo === false && typeof s.archive === 'boolean' && s.policyVersion === POLICY_VERSION
    && validStoryImage(s) && validLabels(s.labels)
    && (s.attribution === undefined || !!s.attribution && typeof s.attribution.author === 'string'
      && !!s.attribution.author.trim() && s.attribution.author.length <= 500
      && typeof s.attribution.licenseName === 'string' && !!s.attribution.licenseName.trim()
      && canonicalUrl(s.attribution.licenseUrl) === s.attribution.licenseUrl);
}
/**
 * Public card contract. Two lanes, never conflated:
 * - reviewed rows need a recorded human approval upstream and a supported event date.
 * - publisher_feed rows were selected automatically. They carry no event date, must say so with a
 *   visible label, may only use a country pin that is labelled as headline-derived or publisher-derived, and never use Health.
 */
export function validPublicStory(value: unknown): value is PublishedStory {
  if (!value || typeof value !== 'object') return false;
  const s = value as PublishedStory;
  if (!validCommon(s)) return false;
  if (s.provenance === 'reviewed')
    return !s.labels.includes('event_date_unconfirmed') && placeLabels(s).length === 0 && s.mapArea === undefined
      && !!dateBounds({ value: s.eventDate!, precision: s.datePrecision!, basis: 'reviewer' });
  if (s.provenance === 'publisher_feed')
    return s.eventDate === null && s.datePrecision === null && s.archive === false && s.category !== 'Health'
      && s.labels.includes('event_date_unconfirmed')
      && validPlacement(s);
  return false;
}
/** A card's provenance must match its manifest status: editorial approval and automatic listing never stand in for each other. */
export function statusMatchesProvenance(story: Pick<Story, 'provenance' | 'archive'>, status: string | undefined): boolean {
  if (story.provenance === 'reviewed') return status === (story.archive ? 'archived' : 'approved');
  if (story.provenance === 'publisher_feed') return status === 'listed';
  return false;
}
/** Trusted server publication only; no article bodies, quotations or private review notes escape. */
export function buildFeed(publication: Publication, now = new Date().toISOString()) {
  if (publication.schemaVersion !== 1 || !Array.isArray(publication.stories) || !publication.statuses
    || typeof publication.revision !== 'string' || !Number.isFinite(Date.parse(now))) throw new Error('Invalid publication');
  const time = Date.parse(now), ids = new Set<string>(), urls = new Set<string>();
  const statuses: Record<string, ManifestEntry> = Object.create(null);
  for (const [id, s] of Object.entries(publication.statuses)) {
    if (!s || !Number.isInteger(s.version) || s.version < 1 || !['approved','archived','withdrawn','pending'].includes(s.status)) throw new Error('Invalid status');
    statuses[id] = { version: s.version, status: 'withdrawn' };
  }
  const stories: Story[] = [];
  for (const row of publication.stories) {
    if (!validPublicStory(row) || row.provenance !== 'reviewed') continue;
    const status = publication.statuses[row.id];
    const event = dateBounds({ value: row.eventDate!, precision: row.datePrecision!, basis: 'reviewer' });
    if (!status || status.version !== row.version || status.status !== (row.archive ? 'archived' : 'approved')
      || time >= Date.parse(row.expiresAt) || Date.parse(row.publishedAt) > time || Date.parse(row.fetchedAt) > time
      || !event || event.start > time || !row.archive && time - event.start > 30 * 86400000
      || ids.has(row.id) || urls.has(row.sourceUrl!)) continue;
    ids.add(row.id); urls.add(row.sourceUrl!); statuses[row.id] = { ...status };
    const { expiresAt: _expiry, policyVersion: _policy, ...card } = row;
    stories.push(card);
  }
  return { stories, revision: publication.revision, updatedAt: publication.updatedAt, checkedAt: now,
    manifest: { version: publication.revision, generatedAt: now, stories: statuses }, nextCursor: null };
}

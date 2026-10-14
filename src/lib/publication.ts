import type { Story } from '../types/index.ts';
import { canonicalUrl, dateBounds } from '../goodsignal/util.ts';
import { POLICY_VERSION } from '../goodsignal/types.ts';
export interface PublishedStory extends Story {
  expiresAt: string; policyVersion: string;
}
export interface Publication {
  schemaVersion: 1; revision: string; updatedAt: string | null;
  stories: PublishedStory[];
  statuses: Record<string, { version: number; status: 'approved' | 'archived' | 'withdrawn' | 'pending' }>;
}
export function validPublicStory(value: unknown): value is PublishedStory {
  if (!value || typeof value !== 'object') return false;
  const s = value as PublishedStory;
  return typeof s.id === 'string' && !!s.id.trim() && Number.isInteger(s.version) && s.version > 0
    && typeof s.title === 'string' && !!s.title.trim() && (s.summary === null || typeof s.summary === 'string')
    && ['Planet','Science','Community','Health'].includes(s.category)
    && typeof s.location === 'string' && (s.lat === null || Number.isFinite(s.lat) && Math.abs(s.lat) <= 90)
    && (s.lng === null || Number.isFinite(s.lng) && Math.abs(s.lng) <= 180)
    && ((s.lat === null) === (s.lng === null)) && ['city','region','country','unknown'].includes(s.locationPrecision)
    && typeof s.sourceName === 'string' && !!s.sourceName.trim() && typeof s.sourceUrl === 'string'
    && canonicalUrl(s.sourceUrl) === s.sourceUrl && !(new URL(s.sourceUrl).pathname === '/' && !new URL(s.sourceUrl).search)
    && typeof s.publishedAt === 'string' && Number.isFinite(Date.parse(s.publishedAt))
    && typeof s.fetchedAt === 'string' && Number.isFinite(Date.parse(s.fetchedAt))
    && typeof s.expiresAt === 'string' && Number.isFinite(Date.parse(s.expiresAt))
    && !!dateBounds({ value: s.eventDate!, precision: s.datePrecision!, basis: 'reviewer' })
    && s.isDemo === false && typeof s.archive === 'boolean' && s.policyVersion === POLICY_VERSION
    && s.image === null && typeof s.imageAlt === 'string' && s.imageCredit === null;
}
/** Trusted server publication only; no article bodies, quotations or private review notes escape. */
export function buildFeed(publication: Publication, now = new Date().toISOString()) {
  if (publication.schemaVersion !== 1 || !Array.isArray(publication.stories) || !publication.statuses
    || typeof publication.revision !== 'string' || !Number.isFinite(Date.parse(now))) throw new Error('Invalid publication');
  const time = Date.parse(now), ids = new Set<string>(), urls = new Set<string>();
  const statuses: Publication['statuses'] = Object.create(null);
  for (const [id, s] of Object.entries(publication.statuses)) {
    if (!s || !Number.isInteger(s.version) || s.version < 1 || !['approved','archived','withdrawn','pending'].includes(s.status)) throw new Error('Invalid status');
    statuses[id] = { version: s.version, status: 'withdrawn' };
  }
  const stories: Story[] = [];
  for (const row of publication.stories) {
    if (!validPublicStory(row)) continue;
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

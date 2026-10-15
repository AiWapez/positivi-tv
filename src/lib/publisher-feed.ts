import { photoFields, photoForStory } from './story-images.ts';
import type { Category, PublisherFeedStatus, Story, StoryLabel } from '../types/index.ts';
import { canonicalUrl } from '../goodsignal/util.ts';
import { POLICY_VERSION } from '../goodsignal/types.ts';
import { buildFeed, validPublicStory } from './publication.ts';
import type { ManifestEntry, Publication, PublishedStory } from './publication.ts';

/** Version of the automatic screening rules. A snapshot made under another version is not served. */
export const PUBLISHER_FEED_POLICY = 'publisher-feed-0.4.1';

/** Per-source permission record. Every field is maintained by hand from the publisher's own terms. */
export interface PublisherFeedPermission {
  enabled: boolean;
  category: Category | 'auto';
  /** true only where the terms allow reproducing and shortening the feed description (public-domain text). */
  summary: boolean;
  retentionDays: number;
  licenseOrTerms: string; policyUrl: string; checkedAt: string;
  permittedFields: string[]; attribution: string; exceptions: string; notes?: string;
  /** The one country this publisher reports on. Used for a pin only when the headline names no place, and always labelled. */
  defaultCountry?: string;
  requiresAuthor?: boolean;
  license?: { name: string; url: string };
  blockedCredits?: string[];
}
export interface PublisherSource {
  id: string; displayName: string; domains: string[]; enabled: boolean;
  publisherFeed?: PublisherFeedPermission;
}
export type PublisherSources = Record<string, PublisherSource>;
export interface Withdrawal { id?: string; url?: string; reason: string; at: string }
export interface PublisherFeedControl {
  /** Global switch. false = the lane is neither collected nor served. */
  enabled: boolean;
  windowDays: number; maxItems: number; maxPerSource: number; staleAfterHours: number;
  locationResolver: 'headline_country' | 'supported_feed' | 'off';
  withdrawn: Withdrawal[];
}
export interface PublisherItem {
  id: string; version: number; sourceId: string; url: string; title: string; summary: string | null;
  category: Category; publishedAt: string; fetchedAt: string; lastSeenAt: string;
  labels: StoryLabel[]; location: string; lat: number | null; lng: number | null;
  locationPrecision: 'region' | 'country' | 'unknown';
  author?: string | null;
  mapArea?: import('./map-places.ts').MapArea;
}
export interface SourceRun {
  status: 'ok' | 'failed' | 'disabled'; checkedAt: string; lastSuccessAt: string | null;
  parsed: number; listed: number; carried: number; excluded: Record<string, number>; code?: string;
}
/** shown=false means the second item was hidden from the public list; shown=true is a proposal for maintainer review only. */
export interface DuplicateProposal { kept: string; suppressed: string; similarity: number; basis: 'same_url' | 'headline_similarity'; shown: boolean }
export interface PublisherSnapshot {
  schemaVersion: 1; kind: 'publisher_feed'; policy: string; revision: string; generatedAt: string;
  items: PublisherItem[]; sources: Record<string, SourceRun>; duplicates: DuplicateProposal[];
}

export function validSnapshot(value: unknown): value is PublisherSnapshot {
  const s = value as PublisherSnapshot;
  return !!s && typeof s === 'object' && s.schemaVersion === 1 && s.kind === 'publisher_feed'
    && typeof s.revision === 'string' && !!s.revision && Number.isFinite(Date.parse(s.generatedAt))
    && Array.isArray(s.items) && !!s.sources && typeof s.sources === 'object' && Array.isArray(s.duplicates);
}

function withdrawnMatch(control: PublisherFeedControl, item: { id: string; url: string }): boolean {
  return control.withdrawn.some(w => (!!w.id && w.id === item.id) || (!!w.url && canonicalUrl(w.url) === item.url));
}

/** Shape check for one stored row before any field is used. A bad row is skipped, never fatal. */
function wellFormed(item: unknown): item is PublisherItem {
  const i = item as PublisherItem;
  return !!i && typeof i === 'object' && typeof i.id === 'string' && !!i.id && Number.isInteger(i.version) && i.version >= 1
    && typeof i.sourceId === 'string' && typeof i.url === 'string' && typeof i.title === 'string' && (i.summary === null || typeof i.summary === 'string')
    && typeof i.category === 'string' && typeof i.publishedAt === 'string' && typeof i.fetchedAt === 'string' && Array.isArray(i.labels)
    && i.labels.every(l => typeof l === 'string') && typeof i.location === 'string' && (i.lat === null || typeof i.lat === 'number')
    && (i.lng === null || typeof i.lng === 'number') && typeof i.locationPrecision === 'string';
}

/**
 * Projects the stored snapshot into public cards at request time. Withdrawals, switches, retention,
 * the freshness window and the domain allowlist are rechecked here, so a stale snapshot cannot
 * override a later configuration change. `reserved` holds every id the reviewed edition has ever given a
 * status to, plus its served URLs: the editorial decision always wins, including a withdrawal.
 */
export function projectPublisherFeed(snapshot: PublisherSnapshot | null, control: PublisherFeedControl, sources: PublisherSources,
  now: string, reserved: { ids: Set<string>; urls: Set<string> } = { ids: new Set(), urls: new Set() }, options: { subjectPhotos?: boolean } = {}) {
  const statuses: Record<string, ManifestEntry> = Object.create(null);
  const stories: Story[] = [];
  const time = Date.parse(now);
  if (!control.enabled || !snapshot || !validSnapshot(snapshot) || snapshot.policy !== PUBLISHER_FEED_POLICY || !Number.isFinite(time)) return { stories, statuses };
  const perSource = new Map<string, number>(), ids = new Set<string>(), urls = new Set<string>();
  for (const item of snapshot.items) {
    try {
      if (!wellFormed(item) || reserved.ids.has(item.id) || ids.has(item.id)) continue;
      const source = Object.prototype.hasOwnProperty.call(sources, item.sourceId) ? sources[item.sourceId] : undefined;
      const permission = source?.publisherFeed;
      const url = canonicalUrl(item.url);
      if (withdrawnMatch(control, { id: item.id, url: url ?? item.url })) { statuses[item.id] = { version: item.version, status: 'withdrawn' }; continue; }
      if (!source || !source.enabled || !permission?.enabled || !url || url !== item.url || !source.domains.includes(new URL(url).hostname)) continue;
      const author = typeof item.author === 'string' ? item.author.trim() : '';
      if (permission.requiresAuthor && (!author || author.length > 500 || !permission.license || !canonicalUrl(permission.license.url))) continue;
      if (permission.blockedCredits?.some(credit => author.toLowerCase().includes(credit.toLowerCase()))) continue;
      if (reserved.urls.has(url) || urls.has(url)) continue;
      const published = Date.parse(item.publishedAt), fetched = Date.parse(item.fetchedAt);
      if (!Number.isFinite(published) || !Number.isFinite(fetched) || published > time || fetched > time
        || time - published > control.windowDays * 86400000) continue;
      const expiresAt = new Date(fetched + permission.retentionDays * 86400000).toISOString();
      if (time >= Date.parse(expiresAt)) continue;
      const count = perSource.get(item.sourceId) ?? 0;
      if (count >= control.maxPerSource || stories.length >= control.maxItems) continue;
      const row: PublishedStory = {
        id: item.id, version: item.version, title: item.title, summary: permission.summary ? item.summary : null,
        category: item.category, location: item.location, lat: item.lat, lng: item.lng, locationPrecision: item.locationPrecision,
        publishedAt: item.publishedAt, fetchedAt: item.fetchedAt, eventDate: null, datePrecision: null,
        sourceName: source.displayName, sourceUrl: url, image: null, imageAlt: '', imageCredit: null,
        isDemo: false, archive: false, provenance: 'publisher_feed', labels: [...item.labels],
        expiresAt, policyVersion: POLICY_VERSION,
        ...(permission.license && author ? { attribution: { author, licenseName: permission.license.name, licenseUrl: permission.license.url } } : {}),
        ...(item.mapArea ? { mapArea: { ...item.mapArea } } : {}),
      };
      if (control.locationResolver === 'off') {
        Object.assign(row, { location: 'Location not specified', lat: null, lng: null, locationPrecision: 'unknown', labels: row.labels.filter(l => l !== 'country_from_headline' && l !== 'country_from_publisher' && l !== 'area_from_feed') }); delete row.mapArea;
      }
      Object.assign(row, photoFields(photoForStory(row, options.subjectPhotos ?? false)));
      if (!validPublicStory(row)) continue;
      perSource.set(item.sourceId, count + 1); ids.add(row.id); urls.add(url);
      statuses[row.id] = { version: row.version, status: 'listed' };
      const { expiresAt: _e, policyVersion: _p, ...card } = row;
      stories.push(card);
    } catch { /* One malformed stored row never takes down the feed. */ }
  }
  return { stories, statuses };
}

export type SnapshotRead = { snapshot: PublisherSnapshot | null; status: 'ok' | 'unavailable' };

/**
 * Edition first, then automatic publisher-feed cards. Any id the edition has a status for, and any URL it
 * serves, is reserved for the edition. If the lane fails for any reason the edition is still served.
 */
export function buildCombinedFeed(edition: Publication, read: SnapshotRead, control: PublisherFeedControl, sources: PublisherSources, now = new Date().toISOString(), options: { subjectPhotos?: boolean } = {}) {
  const base = buildFeed(edition, now);
  const reserved = { ids: new Set(Object.keys(edition.statuses)), urls: new Set(base.stories.map(s => s.sourceUrl!)) };
  for (const s of base.stories) reserved.ids.add(s.id);
  let lane: ReturnType<typeof projectPublisherFeed> = { stories: [], statuses: Object.create(null) }, laneFailed = false;
  try { lane = projectPublisherFeed(read.snapshot, control, sources, now, reserved, options); } catch { laneFailed = true; }
  const statuses: Record<string, ManifestEntry> = Object.assign(Object.create(null), lane.statuses);
  for (const [id, entry] of Object.entries(base.manifest.stories)) statuses[id] = entry;
  const snapshot = !laneFailed && control.enabled && read.snapshot && validSnapshot(read.snapshot) && read.snapshot.policy === PUBLISHER_FEED_POLICY ? read.snapshot : null;
  const publisherFeed: PublisherFeedStatus = !control.enabled ? { status: 'disabled', revision: null, generatedAt: null }
    : !snapshot ? { status: 'unavailable', revision: null, generatedAt: null }
    : { status: Date.parse(now) - Date.parse(snapshot.generatedAt) > control.staleAfterHours * 3600000 ? 'stale' : 'ok', revision: snapshot.revision, generatedAt: snapshot.generatedAt };
  const revision = `${base.revision}+${snapshot?.revision ?? 'none'}`;
  return { ...base, stories: [...base.stories, ...lane.stories], revision,
    manifest: { version: revision, generatedAt: now, stories: statuses }, publisherFeed };
}

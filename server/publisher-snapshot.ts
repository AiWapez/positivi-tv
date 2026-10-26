import { createHash } from 'node:crypto';
import { listingFields, screenHeadline } from './publisher-screen.ts';
import { countryByName, countryFromHeadline } from './publisher-location.ts';
import { locateFeedOutcome } from './feed-location.ts';
import { combinePlaces, resolvePublisherPlace } from './publisher-place.ts';
import type { PlaceTags } from './publisher-place.ts';
import { canonicalUrl } from '../src/goodsignal/util.ts';
import { PICK_OVERRIDABLE_REASONS, PUBLISHER_FEED_POLICY, STREAK_LIMIT, pickFor, isLabelOnly, storedStreak } from '../src/lib/publisher-feed.ts';
import type { DuplicateProposal, PublisherFeedControl, PublisherItem, PublisherSnapshot, PublisherSources, SourceRun } from '../src/lib/publisher-feed.ts';

/** The subset of a collector candidate (server/collect.mjs parseFeed) this lane uses. */
export interface FeedCandidate { id: string; sourceId: string; url: string; title: string; body: string; publishedAt: string; firstRetrievedAt: string;
  dateSource?: 'published' | 'updated'; titleTruncated?: boolean; author?: string | null; rights?: string;
  /** Location tags and map coordinates from the publisher's metadata (server/publisher-place-tags.mjs). Used only when the source's switch is on. */
  placeTags?: PlaceTags }
export type SourceResult = { sourceId: string; ok: true; candidates: FeedCandidate[]; code?: string } | { sourceId: string; ok: false; code: string };
/**
 * What the headline rules decided for one candidate that reached them (it passed the link, date, window, author and rights
 * checks first). `summary` is the shortened description the lane already stores, and only for sources whose terms allow storing
 * one; it is null for every other source, so no description from Mongabay or Global Voices ever appears here.
 */
export interface ScreenedRecord { id: string; source: string; url: string; title: string; published: string; summary: string | null;
  decision: 'list' | 'exclude'; reasons: string[]; labels: string[]; category: string | null }

const DAY = 86400000;
const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'after', 'over', 'that', 'this', 'its', 'are', 'was', 'were', 'has',
  'have', 'new', 'how', 'why', 'what', 'who', 'their', 'they', 'his', 'her', 'our', 'out', 'more', 'than', 'about', 'first']);
export function headlineTokens(title: string): Set<string> {
  return new Set(title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w)));
}
export function headlineSimilarity(a: string, b: string): number {
  const x = headlineTokens(a), y = headlineTokens(b);
  if (!x.size || !y.size) return 0;
  let shared = 0; for (const w of x) if (y.has(w)) shared++;
  return shared / (x.size + y.size - shared);
}
/**
 * Public-domain sources only. Plain text, whole sentences, at most 280 characters. A sentence is never
 * cut mid-way; if the first sentence is too long the summary is omitted.
 */
export function shortSummary(text: string): string | null {
  const clean = text.replace(/The post .{1,300}? appeared first on .{1,200}?\.?$/i, '').replace(/\s*(?:\[(?:…|\.\.\.)\]|…|\.\.\.|Read more\.?|Continue reading\.?)\s*$/i, '').replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [];
  let out = '';
  for (const s of sentences) { const next = (out + ' ' + s.trim()).trim(); if (next.length > 280) break; out = next; }
  return out.length >= 40 ? out : null;
}
const sameContent = (a: PublisherItem, b: PublisherItem) => a.title === b.title && a.summary === b.summary && a.category === b.category && !!a.picked === !!b.picked
  && a.location === b.location && a.lat === b.lat && a.lng === b.lng && a.labels.join() === b.labels.join()
  && a.author === b.author && a.publishedAt === b.publishedAt && JSON.stringify(a.mapArea) === JSON.stringify(b.mapArea);

/**
 * Builds the next bounded snapshot. Pure: no network, storage or clock access.
 * - A failed source keeps its previous still-eligible items (carried), so one outage does not empty the lane.
 * - A successful source also keeps previous items that rolled off its feed but are still inside the window.
 *   An item still present in the feed is never carried: if its new version is excluded, the old card goes.
 * - Retention is applied when storing, not only when serving.
 * - Exact URL repeats are merged. Near-identical headlines (similarity >= 0.85) from different sources with the
 *   same resolved location are shown once; lower similarity (>= 0.6) only records a proposal and both stay
 *   visible. No copy adds a count, evidence level or corroboration claim.
 */
export function buildSnapshot(previous: PublisherSnapshot | null, results: SourceResult[], sources: PublisherSources,
  control: PublisherFeedControl, now: string, order: string[] = Object.keys(sources), onScreened?: (record: ScreenedRecord, teachingBody: string) => void): PublisherSnapshot {
  const time = Date.parse(now);
  if (!Number.isFinite(time)) throw new TypeError('Invalid now');
  const usable = previous && previous.policy === PUBLISHER_FEED_POLICY && Array.isArray(previous.items) ? previous : null;
  const prevById = new Map((usable?.items ?? []).map(i => [i.id, i]));
  const inWindow = (publishedAt: string) => { const t = Date.parse(publishedAt); return Number.isFinite(t) && t <= time && time - t <= control.windowDays * DAY; };
  const retained = (fetchedAt: string, days: number) => { const t = Date.parse(fetchedAt); return Number.isFinite(t) && time < t + days * DAY; };
  const runs: Record<string, SourceRun> = {};
  const pool: PublisherItem[] = [];
  for (const sourceId of order) {
    const source = sources[sourceId], permission = source?.publisherFeed;
    const result = results.find(r => r.sourceId === sourceId);
    const lastSuccess = usable?.sources?.[sourceId]?.lastSuccessAt ?? null;
    if (!source || !source.enabled || !permission?.enabled) {
      if (source) runs[sourceId] = { status: 'disabled', checkedAt: now, lastSuccessAt: lastSuccess, parsed: 0, listed: 0, carried: 0, excluded: {}, quietRuns: 0, unreachedRuns: 0 };
      continue;
    }
    if (!result) continue;
    const run: SourceRun = { status: result.ok ? 'ok' : 'failed', checkedAt: now, lastSuccessAt: result.ok ? now : lastSuccess,
      parsed: 0, listed: 0, carried: 0, excluded: {}, ...(result.code ? { code: String(result.code).slice(0, 120) } : {}) };
    const seen = new Set<string>();
    if (result.ok) {
      for (const c of result.candidates) {
        run.parsed++; seen.add(c.id);
        const url = canonicalUrl(c.url);
        const count = (reason: string) => { run.excluded[reason] = (run.excluded[reason] ?? 0) + 1; };
        if (!url || url !== c.url || !source.domains.includes(new URL(url).hostname)) { count('LINK_NOT_ALLOWED'); continue; }
        if (!Number.isFinite(Date.parse(c.publishedAt))) { count('INVALID_DATE'); continue; }
        if (c.dateSource === 'updated') { count('NO_PUBLICATION_DATE'); continue; }
        if (c.titleTruncated) { count('TITLE_TOO_LONG'); continue; }
        if (!inWindow(c.publishedAt)) { count('OUTSIDE_WINDOW'); continue; }
        const author = typeof c.author === 'string' ? c.author.trim() : '';
        if (permission.requiresAuthor && (!author || author.length > 500 || !permission.license || !canonicalUrl(permission.license.url))) { count('AUTHOR_ATTRIBUTION_REQUIRED'); continue; }
        if (permission.blockedCredits?.some(credit => `${author} ${c.rights ?? ''} ${c.body ?? ''}`.toLowerCase().includes(credit.toLowerCase()))) { count('THIRD_PARTY_CREDIT'); continue; }
        if (/all rights reserved|permission required|not for republication/i.test(c.rights ?? '')) { count('ITEM_RIGHTS_RESTRICTED'); continue; }
        const screen = screenHeadline({ title: c.title, description: c.body ?? '', defaultCategory: permission.category, now });
        // Observation only. A failing observer can never change what is listed.
        try {
          onScreened?.({ id: c.id, source: sourceId, url, title: c.title, published: new Date(Date.parse(c.publishedAt)).toISOString(),
            summary: permission.summary ? shortSummary(c.body ?? '') : null, decision: screen.decision, reasons: [...screen.reasons],
            labels: [...screen.labels], category: screen.category },
            // The raw description goes only to the private teaching batch, and only for a source whose terms record allows it.
            permission.teachingDescription === true ? (c.body ?? '') : '');
        } catch { /* ignored */ }
        // Label-only mode: the story has now gone to the private teaching batch. It is counted on its own line and never enters the snapshot,
        // so it cannot be listed whatever the decision, and a pick for it is never looked at.
        if (isLabelOnly(permission)) { run.labelOnly = (run.labelOnly ?? 0) + 1; continue; }
        // A person's pick (policy 0.5.0, General Counsel ruling of October 21, 2026) can lift only the two mild reasons. Any other reason is
        // a hard ban and the story stays out. Everything checked above (link, date, window, author, credits, rights) has already passed.
        const picked = screen.decision === 'exclude' && !!pickFor(control, c.id) && screen.reasons.length > 0 && screen.reasons.every(r => PICK_OVERRIDABLE_REASONS.includes(r));
        if (screen.decision === 'exclude' && !picked) { for (const r of screen.reasons) count(r); continue; }
        const fields = picked ? listingFields({ title: c.title, description: c.body ?? '', defaultCategory: permission.category, now }) : { labels: screen.labels, category: screen.category! };
        const headlinePlace = control.locationResolver === 'supported_feed' ? locateFeedOutcome(c.title, c.body ?? '')
          : control.locationResolver === 'headline_country' ? (() => { const p = countryFromHeadline(c.title); return p ? { ...p, precision: 'country' as const } : null; })() : null;
        // A publisher with one home country (Mongabay India) gets that country's pin when the headline names no place, with its own label.
        const homeAllowed = !headlinePlace && control.locationResolver !== 'off' && permission.defaultCountry;
        // Off by default. Only a source whose terms record has placeFromPublisherTags: true may use the publisher's own location tags and coordinates.
        const tagPlace = permission.placeFromPublisherTags === true && control.locationResolver !== 'off' ? resolvePublisherPlace(c.placeTags) : null;
        const combined = combinePlaces(headlinePlace, tagPlace);
        const chosen = combined.place;
        const home = homeAllowed && !chosen && !combined.conflict ? countryByName(permission.defaultCountry!) : null;
        const place = chosen ?? (home ? { ...home, precision: 'country' as const } : null);
        const placeLabel = chosen && 'label' in chosen ? chosen.label : chosen ? (chosen.precision === 'region' ? 'area_from_feed' : 'country_from_headline') : 'country_from_publisher';
        const draft: PublisherItem = {
          id: c.id, version: 1, sourceId, url, title: c.title, summary: permission.summary ? shortSummary(c.body ?? '') : null,
          category: fields.category, publishedAt: new Date(Date.parse(c.publishedAt)).toISOString(), fetchedAt: now, lastSeenAt: now,
          labels: place ? [...fields.labels, placeLabel] : fields.labels,
          location: place?.name ?? 'Location not specified', lat: place?.lat ?? null, lng: place?.lng ?? null,
          locationPrecision: place?.precision ?? 'unknown',
          ...(place && 'mapArea' in place && place.mapArea ? { mapArea: place.mapArea } : {}),
          ...(author ? { author } : {}),
          ...(picked ? { picked: true } : {}),
        };
        const prior = prevById.get(c.id);
        if (prior) Object.assign(draft, { fetchedAt: prior.fetchedAt, version: sameContent(prior, draft) ? prior.version : prior.version + 1 });
        if (!retained(draft.fetchedAt, permission.retentionDays)) { count('RETENTION_ENDED'); continue; }
        pool.push(draft); run.listed++;
      }
    }
    for (const prior of usable?.items ?? []) {
      if (isLabelOnly(permission)) continue;
      if (prior.sourceId !== sourceId || seen.has(prior.id) || !inWindow(prior.publishedAt) || !retained(prior.fetchedAt, permission.retentionDays)) continue;
      if (!source.domains.includes(new URL(prior.url).hostname)) continue;
      pool.push({ ...prior }); run.carried++;
    }
    // Observation only (Security Lead, October 26, 2026): these two counts are never read by any listing, carrying or pick decision.
    const priorRun = usable?.sources?.[sourceId];
    run.quietRuns = result.ok && run.parsed === 0 ? Math.min(storedStreak(priorRun?.quietRuns) + 1, STREAK_LIMIT) : 0;
    run.unreachedRuns = !result.ok ? Math.min(storedStreak(priorRun?.unreachedRuns) + 1, STREAK_LIMIT) : 0;
    runs[sourceId] = run;
  }
  // Exact URL and headline-similarity proposals. Earliest publication is kept as the likely original.
  const rank = (i: PublisherItem) => order.indexOf(i.sourceId);
  pool.sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt) || rank(a) - rank(b) || a.id.localeCompare(b.id));
  const kept: PublisherItem[] = [], duplicates: DuplicateProposal[] = [], urls = new Set<string>(), ids = new Set<string>();
  for (const item of pool) {
    if (ids.has(item.id)) continue;
    const sameUrl = kept.find(k => k.url === item.url);
    if (sameUrl || urls.has(item.url)) { duplicates.push({ kept: sameUrl?.id ?? '', suppressed: item.id, similarity: 1, basis: 'same_url', shown: false }); continue; }
    let hidden = false;
    for (const k of kept) {
      if (Math.abs(Date.parse(k.publishedAt) - Date.parse(item.publishedAt)) > 3 * DAY) continue;
      const similarity = Math.round(headlineSimilarity(k.title, item.title) * 100) / 100;
      if (similarity < 0.6) continue;
      // Only hide when both copies resolved to the same country; two unlocated stories may be in different towns.
      const hide = similarity >= 0.85 && k.sourceId !== item.sourceId && k.lat !== null && item.lat !== null && k.location === item.location;
      duplicates.push({ kept: k.id, suppressed: item.id, similarity, basis: 'headline_similarity', shown: !hide });
      if (hide) { hidden = true; break; }
    }
    if (hidden) continue;
    kept.push(item); urls.add(item.url); ids.add(item.id);
  }
  kept.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || rank(a) - rank(b) || a.id.localeCompare(b.id));
  const perSource = new Map<string, number>(), items: PublisherItem[] = [];
  for (const item of kept) {
    const n = perSource.get(item.sourceId) ?? 0;
    if (n >= control.maxPerSource || items.length >= control.maxItems) continue;
    perSource.set(item.sourceId, n + 1); items.push(item);
  }
  const digest = createHash('sha256').update(JSON.stringify(items.map(i => [i.id, i.version]))).digest('hex').slice(0, 12);
  return { schemaVersion: 1, kind: 'publisher_feed', policy: PUBLISHER_FEED_POLICY, revision: `pf-${now.replace(/[^0-9]/g, '').slice(0, 14)}-${digest}`,
    generatedAt: now, items, sources: runs, duplicates: duplicates.slice(0, 200) };
}

/** Serialized size ceiling, so a hostile or broken feed cannot grow storage or read costs without bound. */
export const SNAPSHOT_MAX_BYTES = 512 * 1024;
export function serializeSnapshot(snapshot: PublisherSnapshot): string {
  if (snapshot.schemaVersion !== 1 || snapshot.kind !== 'publisher_feed' || snapshot.items.length > 500) throw new Error('Invalid snapshot');
  const text = JSON.stringify(snapshot);
  if (Buffer.byteLength(text) > SNAPSHOT_MAX_BYTES) throw new Error('Oversized snapshot');
  return text;
}

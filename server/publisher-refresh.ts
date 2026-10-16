import { collectPublisherFeed } from './publisher-collect.mjs';
import { fetchPermittedFeed } from './collect.mjs';
import { buildSnapshot } from './publisher-snapshot.ts';
import type { FeedCandidate, ScreenedRecord, SourceResult } from './publisher-snapshot.ts';
import { conflictError } from './publisher-store.ts';
import type { PublisherStore } from './publisher-store.ts';
import type { PublisherFeedControl, PublisherSources } from '../src/lib/publisher-feed.ts';

export interface FeedConfig { id: string; url: string; allowedDomains: string[]; topic: string; fetchPolicyRef: string; lanes: string[]; maxBytes?: number; format?: 'wordpress'; supplementalUrl?: string; supplementalBylineUrl?: string }
export interface RefreshDeps {
  feeds: FeedConfig[]; sources: PublisherSources; control: PublisherFeedControl; store: PublisherStore;
  /** Defaults to the hardened safeFetch inside fetchPermittedFeed. Injected only by tests. */
  fetcher?: Parameters<typeof fetchPermittedFeed>[1];
  now?: () => string;
  pause?: (ms: number) => Promise<void>;
  /** Where screening-sample lines go. Defaults to console.log (the private run log). Injected only by tests. */
  log?: (line: string) => void;
}
export type RefreshOutcome =
  | { code: 200; body: { revision: string; listed: number; sources: Record<string, { status: string; listed: number; carried: number }> } }
  | { code: 200; body: { skipped: 'disabled'; cleanup?: 'failed' } }
  | { code: 409; body: { error: string } }
  | { code: 502; body: { error: string; sources: Record<string, string> } };

/** Minimum gap between two feed requests to the same publisher host in one run (matches the 10-second robots.txt crawl delays we honor). */
export const HOST_SPACING_MS = 10_000;

/** Prefix and chunk size of the private run-log lines written while the screening sample is on. */
export const SCREENING_LOG_PREFIX = 'screening-sample';
export const SCREENING_LOG_CHUNK = 5;

/** True only while `control.screeningLogUntil` (UTC date, midnight) is still in the future. Missing or malformed means off. */
export function screeningLogActive(control: PublisherFeedControl, now: string): boolean {
  const until = control.screeningLogUntil;
  if (typeof until !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(until)) return false;
  const end = Date.parse(until + 'T00:00:00Z'), time = Date.parse(now);
  return Number.isFinite(end) && Number.isFinite(time) && time < end;
}

/** Small chunks, so one run log line stays short and no single line carries the whole sample. */
export function screeningLogLines(records: ScreenedRecord[], now: string): string[] {
  const parts = Math.ceil(records.length / SCREENING_LOG_CHUNK), lines: string[] = [];
  for (let i = 0; i < records.length; i += SCREENING_LOG_CHUNK) {
    lines.push(`${SCREENING_LOG_PREFIX} ${JSON.stringify({ run: now, part: i / SCREENING_LOG_CHUNK + 1, of: parts, total: records.length, records: records.slice(i, i + SCREENING_LOG_CHUNK) })}`);
  }
  return lines;
}

/** Bounded parallelism so a slow publisher cannot hold every slot. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

/**
 * The only code path that contacts publishers for this lane. Runs from the authenticated scheduled job.
 * Overlapping runs: a run lock plus an ETag precondition on the snapshot write; the loser changes nothing.
 * Failure: if every enabled source fails, the previous snapshot is left untouched.
 */
export async function runPublisherRefresh(deps: RefreshDeps): Promise<RefreshOutcome> {
  const { control, sources, store } = deps;
  if (!control.enabled) {
    // Best effort: stored headlines should not outlive the decision to switch the lane off.
    try { await deps.store.deleteCurrent(); return { code: 200, body: { skipped: 'disabled' } }; }
    catch { return { code: 200, body: { skipped: 'disabled', cleanup: 'failed' } }; }
  }
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const feeds = deps.feeds.filter(f => f.lanes.includes('publisher_feed') && sources[f.id]?.enabled && sources[f.id]?.publisherFeed?.enabled);
  if (!feeds.length) return { code: 502, body: { error: 'No enabled publisher-feed sources.', sources: {} } };
  const token = await store.acquireLock(Date.parse(now));
  if (!token) return { code: 409, body: { error: 'A refresh is already running.' } };
  try {
    // An unreadable or invalid stored object is treated as "no previous snapshot" but its ETag is kept,
    // so this run replaces it with a compare-and-swap instead of failing on every run.
    const previous = await store.readCurrent(true);
    const collectOne = async (feed: FeedConfig): Promise<SourceResult> => {
      try {
        const result = await collectPublisherFeed(feed, now, deps.fetcher, deps.pause);
        return { sourceId: feed.id, ok: true as const, candidates: result.candidates as FeedCandidate[], ...(result.warning ? { code: result.warning } : {}) };
      } catch (error) {
        const e = error as { code?: unknown; message?: unknown };
        return { sourceId: feed.id, ok: false as const, code: String(e?.code ?? e?.message ?? 'FAILED').slice(0, 120) };
      }
    };
    // Feeds on the same publisher host run one after another with a pause between them, so several feeds from one
    // site (Global Voices, Mongabay) never hit it at once and its robots.txt crawl delay is respected. Different hosts
    // still run in parallel, at most three at a time.
    const byHost = new Map<string, FeedConfig[]>();
    for (const feed of feeds) { const host = new URL(feed.url).hostname; byHost.set(host, [...(byHost.get(host) ?? []), feed]); }
    const wait = deps.pause ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
    const byId = new Map<string, SourceResult>();
    await mapLimit([...byHost.values()], 3, async group => {
      for (const [i, feed] of group.entries()) {
        if (i > 0) await wait(HOST_SPACING_MS);
        byId.set(feed.id, await collectOne(feed));
      }
    });
    const results: SourceResult[] = feeds.map(f => byId.get(f.id)!);
    if (results.every(r => !r.ok)) {
      return { code: 502, body: { error: 'Every source failed; the previous snapshot was kept.',
        sources: Object.fromEntries(results.map(r => [r.sourceId, r.ok ? 'ok' : r.code])) } };
    }
    // Temporary and self-expiring: see docs/publisher-feed.md, "Screening sample". It only observes; it never changes the snapshot.
    const sample: ScreenedRecord[] = [];
    const snapshot = buildSnapshot(previous?.snapshot ?? null, results, sources, control, now, deps.feeds.map(f => f.id),
      screeningLogActive(control, now) ? record => { sample.push(record); } : undefined);
    if (sample.length) {
      try { const write = deps.log ?? ((line: string) => console.log(line)); for (const line of screeningLogLines(sample, now)) write(line); }
      catch { /* logging can never fail a collection run */ }
    }
    try { await store.writeCurrent(snapshot, previous?.etag ?? null); }
    catch (error) { if (conflictError(error)) return { code: 409, body: { error: 'Another run replaced the snapshot first; nothing was overwritten.' } }; throw error; }
    return { code: 200, body: { revision: snapshot.revision, listed: snapshot.items.length,
      sources: Object.fromEntries(Object.entries(snapshot.sources).map(([id, s]) => [id, { status: s.status, listed: s.listed, carried: s.carried }])) } };
  } finally { await store.releaseLock(token); }
}

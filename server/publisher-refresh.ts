import { collectPublisherFeed } from './publisher-collect.mjs';
import { fetchPermittedFeed } from './collect.mjs';
import { buildSnapshot } from './publisher-snapshot.ts';
import type { FeedCandidate, ScreenedRecord, SourceResult } from './publisher-snapshot.ts';
import { conflictError } from './publisher-store.ts';
import type { PublisherStore } from './publisher-store.ts';
import { isLabelOnly, storedStreak } from '../src/lib/publisher-feed.ts';
import type { PublisherFeedControl, PublisherSnapshot, PublisherSources } from '../src/lib/publisher-feed.ts';

export interface FeedConfig { id: string; url: string; allowedDomains: string[]; topic: string; fetchPolicyRef: string; lanes: string[]; maxBytes?: number; format?: 'wordpress'; supplementalUrl?: string; supplementalBylineUrl?: string }
export interface RefreshDeps {
  feeds: FeedConfig[]; sources: PublisherSources; control: PublisherFeedControl; store: PublisherStore;
  /** Defaults to the hardened safeFetch inside fetchPermittedFeed. Injected only by tests. */
  fetcher?: Parameters<typeof fetchPermittedFeed>[1];
  now?: () => string;
  pause?: (ms: number) => Promise<void>;
  /** Where screening-sample lines go. Defaults to console.log (the private run log). Injected only by tests. */
  log?: (line: string) => void;
  /**
   * Private teaching batch (see server/teaching-batch.ts). Receives the records this run already screened, after the snapshot is
   * stored. It can never change the snapshot, the listings or the outcome of the run. Absent means off.
   */
  saveTeaching?: (records: ScreenedRecord[], now: string, descriptions: ReadonlyMap<string, string>) => Promise<unknown>;
}

/**
 * One counts-only line for each source that came back empty, or could not be reached, two or more runs in a row (Security Lead, October 26, 2026).
 * Label-only sources are never named. Read-only: it cannot change a decision.
 */
export function quietSourceLines(snapshot: PublisherSnapshot, sources: PublisherSources): string[] {
  const lines: string[] = [];
  for (const [id, run] of Object.entries(snapshot.sources)) {
    if (!/^[a-z0-9-]{1,64}$/.test(id) || !run || typeof run !== 'object') continue;
    if (isLabelOnly(sources[id]?.publisherFeed) || storedStreak(run.labelOnly) > 0) continue;
    const quiet = storedStreak(run.quietRuns), unreached = storedStreak(run.unreachedRuns);
    if (quiet >= 2 || unreached >= 2) lines.push(`quiet source: ${id} quietRuns=${quiet} unreachedRuns=${unreached}`);
  }
  return lines;
}

/** The most time the teaching batch may add to a run, so the scheduled job stays inside its time limit. */
export const TEACHING_BUDGET_MS = 15_000;
export type RefreshOutcome =
  | { code: 200; body: { revision: string; listed: number; sources: Record<string, { status: string; listed: number; carried: number }> } }
  | { code: 200; body: { skipped: 'disabled'; cleanup?: 'failed' } }
  | { code: 409; body: { error: string } }
  | { code: 502; body: { error: string; sources: Record<string, string> } };

/** Minimum gap between two feed requests to the same publisher host in one run (matches the 10-second robots.txt crawl delays we honor). */
export const HOST_SPACING_MS = 10_000;

/** Prefix of the private run-log lines written while the screening sample is on. */
export const SCREENING_LOG_PREFIX = 'screening-sample';
/**
 * The most bytes one run-log line may hold. The tool that reads the run log cuts every message off at about 2,000 characters, and a cut
 * line loses its last records for good (the first pull, on October 16, lost about a quarter of its candidates this way). 1,700 bytes leaves
 * room for letters that take more than one byte and for anything the log adds around a line.
 */
export const SCREENING_LOG_MAX_LINE = 1700;

/** True only while `control.screeningLogUntil` (UTC date, midnight) is still in the future. Missing or malformed means off. */
export function screeningLogActive(control: PublisherFeedControl, now: string): boolean {
  const until = control.screeningLogUntil;
  if (typeof until !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(until)) return false;
  const end = Date.parse(until + 'T00:00:00Z'), time = Date.parse(now);
  return Number.isFinite(end) && Number.isFinite(time) && time < end;
}

/**
 * Packs the records, in order, into as few lines as fit under SCREENING_LOG_MAX_LINE bytes, so no line is ever cut off by the log reader.
 * A record is never split. A single record that is too long for one line (not expected: titles and links are length-limited) goes on a line of
 * its own, whole, and that line would be the only one at risk.
 */
export function screeningLogLines(records: ScreenedRecord[], now: string): string[] {
  const line = (batch: ScreenedRecord[], part: number, of: number) => `${SCREENING_LOG_PREFIX} ${JSON.stringify({ run: now, part, of, total: records.length, records: batch })}`;
  // Sizes are measured with the widest possible part numbers, so numbering the lines afterwards can never push one over the limit.
  const size = (batch: ScreenedRecord[]) => Buffer.byteLength(line(batch, 99999, 99999));
  const groups: ScreenedRecord[][] = [];
  let current: ScreenedRecord[] = [];
  for (const record of records) {
    if (current.length && size([...current, record]) > SCREENING_LOG_MAX_LINE) { groups.push(current); current = []; }
    current.push(record);
  }
  if (current.length) groups.push(current);
  return groups.map((batch, i) => line(batch, i + 1, groups.length));
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
    // Held apart from the records on purpose: the records can be written to the run log, and a description never may be.
    const descriptions = new Map<string, string>();
    const logActive = screeningLogActive(control, now);
    const snapshot = buildSnapshot(previous?.snapshot ?? null, results, sources, control, now, deps.feeds.map(f => f.id),
      logActive || deps.saveTeaching ? (record, body) => { sample.push(record); if (deps.saveTeaching && body) descriptions.set(record.id, body); } : undefined);
    if (logActive && sample.length) {
      try { const write = deps.log ?? ((line: string) => console.log(line)); for (const line of screeningLogLines(sample, now)) write(line); }
      catch { /* logging can never fail a collection run */ }
    }
    try { await store.writeCurrent(snapshot, previous?.etag ?? null); }
    catch (error) { if (conflictError(error)) return { code: 409, body: { error: 'Another run replaced the snapshot first; nothing was overwritten.' } }; throw error; }
    try { const write = deps.log ?? ((line: string) => console.log(line)); for (const line of quietSourceLines(snapshot, sources)) write(line); }
    catch { /* logging can never fail a collection run */ }
    // After the snapshot is safely stored. Bounded in time, and no failure here can change the run's result.
    if (deps.saveTeaching && sample.length) {
      try { await Promise.race([deps.saveTeaching(sample, now, descriptions).catch(() => undefined), new Promise(resolve => { const t = setTimeout(resolve, TEACHING_BUDGET_MS); (t as { unref?: () => void }).unref?.(); })]); }
      catch { /* never fails a collection run */ }
    }
    return { code: 200, body: { revision: snapshot.revision, listed: snapshot.items.length,
      sources: Object.fromEntries(Object.entries(snapshot.sources).map(([id, s]) => [id, { status: s.status, listed: s.listed, carried: s.carried }])) } };
  } finally { await store.releaseLock(token); }
}

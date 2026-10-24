import { PUBLISHER_FEED_POLICY, validSnapshot } from '../src/lib/publisher-feed.ts';
import type { PublisherFeedControl, PublisherSources, SnapshotRead } from '../src/lib/publisher-feed.ts';

/** Wording approved by General Counsel (draft ruling of October 19, 2026). */
export const RUN_REPORT_NOTE = "Counts from PositiviTV's automatic story selection. Not listed doesn't mean a story is wrong; it means our rules didn't pick it.";

/** Neutral words for publishers: never "rejected" or "failed". */
const COLLECTION_WORDS = { ok: 'collected', failed: 'not reached', disabled: 'switched off' } as const;

export interface SourceCounts {
  collection: 'collected' | 'not reached' | 'switched off';
  checkedAt: string; lastCollectedAt: string | null;
  candidates: number; listed: number; carried: number;
  /** Items kept private for labelling only (label-only mode). Never mixed with `listed` or `notListed`. */
  labelOnly: number;
  notListed: number;
  /** How often each reason held a story back. One story can have several reasons, so these can add up to more than notListed. */
  heldBackReasons: Record<string, number>;
}
export interface RunReport {
  note: string; policy: string;
  lane: 'on' | 'switched off' | 'no run yet';
  generatedAt: string | null;
  sources: Record<string, SourceCounts>;
  paused: { lane: boolean; sources: string[]; storyTypes: string[] };
}

const count = (n: unknown) => (Number.isInteger(n) && (n as number) >= 0 ? (n as number) : 0);

/**
 * Counts only. No headlines, descriptions, links, story ids, visitor data or IP addresses, and no error text
 * from the collector (which could name a host or path). Built from the stored snapshot the daily run already writes.
 */
export function buildRunReport(read: SnapshotRead, control: PublisherFeedControl, _sources: PublisherSources): RunReport {
  const base = { note: RUN_REPORT_NOTE, policy: PUBLISHER_FEED_POLICY, paused: { lane: !control.enabled, sources: [] as string[], storyTypes: [] as string[] } };
  const snapshot = read.snapshot;
  if (!control.enabled) return { ...base, lane: 'switched off', generatedAt: null, sources: {} };
  if (!snapshot || !validSnapshot(snapshot) || snapshot.policy !== PUBLISHER_FEED_POLICY) return { ...base, lane: 'no run yet', generatedAt: null, sources: {} };
  const out: Record<string, SourceCounts> = {};
  for (const [id, run] of Object.entries(snapshot.sources)) {
    if (!/^[a-z0-9-]{1,64}$/.test(id) || !run || typeof run !== 'object') continue;
    const reasons: Record<string, number> = {};
    for (const [code, n] of Object.entries(run.excluded ?? {})) if (/^[A-Z_]{1,64}$/.test(code)) reasons[code] = count(n);
    const candidates = count(run.parsed), listed = count(run.listed), labelOnly = count(run.labelOnly);
    out[id] = {
      collection: COLLECTION_WORDS[run.status] ?? 'not reached',
      checkedAt: typeof run.checkedAt === 'string' ? run.checkedAt : '',
      lastCollectedAt: typeof run.lastSuccessAt === 'string' ? run.lastSuccessAt : null,
      candidates, listed, carried: count(run.carried), labelOnly, notListed: Math.max(0, candidates - listed - labelOnly), heldBackReasons: reasons,
    };
  }
  // Only sources the last run itself recorded as switched off, so a publisher we never used is never named here.
  const pausedSources = Object.entries(out).filter(([, c]) => c.collection === 'switched off').map(([id]) => id).sort();
  return { ...base, lane: 'on', generatedAt: snapshot.generatedAt, sources: out, paused: { ...base.paused, sources: pausedSources } };
}

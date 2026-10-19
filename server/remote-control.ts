import type { PublisherFeedControl, Withdrawal } from '../src/lib/publisher-feed.ts';

/**
 * Same-day controls for the automatic publisher-feed lane, kept outside the deployment so they take
 * effect without a redeploy. They live in the project's Vercel Global Config store (formerly Edge Config),
 * which Alex can edit from the Vercel dashboard on his own. Two keys only:
 *
 *   publisherLaneOff   true pauses the whole automatic lane (the reviewed edition is still served)
 *   withdrawnStories   a list of story ids or original article links to take off the site
 *
 * These controls can only pause or hold back. They can never list a story, add a story type or loosen a rule.
 * When the store is connected but cannot be read, or holds a value this code does not understand, the lane is
 * paused (fail closed) until a good read. When no store is connected, the deployed config file alone applies.
 */
export const REMOTE_KEYS = ['publisherLaneOff', 'withdrawnStories'] as const;
export const MAX_REMOTE_WITHDRAWALS = 500;
const MAX_ENTRY_LENGTH = 2048;
const STORY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{24}$/;

export interface RemoteControl { laneOff: boolean; withdrawn: Withdrawal[] }
/** configured=false: no store is connected. ok=false: connected but unreadable or invalid, so the lane pauses. */
export type RemoteRead = { configured: false } | { configured: true; ok: true; value: RemoteControl; readAt: string } | { configured: true; ok: false; reason: 'unreadable' | 'invalid' };

/** Strict parse. Any value of the wrong shape, including one bad entry, returns null so the lane pauses. */
export function parseRemoteControl(items: unknown, at: string): RemoteControl | null {
  if (!items || typeof items !== 'object' || Array.isArray(items)) return null;
  const record = items as Record<string, unknown>;
  const off = record.publisherLaneOff, list = record.withdrawnStories;
  if (off !== undefined && typeof off !== 'boolean') return null;
  if (list !== undefined && !Array.isArray(list)) return null;
  const entries = (list ?? []) as unknown[];
  if (entries.length > MAX_REMOTE_WITHDRAWALS) return null;
  const withdrawn: Withdrawal[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'string') return null;
    const value = entry.trim();
    if (!value || value.length > MAX_ENTRY_LENGTH) return null;
    if (STORY_ID.test(value)) { withdrawn.push({ id: value, reason: 'same-day withdrawal', at }); continue; }
    let url: URL;
    try { url = new URL(value); } catch { return null; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    withdrawn.push({ url: value, reason: 'same-day withdrawal', at });
  }
  return { laneOff: off === true, withdrawn };
}

/**
 * Applies the remote controls to the deployed control file. The result is never looser than the file:
 * the lane can only be switched off, and withdrawals are only ever added.
 */
export function applyRemoteControl(control: PublisherFeedControl, remote: RemoteRead): PublisherFeedControl {
  if (!remote.configured) return control;
  if (!remote.ok) return { ...control, enabled: false };
  return { ...control, enabled: control.enabled && !remote.value.laneOff, withdrawn: [...control.withdrawn, ...remote.value.withdrawn] };
}

/**
 * Visitor-path reader with a per-instance memory cache, so visitor traffic stays inside the free monthly reads.
 * A good read is reused for okTtlMs (default 3 minutes). After a failed read the last good value keeps applying
 * and a new read is tried after failTtlMs; with no good value yet, the lane stays paused.
 */
export function createRemoteControlReader(fetchItems: (() => Promise<unknown>) | null,
  options: { okTtlMs?: number; failTtlMs?: number; clock?: () => number } = {}) {
  const okTtl = options.okTtlMs ?? 3 * 60 * 1000, failTtl = options.failTtlMs ?? 30 * 1000, clock = options.clock ?? Date.now;
  let good: RemoteRead | null = null, last: RemoteRead | null = null, until = 0, inflight: Promise<RemoteRead> | null = null;
  return async function readRemoteControl(): Promise<RemoteRead> {
    if (!fetchItems) return { configured: false };
    if (last && clock() < until) return last;
    if (inflight) return inflight;
    inflight = (async () => {
      const at = new Date(clock()).toISOString();
      try {
        const value = parseRemoteControl(await fetchItems(), at);
        if (value) { good = { configured: true, ok: true, value, readAt: at }; last = good; until = clock() + okTtl; }
        else { good = null; last = { configured: true, ok: false, reason: 'invalid' }; until = clock() + failTtl; }
      } catch {
        // An unreachable store keeps the last good controls; a value that was read but not understood never does.
        last = good ?? { configured: true, ok: false, reason: 'unreadable' }; until = clock() + failTtl;
      }
      return last!;
    })();
    try { return await inflight; } finally { inflight = null; }
  };
}

/** The connection string Vercel adds when a Global Config store is connected to the project, if any. */
export function remoteConnectionString(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.GLOBAL_CONFIG || env.EDGE_CONFIG;
  return value && value.trim() ? value.trim() : null;
}

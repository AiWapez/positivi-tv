import { randomUUID } from 'node:crypto';
import { get, put, del, head, BlobPreconditionFailedError } from '@vercel/blob';
import { validSnapshot } from '../src/lib/publisher-feed.ts';
import type { PublisherSnapshot, SnapshotRead } from '../src/lib/publisher-feed.ts';
import { SNAPSHOT_MAX_BYTES, serializeSnapshot } from './publisher-snapshot.ts';

/**
 * Private Vercel Blob persistence for the publisher-feed snapshot, in the same private store as the
 * editorial queue. Two fixed paths only:
 * - publisher-feed/current.json  the latest snapshot; replaced with an ETag precondition (compare-and-swap)
 * - publisher-feed/lock.json     a short-lived run lock created with allowOverwrite: false
 * Visitors never write. Reads from /api/stories go through a per-instance memory cache and the Blob CDN cache.
 */
export const SNAPSHOT_PATH = 'publisher-feed/current.json';
export const LOCK_PATH = 'publisher-feed/lock.json';
export const LOCK_STALE_MS = 5 * 60 * 1000;

type GetResult = { statusCode: number; stream: ReadableStream<Uint8Array> | null; etag?: string; blob?: { etag?: string } } | null;
export interface BlobApi {
  get(pathname: string, options: { access: 'private'; useCache?: boolean }): Promise<GetResult>;
  put(pathname: string, body: string, options: Record<string, unknown>): Promise<unknown>;
  del(pathname: string, options?: { ifMatch?: string }): Promise<void>;
  head(pathname: string): Promise<{ etag: string; uploadedAt: Date }>;
}
export const vercelBlob: BlobApi = { get: get as unknown as BlobApi['get'], put: put as unknown as BlobApi['put'], del, head };

export function conflictError(error: unknown): boolean {
  return error instanceof BlobPreconditionFailedError || /already exists|precondition/i.test(String((error as Error)?.message ?? ''));
}
class OversizedObject extends Error {}
async function readText(result: GetResult, limit: number): Promise<string | null> {
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const reader = result.stream.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) { await reader.cancel(); throw new OversizedObject('Oversized stored object'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
const etagOf = (result: GetResult) => result?.etag || result?.blob?.etag || null;

export function createPublisherStore(api: BlobApi = vercelBlob) {
  /** Fresh ETag for a known-present object, used when a read did not report one. */
  const headEtag = async (path: string) => { try { return (await api.head(path)).etag || null; } catch { return null; } };
  return {
    /**
     * Returns null when no snapshot exists. Returns { snapshot: null, invalid: true, etag } when an object
     * exists but its content is oversized, not JSON or not a snapshot, so the scheduled job can replace it with
     * a compare-and-swap instead of failing on every run. Network and stream errors are thrown, never treated as
     * "no snapshot", so a transient failure cannot discard carried items. fresh=true bypasses the CDN.
     */
    async readCurrent(fresh = false): Promise<{ snapshot: PublisherSnapshot | null; etag: string | null; invalid?: true } | null> {
      let result: GetResult;
      try { result = await api.get(SNAPSHOT_PATH, { access: 'private', useCache: !fresh }); }
      catch (error) { if ((error as Error)?.name === 'BlobNotFoundError') return null; throw error; }
      if (!result || result.statusCode !== 200) return null;
      const etag = etagOf(result) ?? (fresh ? await headEtag(SNAPSHOT_PATH) : null);
      let text: string | null;
      try { text = await readText(result, SNAPSHOT_MAX_BYTES); }
      catch (error) { if (error instanceof OversizedObject) return { snapshot: null, etag, invalid: true }; throw error; }
      let parsed: unknown = null;
      try { parsed = text === null ? null : JSON.parse(text); } catch { return { snapshot: null, etag, invalid: true }; }
      return validSnapshot(parsed) ? { snapshot: parsed, etag } : { snapshot: null, etag, invalid: true };
    },
    /** Create when absent; otherwise replace only if nobody else replaced it since our read. */
    async writeCurrent(snapshot: PublisherSnapshot, etag: string | null) {
      const body = serializeSnapshot(snapshot);
      const common = { access: 'private', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 300 };
      return api.put(SNAPSHOT_PATH, body, etag ? { ...common, ifMatch: etag } : { ...common, allowOverwrite: false });
    },
    /** Used when the lane is switched off, so stored headlines do not outlive the decision. del is free on Blob. */
    async deleteCurrent() { try { await api.del(SNAPSHOT_PATH); } catch (error) { if ((error as Error)?.name !== 'BlobNotFoundError') throw error; } },
    async acquireLock(now = Date.now()): Promise<string | null> {
      const token = randomUUID();
      const attempt = () => api.put(LOCK_PATH, JSON.stringify({ token, at: new Date(now).toISOString() }),
        { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json', cacheControlMaxAge: 60 });
      try { await attempt(); return token; }
      catch (error) { if (!conflictError(error)) throw error; }
      // Someone holds the lock. Break it only if it is stale, and only the exact copy we inspected.
      let meta: { etag: string; uploadedAt: Date };
      try { meta = await api.head(LOCK_PATH); }
      catch (error) {
        if ((error as Error)?.name !== 'BlobNotFoundError') throw error;
        // Released between our attempt and the check: try once more, otherwise report busy.
        try { await attempt(); return token; } catch (again) { if (conflictError(again)) return null; throw again; }
      }
      if (!meta.etag || now - new Date(meta.uploadedAt).getTime() < LOCK_STALE_MS) return null;
      try { await api.del(LOCK_PATH, { ifMatch: meta.etag }); await attempt(); return token; }
      catch (error) { if (conflictError(error)) return null; throw error; }
    },
    async releaseLock(token: string) {
      try {
        const result = await api.get(LOCK_PATH, { access: 'private', useCache: false });
        const text = await readText(result, 4096);
        if (!text || JSON.parse(text).token !== token) return;
        const etag = etagOf(result) ?? await headEtag(LOCK_PATH);
        // Never delete without a precondition; an unreleased lock expires after LOCK_STALE_MS.
        if (etag) await api.del(LOCK_PATH, { ifMatch: etag });
      } catch { /* A lock left behind expires after LOCK_STALE_MS. */ }
    },
  };
}
export type PublisherStore = ReturnType<typeof createPublisherStore>;

/**
 * Visitor-path reader. Memory-cached per server instance: 30 minutes after a good read, 60 seconds after a
 * failure (the last good snapshot keeps being served meanwhile). It never fetches publisher feeds.
 */
export function createSnapshotReader(read: () => Promise<{ snapshot: PublisherSnapshot | null; invalid?: true } | null>,
  options: { okTtlMs?: number; failTtlMs?: number; clock?: () => number } = {}) {
  const okTtl = options.okTtlMs ?? 30 * 60 * 1000, failTtl = options.failTtlMs ?? 60 * 1000, clock = options.clock ?? Date.now;
  let cached: SnapshotRead | null = null, until = 0, inflight: Promise<SnapshotRead> | null = null;
  return async function readSnapshot(): Promise<SnapshotRead> {
    if (cached && clock() < until) return cached;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const result = await read();
        // An object that exists but is invalid is a failure: keep the last good copy and retry soon.
        if (result?.invalid) throw new Error('Invalid stored snapshot');
        cached = result?.snapshot ? { snapshot: result.snapshot, status: 'ok' } : { snapshot: null, status: 'unavailable' };
        // An initial miss is retried promptly; the first collection must not leave readers empty for 30 minutes.
        until = clock() + (result?.snapshot ? okTtl : failTtl);
      } catch {
        cached = cached?.snapshot ? cached : { snapshot: null, status: 'unavailable' }; until = clock() + failTtl;
      }
      return cached!;
    })();
    try { return await inflight; } finally { inflight = null; }
  };
}

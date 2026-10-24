/**
 * Public visit counter: the shared rules for api/visit.ts (the only visitor path that writes) and api/visits.ts (read only).
 *
 * Security Lead review, October 24, 2026. What this stores: a UTC date and two whole numbers (that day's count and a running
 * total) in a small outside key-value store. It never stores or reads an IP address, Referer, User-Agent or any other request
 * detail. It is off until the deployed config file says `enabled: true` AND `dailyCeiling` is a positive number.
 * Fail closed: anything unclear means "do not count".
 *
 * Environment (names only; values are never printed or logged):
 *   KV_REST_API_URL, KV_REST_API_TOKEN (write), KV_REST_API_READ_ONLY_TOKEN (read).
 * /api/visit uses only the write token. /api/visits uses only the read-only token.
 */
export interface VisitConfig { enabled: boolean; dailyCeiling: number; perCopyPerMinute: number; allowedOrigins: string[]; keyPrefix: string }

export const VISIT_ENV = { url: 'KV_REST_API_URL', write: 'KV_REST_API_TOKEN', read: 'KV_REST_API_READ_ONLY_TOKEN' } as const;
export const VISIT_BODY_MAX_BYTES = 64;
export const VISIT_PAUSE_KEY = 'visitCounterOff';
const STORE_HOST = /^[a-z0-9-]+\.upstash\.io$/;
const PREFIX = /^[a-z0-9][a-z0-9-]{0,31}$/;
const ORIGIN = /^https:\/\/[a-z0-9.-]+$/;
const MAX_COUNT = 1e12;

/** Strict parse. Returns null for anything that is not exactly the expected shape, which means the counter is off. */
export function parseVisitConfig(value: unknown): VisitConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v).sort().join(',');
  if (keys !== 'allowedOrigins,dailyCeiling,enabled,keyPrefix,perCopyPerMinute') return null;
  const { enabled, dailyCeiling, perCopyPerMinute, allowedOrigins, keyPrefix } = v;
  if (typeof enabled !== 'boolean') return null;
  if (!Number.isSafeInteger(dailyCeiling) || (dailyCeiling as number) < 0 || (dailyCeiling as number) > 10_000_000) return null;
  if (!Number.isSafeInteger(perCopyPerMinute) || (perCopyPerMinute as number) < 1 || (perCopyPerMinute as number) > 600) return null;
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length < 1 || allowedOrigins.length > 5 || !allowedOrigins.every(o => typeof o === 'string' && ORIGIN.test(o))) return null;
  if (typeof keyPrefix !== 'string' || !PREFIX.test(keyPrefix)) return null;
  return { enabled, dailyCeiling: dailyCeiling as number, perCopyPerMinute: perCopyPerMinute as number, allowedOrigins: [...(allowedOrigins as string[])], keyPrefix };
}

/** True only when the file turns the counter on and a ceiling has been set. A ceiling of 0 means "not set yet", so it stays off. */
export const visitCounterOn = (config: VisitConfig | null): config is VisitConfig => !!config && config.enabled && config.dailyCeiling > 0;

export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const dayKey = (config: VisitConfig, ms: number) => `${config.keyPrefix}:visits:day:${utcDay(ms)}`;
export const totalKey = (config: VisitConfig) => `${config.keyPrefix}:visits:total`;

export interface StoreAccess { url: string; token: string }
/** Reads only the names it needs. 'write' never touches the read-only token and 'read' never touches the write token. */
export function storeAccess(kind: 'write' | 'read', env: Record<string, string | undefined> = process.env): StoreAccess | null {
  const rawUrl = env[VISIT_ENV.url], token = env[kind === 'write' ? VISIT_ENV.write : VISIT_ENV.read];
  if (typeof rawUrl !== 'string' || typeof token !== 'string' || !token.trim()) return null;
  let url: URL;
  try { url = new URL(rawUrl.trim()); } catch { return null; }
  if (url.protocol !== 'https:' || !STORE_HOST.test(url.hostname) || url.username || url.password || url.port || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) return null;
  return { url: url.origin, token: token.trim() };
}

export type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
const realFetch: Fetcher = (url, init) => fetch(url, init);

/** One REST pipeline call. Returns the results as numbers (or null for a missing key), or null when the store failed or answered oddly. */
export async function pipeline(access: StoreAccess, commands: string[][], fetcher: Fetcher = realFetch): Promise<(number | null)[] | null> {
  try {
    const response = await fetcher(access.url + '/pipeline', {
      method: 'POST', headers: { Authorization: 'Bearer ' + access.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands), signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) { console.error('visit-counter store status', response.status); return null; }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== commands.length) return null;
    const out: (number | null)[] = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object' || 'error' in row) return null;
      const result = (row as { result?: unknown }).result;
      if (result === null || result === undefined) { out.push(null); continue; }
      const n = typeof result === 'string' && /^\d{1,13}$/.test(result) ? Number(result) : result;
      if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0 || n > MAX_COUNT) return null;
      out.push(n);
    }
    return out;
  } catch { console.error('visit-counter store unreachable'); return null; }
}

/** Per-copy limit on accepted writes in any one minute. A copy of the function is not shared, so this is only a first brake. */
export function createRateGate(perMinute: number, clock: () => number = Date.now) {
  let windowStart = 0, used = 0;
  return function allow(): boolean {
    const now = clock();
    if (now - windowStart >= 60_000) { windowStart = now; used = 0; }
    if (used >= perMinute) return false;
    used++; return true;
  };
}

/** Pause switch kept in the same Vercel Global Config store as the publisher-lane controls. It can only pause, never turn the counter on. */
export function parsePause(items: unknown): boolean | null {
  if (!items || typeof items !== 'object' || Array.isArray(items)) return null;
  const off = (items as Record<string, unknown>)[VISIT_PAUSE_KEY];
  if (off === undefined) return false;
  return typeof off === 'boolean' ? off : null;
}
/**
 * Returns true when the counter is paused. Fail closed everywhere: no Global Config connection (a Preview, say) means paused, and so
 * does a connection that is unreadable or holds an invalid value. The one exception is an unreachable store after a good read, which
 * keeps the last good answer, like the publisher-lane reader. The counter therefore runs only where the pause switch can be read.
 */
export function createPauseReader(fetchItems: (() => Promise<unknown>) | null, options: { okTtlMs?: number; failTtlMs?: number; clock?: () => number } = {}) {
  const okTtl = options.okTtlMs ?? 3 * 60_000, failTtl = options.failTtlMs ?? 30_000, clock = options.clock ?? Date.now;
  let good: boolean | null = null, last = true, until = 0, inflight: Promise<boolean> | null = null;
  return async function paused(): Promise<boolean> {
    if (!fetchItems) return true;
    if (clock() < until) return last;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const parsed = parsePause(await fetchItems());
        if (parsed === null) { good = null; last = true; until = clock() + failTtl; }
        else { good = parsed; last = parsed; until = clock() + okTtl; }
      } catch { last = good ?? true; until = clock() + failTtl; }
      return last;
    })();
    try { return await inflight; } finally { inflight = null; }
  };
}

/** Reads at most VISIT_BODY_MAX_BYTES from the request stream and stops there. Returns null when the body is larger or unreadable. */
export async function readSmallBody(req: unknown, max = VISIT_BODY_MAX_BYTES): Promise<string | null> {
  try {
    const source = req as AsyncIterable<Uint8Array | string> & { body?: unknown };
    let text = '', bytes = 0;
    if (source && typeof (source as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function') {
      for await (const chunk of source) {
        const piece = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
        bytes += piece.byteLength;
        if (bytes > max) return null;
        text += piece.toString('utf8');
      }
    }
    if (bytes === 0 && source && source.body !== undefined) {
      // The platform may have read the stream already; accept its parsed copy only if it is just as small.
      text = typeof source.body === 'string' ? source.body : JSON.stringify(source.body);
      if (Buffer.byteLength(text) > max) return null;
    }
    return text;
  } catch { return null; }
}

/** The only body the tick endpoint accepts: exactly {"v":1}. */
export function validTickBody(text: string | null): boolean {
  if (text === null || text.length > VISIT_BODY_MAX_BYTES) return false;
  try {
    const value = JSON.parse(text);
    return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && (value as { v?: unknown }).v === 1;
  } catch { return false; }
}

/** Numbers sent to the page. Anything else becomes null, and the page then shows nothing. */
export function publicNumbers(today: number | null, total: number | null, ceiling: number): { today: number | null; total: number | null } {
  if (today === null || total === null) return { today: null, total: null };
  return { today: Math.min(today, ceiling), total };
}

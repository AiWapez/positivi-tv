import config from '../config/visit-counter.json' with { type: 'json' };
import { createClient } from '@vercel/global-config';
import { remoteConnectionString } from '../server/remote-control.ts';
import {
  VISIT_PAUSE_KEY, parseVisitConfig, visitCounterOn, dayKey, totalKey, utcDay, storeAccess, pipeline, createRateGate, createPauseReader,
  readSmallBody, validTickBody,
} from '../server/visit-counter.ts';
import type { Fetcher, VisitConfig } from '../server/visit-counter.ts';

interface Request { method?: string; url?: string; headers: Record<string, string | string[] | undefined> }
interface Response { status(code: number): Response; setHeader(name: string, value: string): void; end(): void }
export interface VisitDeps {
  config: unknown;
  /** True when the same-day pause switch says stop, or cannot be read. */
  readPause: () => Promise<boolean>;
  env?: Record<string, string | undefined>;
  fetcher?: Fetcher;
  now?: () => number;
}

/**
 * POST /api/visit. The one visitor path that writes anything, so it is the most guarded:
 *  - every outcome, accepted or rejected, is the same empty 204, so the endpoint cannot be used to probe its rules;
 *  - it reads only the Origin and Content-Type headers and never stores or logs an IP address, Referer, User-Agent or any other request detail;
 *  - it writes on each accepted tick, before answering, as one pipeline (INCR the day, INCR the total). Nothing waits in memory;
 *  - once the day's count passes the ceiling it stops writing for the rest of that UTC day (a copy that learns this answers without touching the store);
 *  - it is off unless config/visit-counter.json says so and a ceiling is set, and the pause switch can stop it at any time.
 * The total can pass the ceiling by at most one tick per running copy of the function on that day, because a copy only learns
 * that the ceiling is reached from the answer to its own write.
 */
export function createVisitHandler(deps: VisitDeps) {
  const settings = parseVisitConfig(deps.config), now = deps.now ?? Date.now;
  const gate = settings ? createRateGate(settings.perCopyPerMinute, now) : () => false;
  let cappedDay: string | null = null;
  async function accept(req: Request, cfg: VisitConfig): Promise<void> {
    if (req.method !== 'POST' || typeof req.url !== 'string' || req.url.includes('?')) return;
    const origin = req.headers.origin, type = req.headers['content-type'];
    if (typeof origin !== 'string' || !cfg.allowedOrigins.includes(origin) || type !== 'application/json') return;
    if (!validTickBody(await readSmallBody(req))) return;
    const ms = now(), day = utcDay(ms);
    if (cappedDay === day) return;
    if (await deps.readPause()) return;
    if (!gate()) return;
    const access = storeAccess('write', deps.env);
    if (!access) return;
    const result = await pipeline(access, [['INCR', dayKey(cfg, ms)], ['INCR', totalKey(cfg)]], deps.fetcher);
    if (result && result[0] !== null && result[0] > cfg.dailyCeiling) cappedDay = day;
  }
  return async function handler(req: Request, res: Response) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try { if (visitCounterOn(settings)) await accept(req, settings); } catch { /* any failure is a quiet 204 */ }
    res.status(204).end();
  };
}

const connection = remoteConnectionString();
const client = connection ? createClient(connection) : null;
export default createVisitHandler({
  config,
  readPause: createPauseReader(client ? () => client.getAll<Record<string, unknown>>([VISIT_PAUSE_KEY]) : null),
});

import config from '../config/visit-counter.json' with { type: 'json' };
import { createClient } from '@vercel/global-config';
import { remoteConnectionString } from '../server/remote-control.ts';
import {
  VISIT_PAUSE_KEY, parseVisitConfig, visitCounterOn, dayKey, totalKey, storeAccess, pipeline, createPauseReader, publicNumbers,
} from '../server/visit-counter.ts';
import type { Fetcher } from '../server/visit-counter.ts';

interface Request { method?: string; url?: string }
interface Response { status(code: number): Response; setHeader(name: string, value: string): void; json(value: unknown): void; end(): void }
export interface VisitsDeps {
  config: unknown;
  readPause: () => Promise<boolean>;
  env?: Record<string, string | undefined>;
  fetcher?: Fetcher;
  now?: () => number;
}

/**
 * GET /api/visits. Read only. Takes no input and echoes nothing: the answer is exactly two numbers, `today` and `total`, or both null
 * when the counter is off, paused or unavailable (the page then shows nothing). It uses only the store's read-only token. The edge keeps
 * the answer for 60 seconds, so a busy day is a handful of reads. A request with a query string is refused, because each different
 * query string would otherwise miss the edge cache and reach the store.
 */
export function createVisitsHandler(deps: VisitsDeps) {
  const settings = parseVisitConfig(deps.config), now = deps.now ?? Date.now;
  let last: { today: number | null; total: number | null } = { today: null, total: null };
  return async function handler(req: Request, res: Response) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.setHeader('Cache-Control', 'no-store'); res.status(405).end(); return; }
    if (typeof req.url === 'string' && req.url.includes('?')) { res.setHeader('Cache-Control', 'no-store'); res.status(400).end(); return; }
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    let body: { today: number | null; total: number | null } = { today: null, total: null };
    try {
      if (visitCounterOn(settings) && !(await deps.readPause())) {
        const access = storeAccess('read', deps.env);
        const result = access ? await pipeline(access, [['GET', dayKey(settings, now())], ['GET', totalKey(settings)]], deps.fetcher) : null;
        if (result) last = publicNumbers(result[0] ?? 0, result[1] ?? 0, settings.dailyCeiling);
        body = last;
      } else last = { today: null, total: null };
    } catch { body = last; }
    res.status(200).json({ today: body.today, total: body.total });
  };
}

const connection = remoteConnectionString();
const client = connection ? createClient(connection) : null;
export default createVisitsHandler({
  config,
  readPause: createPauseReader(client ? () => client.getAll<Record<string, unknown>>([VISIT_PAUSE_KEY]) : null),
});

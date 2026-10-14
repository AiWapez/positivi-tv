import config from '../config/feeds.json' with { type: 'json' };
import control from '../config/publisher-feed.json' with { type: 'json' };
import { cronAuthorized } from '../server/cron-auth.ts';
import { runPublisherRefresh } from '../server/publisher-refresh.ts';
import type { RefreshDeps } from '../server/publisher-refresh.ts';
import { createPublisherStore } from '../server/publisher-store.ts';
import type { PublisherFeedControl, PublisherSources } from '../src/lib/publisher-feed.ts';
interface Request { method?: string; headers: Record<string, string | string[] | undefined> }
interface Response { status(code: number): Response; setHeader(key: string, value: string): void; json(data: unknown): void }

/** Scheduled, authenticated collection for the publisher-feed lane. Visitors cannot reach this path's work. */
export function createRefreshHandler(deps: () => RefreshDeps) {
  return async function handler(req: Request, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    if (!cronAuthorized(req.headers.authorization)) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ error: 'Method not allowed' }); return; }
    try { const outcome = await runPublisherRefresh(deps()); res.status(outcome.code).json(outcome.body); }
    catch (error) {
      console.error('Publisher feed refresh unavailable', error instanceof Error ? error.name : 'Error');
      res.status(503).json({ error: 'Publisher feed refresh is temporarily unavailable; the previous snapshot was kept.' });
    }
  };
}
export default createRefreshHandler(() => ({
  feeds: config.feeds, sources: config.sources as unknown as PublisherSources,
  control: control as PublisherFeedControl, store: createPublisherStore(),
}));

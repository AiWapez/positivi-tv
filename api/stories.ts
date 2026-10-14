import edition from '../content/edition.json' with { type: 'json' };
import config from '../config/feeds.json' with { type: 'json' };
import control from '../config/publisher-feed.json' with { type: 'json' };
import { buildCombinedFeed } from '../src/lib/publisher-feed.ts';
import type { PublisherFeedControl, PublisherSources, SnapshotRead } from '../src/lib/publisher-feed.ts';
import type { Publication } from '../src/lib/publication.ts';
import { createPublisherStore, createSnapshotReader } from '../server/publisher-store.ts';
interface Request { method?: string; url?: string }
interface Response { status(code: number): Response; setHeader(name: string, value: string): void; json(value: unknown): void }
export interface StoriesDeps {
  edition: Publication; control: PublisherFeedControl; sources: PublisherSources;
  /** Reads the stored snapshot only. This handler has no access to feed fetching. */
  readSnapshot: () => Promise<SnapshotRead>;
  now?: () => string;
}
/**
 * GET /api/stories. Serves the reviewed edition plus the last stored publisher-feed snapshot.
 * Query strings (including the client's cache-busting refresh) are ignored; a visitor request can never
 * start an upstream crawl. If the snapshot cannot be read, the reviewed edition is served alone.
 */
export function createStoriesHandler(deps: StoriesDeps) {
  return async function handler(req: Request, res: Response) {
    // No cached response may authorize a withdrawn or superseded card.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ error: 'Method not allowed' }); return; }
    let read: SnapshotRead = { snapshot: null, status: 'unavailable' };
    if (deps.control.enabled) { try { read = await deps.readSnapshot(); } catch { /* edition-only */ } }
    try { res.status(200).json(buildCombinedFeed(deps.edition, read, deps.control, deps.sources, (deps.now ?? (() => new Date().toISOString()))())); }
    catch { res.status(503).json({ error: 'Stories are temporarily unavailable.' }); }
  };
}
const store = createPublisherStore();
export default createStoriesHandler({
  edition: edition as Publication, control: control as PublisherFeedControl, sources: config.sources as unknown as PublisherSources,
  readSnapshot: createSnapshotReader(() => store.readCurrent(false)),
});

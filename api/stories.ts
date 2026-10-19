import edition from '../content/edition.json' with { type: 'json' };
import config from '../config/feeds.json' with { type: 'json' };
import control from '../config/publisher-feed.json' with { type: 'json' };
import { createClient } from '@vercel/global-config';
import { buildCombinedFeed } from '../src/lib/publisher-feed.ts';
import type { PublisherFeedControl, PublisherSources, SnapshotRead } from '../src/lib/publisher-feed.ts';
import type { Publication } from '../src/lib/publication.ts';
import { createPublisherStore, createSnapshotReader } from '../server/publisher-store.ts';
import { REMOTE_KEYS, applyRemoteControl, createRemoteControlReader, remoteConnectionString } from '../server/remote-control.ts';
import type { RemoteRead } from '../server/remote-control.ts';
interface Request { method?: string; url?: string }
interface Response { status(code: number): Response; setHeader(name: string, value: string): void; json(value: unknown): void }
export interface StoriesDeps {
  edition: Publication; control: PublisherFeedControl; sources: PublisherSources;
  /** Reads the stored snapshot only. This handler has no access to feed fetching. */
  readSnapshot: () => Promise<SnapshotRead>;
  /** Same-day controls that can only pause the lane or withdraw stories. Absent means the config file alone applies. */
  readRemote?: () => Promise<RemoteRead>;
  now?: () => string;
}
/**
 * GET /api/stories. Serves the reviewed edition plus the last stored publisher-feed snapshot.
 * An optional subject-photo presentation profile is accepted; other query strings never
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
    // Fail closed: if the same-day controls cannot be read, the automatic lane is paused for this request.
    let remote: RemoteRead = { configured: false };
    if (deps.readRemote) { try { remote = await deps.readRemote(); } catch { remote = { configured: true, ok: false, reason: 'unreadable' }; } }
    const effective = applyRemoteControl(deps.control, remote);
    let read: SnapshotRead = { snapshot: null, status: 'unavailable' };
    if (effective.enabled) { try { read = await deps.readSnapshot(); } catch { /* edition-only */ } }
    try {
      const subjectPhotos = new URL(req.url ?? '/api/stories', 'http://localhost').searchParams.get('photos') === 'subjects-v1';
      res.status(200).json(buildCombinedFeed(deps.edition, read, effective, deps.sources, (deps.now ?? (() => new Date().toISOString()))(), { subjectPhotos }));
    }
    catch { res.status(503).json({ error: 'Stories are temporarily unavailable.' }); }
  };
}
const store = createPublisherStore();
const connection = remoteConnectionString();
const remoteClient = connection ? createClient(connection) : null;
export default createStoriesHandler({
  edition: edition as Publication, control: control as PublisherFeedControl, sources: config.sources as unknown as PublisherSources,
  readSnapshot: createSnapshotReader(() => store.readCurrent(false)),
  readRemote: createRemoteControlReader(remoteClient ? () => remoteClient.getAll<Record<(typeof REMOTE_KEYS)[number], unknown>>([...REMOTE_KEYS]) : null),
});

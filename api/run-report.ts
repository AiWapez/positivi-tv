import config from '../config/feeds.json' with { type: 'json' };
import control from '../config/publisher-feed.json' with { type: 'json' };
import type { PublisherFeedControl, PublisherSources, SnapshotRead } from '../src/lib/publisher-feed.ts';
import { createPublisherStore, createSnapshotReader } from '../server/publisher-store.ts';
import { buildRunReport } from '../server/run-report.ts';
interface Request { method?: string }
interface Response { status(code: number): Response; setHeader(name: string, value: string): void; json(value: unknown): void }
export interface RunReportDeps { control: PublisherFeedControl; sources: PublisherSources; readSnapshot: () => Promise<SnapshotRead> }

/**
 * GET /api/run-report. A small public page of counts from the last automatic run, so the daily result can be
 * checked at any hour without logs or approvals. Counts only; see server/run-report.ts for what is left out.
 */
export function createRunReportHandler(deps: RunReportDeps) {
  return async function handler(req: Request, res: Response) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ error: 'Method not allowed' }); return; }
    let read: SnapshotRead = { snapshot: null, status: 'unavailable' };
    if (deps.control.enabled) { try { read = await deps.readSnapshot(); } catch { /* reported as no run yet */ } }
    try { res.status(200).json(buildRunReport(read, deps.control, deps.sources)); }
    catch { res.status(503).json({ error: 'The run report is temporarily unavailable.' }); }
  };
}
const store = createPublisherStore();
export default createRunReportHandler({
  control: control as PublisherFeedControl, sources: config.sources as unknown as PublisherSources,
  readSnapshot: createSnapshotReader(() => store.readCurrent(false)),
});

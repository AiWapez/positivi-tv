import { timingSafeEqual } from 'node:crypto';
import config from '../config/feeds.json' with { type: 'json' };
import { collectCandidates } from '../server/collect.mjs';
import { readBatch, writeBatch, queuePath, pruneQueue, duplicateBatch } from '../server/queue.mjs';
interface Request { method?: string; headers: Record<string, string | string[] | undefined> }
interface Response { status(code: number): Response; setHeader(key: string,value: string): void; json(data: unknown): void }
export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control','no-store');
  const secret = process.env.CRON_SECRET, header = req.headers.authorization;
  if (!secret || typeof header !== 'string' || Buffer.byteLength(header) !== Buffer.byteLength('Bearer ' + secret)
    || !timingSafeEqual(Buffer.from(header), Buffer.from('Bearer ' + secret))) { res.status(401).json({ error:'Unauthorized' }); return; }
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); res.status(405).json({ error:'Method not allowed' }); return; }
  const now = new Date().toISOString();
  try {
    const existing = await readBatch(queuePath(now.slice(0,10)));
    if (existing) { res.status(200).json({ collected: existing.candidates.length, reused: true, published: 0 }); return; }
    const batch = await collectCandidates(config.feeds, now);
    if (!batch.candidates.length && batch.errors.length) { console.error('Feed collection failed', batch.errors); res.status(502).json({ error:'Source collection failed; no stories published.' }); return; }
    try { await writeBatch(batch); } catch (error) { if (!duplicateBatch(error)) throw error; }
    await pruneQueue(); res.status(200).json({ collected: batch.candidates.length, sourcesFailed: batch.errors.length, published: 0 });
  } catch (error) { console.error('Private collection unavailable', error instanceof Error ? error.name : 'Error'); res.status(503).json({ error:'Private collection is temporarily unavailable.' }); }
}

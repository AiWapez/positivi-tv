import edition from '../content/edition.json';
import { buildFeed } from '../src/lib/publication.ts';
import type { Publication } from '../src/lib/publication.ts';
interface Request { method?: string }
interface Response { status(code: number): Response; setHeader(name: string, value: string): void; json(value: unknown): void }
export default function handler(req: Request, res: Response) {
  // No cached response may authorize a withdrawn or superseded card.
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ error: 'Method not allowed' }); return; }
  try { res.status(200).json(buildFeed(edition as Publication)); }
  catch { res.status(503).json({ error: 'The reviewed edition is temporarily unavailable.' }); }
}

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import { buildCombinedFeed } from './src/lib/publisher-feed';
import type { PublisherSnapshot } from './src/lib/publisher-feed';
// Local development serves the same combined contract as /api/stories. It never fetches publisher feeds.
// An optional, git-ignored content/publisher-feed.local.json snapshot can be used to preview the lane.
async function json(path: string) { return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8')); }
export default defineConfig({ plugins: [react(), {
  name: 'local-reviewed-feed',
  configureServer(server) {
    server.middlewares.use('/api/stories', async (req, res) => {
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed' })); return; }
      try {
        const [edition, feeds, control] = await Promise.all([json('./content/edition.json'), json('./config/feeds.json'), json('./config/publisher-feed.json')]);
        const snapshot: PublisherSnapshot | null = await json('./content/publisher-feed.local.json').catch(() => null);
        res.end(JSON.stringify(buildCombinedFeed(edition, { snapshot, status: snapshot ? 'ok' : 'unavailable' }, control, feeds.sources, new Date().toISOString(), { subjectPhotos: new URL(req.url ?? '/', 'http://localhost').searchParams.get('photos') === 'subjects-v1' })));
      } catch { res.statusCode = 503; res.end(JSON.stringify({ error: 'Edition unavailable' })); }
    });
  },
}] });

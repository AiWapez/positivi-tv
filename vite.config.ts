import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import { buildFeed } from './src/lib/publication';
export default defineConfig({ plugins: [react(), {
  name: 'local-reviewed-feed',
  configureServer(server) {
    server.middlewares.use('/api/stories', async (req, res) => {
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed' })); return; }
      try { const edition = JSON.parse(await readFile(new URL('./content/edition.json', import.meta.url), 'utf8')); res.end(JSON.stringify(buildFeed(edition))); }
      catch { res.statusCode = 503; res.end(JSON.stringify({ error: 'Edition unavailable' })); }
    });
  },
}] });

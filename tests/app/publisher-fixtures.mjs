import { BlobPreconditionFailedError } from '@vercel/blob';
// Synthetic publishers and feeds only. No real feed content is stored in tests.
export const NOW = '2026-10-14T10:00:00.000Z';
export const DAY = 86400000;
export const ago = days => new Date(Date.parse(NOW) - days * DAY).toISOString();
export const permission = (overrides = {}) => ({
  enabled: true, category: 'Planet', summary: false, retentionDays: 7, licenseOrTerms: 'Synthetic test terms',
  policyUrl: 'https://alpha.example.org/terms', checkedAt: '2026-10-14', permittedFields: ['title', 'link', 'pubDate'],
  attribution: 'Synthetic', exceptions: 'None', ...overrides,
});
export const sources = (overrides = {}) => ({
  alpha: { id: 'alpha', displayName: 'Alpha News', domains: ['alpha.example.org'], enabled: true, publisherFeed: permission() },
  beta: { id: 'beta', displayName: 'Beta Science', domains: ['beta.example.org'], enabled: true, publisherFeed: permission({ category: 'Science', summary: true, retentionDays: 30 }) },
  ...overrides,
});
export const feeds = () => [
  { id: 'alpha', url: 'https://alpha.example.org/feed/', allowedDomains: ['alpha.example.org'], topic: 'animals_nature', fetchPolicyRef: 'https://alpha.example.org/terms', lanes: ['publisher_feed'] },
  { id: 'beta', url: 'https://beta.example.org/feed/', allowedDomains: ['beta.example.org'], topic: 'science_space', fetchPolicyRef: 'https://beta.example.org/terms', lanes: ['publisher_feed'] },
];
export const control = (overrides = {}) => ({ enabled: true, windowDays: 7, maxItems: 120, maxPerSource: 40, staleAfterHours: 48, locationResolver: 'headline_country', withdrawn: [], ...overrides });
export const rss = items => '<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>' + items.map(i =>
  '<item>' + Object.entries(i).map(([k, v]) => `<${k}><![CDATA[${v}]]></${k}>`).join('') + '</item>').join('') + '</channel></rss>';
export const item = (host, slug, title, overrides = {}) => ({ title, link: `https://${host}/articles/${slug}`,
  pubDate: new Date(Date.parse(NOW) - DAY).toUTCString(), description: 'A short synthetic description of the story.', ...overrides });
export function candidate(sourceId, slug, title, overrides = {}) {
  const host = sourceId + '.example.org';
  return { id: `${sourceId}-${slug}`, sourceId, url: `https://${host}/articles/${slug}`, title, body: 'Synthetic description.',
    publishedAt: ago(1), firstRetrievedAt: NOW, ...overrides };
}
/** A fetcher that serves synthetic XML by feed URL and records every URL it is asked for. */
export function fakeFetcher(byUrl) {
  const calls = [];
  const fetcher = async url => {
    calls.push(url);
    if (url.endsWith('/robots.txt')) return { text: 'User-agent: *\nAllow: /' };
    const body = byUrl[url];
    if (body instanceof Error) throw body;
    if (typeof body !== 'string') throw Object.assign(new Error('HTTP_404'), { code: 'HTTP_404' });
    return { text: body };
  };
  return { fetcher, calls };
}
/** In-memory model of the Vercel Blob operations used, including allowOverwrite and ETag preconditions. */
export function memoryBlob() {
  const objects = new Map(); let n = 0;
  const stream = text => new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(text)); c.close(); } });
  const api = {
    objects, ops: [],
    async get(path, options) { api.ops.push(['get', path, options.useCache]); const o = objects.get(path); return o ? { statusCode: 200, stream: stream(o.body), blob: { etag: o.etag } } : null; },
    async put(path, body, options) {
      api.ops.push(['put', path]);
      const existing = objects.get(path);
      if (options.ifMatch !== undefined && (!existing || existing.etag !== options.ifMatch)) throw new BlobPreconditionFailedError();
      if (existing && options.ifMatch === undefined && !options.allowOverwrite) throw new Error('Vercel Blob: This blob already exists');
      const etag = '"e' + (++n) + '"'; objects.set(path, { body, etag, uploadedAt: api.uploadedAt ?? new Date(), options }); return { pathname: path, etag };
    },
    async del(path, options = {}) {
      api.ops.push(['del', path]);
      const existing = objects.get(path);
      if (options.ifMatch && existing && existing.etag !== options.ifMatch) throw new BlobPreconditionFailedError();
      objects.delete(path);
    },
    async head(path) { const o = objects.get(path); if (!o) { const e = new Error('not found'); e.name = 'BlobNotFoundError'; throw e; } return { etag: o.etag, uploadedAt: o.uploadedAt }; },
  };
  return api;
}
export function response() {
  const state = { code: 0, data: null, headers: {} };
  const res = { setHeader: (k, v) => { state.headers[k] = v; }, status: c => { state.code = c; return res; }, json: d => { state.data = d; } };
  return { res, state };
}

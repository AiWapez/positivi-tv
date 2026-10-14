import { fetchPermittedFeed, parseFeed, plainText } from './collect.mjs';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
/** One RSS request plus one bounded, optional publisher metadata supplement. No visitor path calls this. */
export async function collectPublisherFeed(feed, now, fetcher, pause = delay) {
  const candidates = []; let succeeded = false, failure, warning;
  try {
    const response = await fetchPermittedFeed(feed, fetcher);
    candidates.push(...parseFeed(response.text, feed, now, 100)); succeeded = true;
  } catch (error) { failure = error; }
  if (feed.supplementalUrl && feed.supplementalBylineUrl) {
    try {
      // The publisher advertises a 10-second crawl delay. Keep metadata requests bounded and spaced.
      await pause(10000);
      const response = await fetchPermittedFeed({ ...feed, url: feed.supplementalUrl }, fetcher);
      const rows = JSON.parse(response.text);
      if (!Array.isArray(rows) || rows.length > 100) throw new Error('Invalid metadata batch');
      const ids = [...new Set(rows.flatMap(r => Array.isArray(r?.byline) ? r.byline : []).filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 100);
      const bylineNames = Object.create(null);
      if (ids.length) {
        await pause(10000);
        const url = new URL(feed.supplementalBylineUrl);
        url.searchParams.set('per_page', '100'); url.searchParams.set('include', ids.join(',')); url.searchParams.set('_fields', 'id,name');
        const authors = await fetchPermittedFeed({ ...feed, url: url.href, maxBytes: 512 * 1024 }, fetcher);
        const terms = JSON.parse(authors.text);
        if (!Array.isArray(terms) || terms.length > 100) throw new Error('Invalid bylines');
        for (const term of terms) if (ids.includes(term?.id)) {
          const name = plainText(term?.name);
          if (name && name.length <= 500) bylineNames[term.id] = name;
        }
      }
      candidates.push(...parseFeed(response.text, { ...feed, format: 'wordpress', bylineNames }, now, 100)); succeeded = true;
    } catch (error) { failure = error; warning = 'SUPPLEMENT_UNAVAILABLE'; }
  }
  if (!succeeded) throw failure ?? new Error('Publisher unavailable');
  // Preserve RSS priority, its byline and corrected versions when both endpoints describe one URL.
  const unique = new Map();
  for (const candidate of candidates) if (!unique.has(candidate.id)) unique.set(candidate.id, candidate);
  return { candidates: [...unique.values()], ...(warning ? { warning } : {}) };
}

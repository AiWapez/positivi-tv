import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import robotsParser from 'robots-parser';
import { decodeHTML } from 'entities';
import { safeFetch } from '../src/goodsignal/safe-fetch.node.mjs';
import { canonicalUrl } from '../src/goodsignal/util.ts';
const agent = 'PositiviTV-GoodSignal';
export function plainText(value) {
  const text = typeof value === 'string' ? value : value?.['#text'] ?? '';
  return decodeHTML(String(text).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}
/** RSS content is untrusted data. No model, tool call, approval or guessed event date is generated. */
export function parseFeed(xml, config, now, limit = 10) {
  if (Buffer.byteLength(xml) > 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsupported or oversized XML');
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(xml);
  const raw = parsed.rss?.channel?.item ?? parsed.feed?.entry ?? [];
  const items = Array.isArray(raw) ? raw : [raw], seen = new Set(), candidates = [];
  for (const item of items.slice(0, 500)) {
    const link = typeof item.link === 'string' ? item.link : (Array.isArray(item.link) ? item.link.find(x => !x['@_rel'] || x['@_rel'] === 'alternate') : item.link)?.['@_href'];
    const url = canonicalUrl(link); if (!url || !config.allowedDomains.includes(new URL(url).hostname) || seen.has(url)) continue;
    const time = Date.parse(item.pubDate ?? item.published ?? item.updated ?? '');
    if (!Number.isFinite(time) || time > Date.parse(now) || Date.parse(now) - time > 30 * 86400000) continue;
    const title = plainText(item.title).slice(0, 300), excerpt = plainText(item.description ?? item.summary ?? '').slice(0, 4000);
    if (!title) continue;
    const id = config.id + '-' + createHash('sha256').update(url).digest('hex').slice(0, 24); seen.add(url);
    candidates.push({ id, version: 1, clusterId: id, sourceId: config.id, url, title, summary: null,
      body: excerpt, publishedAt: new Date(time).toISOString(), firstRetrievedAt: now,
      topics: [config.topic], stage: 'none', frame: 'other', researchStage: 'none', eventDate: null, originDate: null,
      outcomeQuote: null, quantities: [], evidence: { level: 0, checkedBy: null, links: [url], note: '' },
      location: { kind: 'unknown', points: [] }, entities: [], humanStory: false, impact: 0, status: 'pending' });
  }
  return candidates.sort((a,b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id)).slice(0, limit);
}
export async function fetchPermittedFeed(config, fetcher = safeFetch) {
  const robots = new Map();
  const permitted = async url => !!config.fetchPolicyRef && config.allowedDomains.includes(new URL(url).hostname);
  const robotsAllowed = async url => {
    const origin = new URL(url).origin;
    if (!robots.has(origin)) {
      const policy = await fetcher(origin + '/robots.txt', { allowedDomains: config.allowedDomains, permitted, robotsAllowed: async () => true, maxBytes: 128 * 1024 });
      robots.set(origin, robotsParser(origin + '/robots.txt', policy.text));
    }
    return robots.get(origin).isAllowed(url, agent) === true;
  };
  return fetcher(config.url, { allowedDomains: config.allowedDomains, permitted, robotsAllowed, maxBytes: 1024 * 1024 });
}
export async function collectCandidates(configs, now = new Date().toISOString(), fetcher = safeFetch) {
  const candidates = [], errors = [], seen = new Set();
  for (const config of configs) {
    try {
      const response = await fetchPermittedFeed(config, fetcher);
      for (const candidate of parseFeed(response.text, config, now)) if (!seen.has(candidate.url) && candidates.length < 10) { seen.add(candidate.url); candidates.push(candidate); }
    } catch (error) { errors.push({ sourceId: config.id, code: String(error.code ?? error.message).slice(0, 120) }); }
    if (candidates.length >= 10) break;
  }
  return { schemaVersion: 1, collectedAt: now, candidates, errors };
}

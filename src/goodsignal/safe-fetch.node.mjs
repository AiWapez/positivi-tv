import { resolve4, resolve6 } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { canonicalUrl } from './util.ts';

const blocked = new BlockList();
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]) blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [['2001::',23],['2001:db8::',32],['2002::',16]]) blocked.addSubnet(address, prefix, 'ipv6');
const global6 = new BlockList(); global6.addSubnet('2000::', 3, 'ipv6');
export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  if (family === 6) return global6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
  return false;
}
async function resolveHost(host) {
  const rs = await Promise.allSettled([resolve4(host), resolve6(host)]);
  return rs.flatMap(r => r.status === 'fulfilled' ? r.value : []).map(address => ({ address, family: isIP(address) }));
}
export class FetchFailure extends Error {
  constructor(code, transient = false) { super(code); this.code = code; this.transient = transient; }
}
function requestPinned(url, address, { timeoutMs, maxBytes }) {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, {
      family: address.family, autoSelectFamily: false,
      headers: { 'User-Agent': 'PositiviTV-GoodSignal/0.1', Accept: 'text/html, application/rss+xml, application/atom+xml', 'Accept-Encoding': 'identity' },
      // The TLS hostname remains the original host. DNS is pinned to the address checked above.
      lookup(_host, _options, callback) { callback(null, address.address, address.family); },
    }, res => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) { res.destroy(); resolve({ status, location: res.headers.location }); return; }
      if (status < 200 || status >= 300) { res.destroy(); reject(new FetchFailure('HTTP_' + status, status === 429 || status >= 500)); return; }
      const type = String(res.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
      if (!['text/plain', 'text/html', 'application/rss+xml', 'application/atom+xml', 'application/xml', 'text/xml'].includes(type)) { res.destroy(); reject(new FetchFailure('CONTENT_TYPE_BLOCKED')); return; }
      // No decompression: both encoded and decoded response limits remain identical.
      if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') { res.destroy(); reject(new FetchFailure('ENCODING_BLOCKED')); return; }
      if (Number(res.headers['content-length']) > maxBytes) { res.destroy(); reject(new FetchFailure('RESPONSE_TOO_LARGE')); return; }
      const chunks = []; let bytes = 0;
      res.on('data', chunk => { bytes += chunk.length; if (bytes > maxBytes) { res.destroy(new FetchFailure('RESPONSE_TOO_LARGE')); return; } chunks.push(chunk); });
      res.on('end', () => resolve({ status, text: Buffer.concat(chunks).toString('utf8'), contentType: type }));
      res.on('error', reject);
    });
    const timer = setTimeout(() => req.destroy(new FetchFailure('TIMEOUT', true)), timeoutMs);
    req.on('close', () => clearTimeout(timer)); req.on('error', reject); req.end();
  });
}
/** Explicit permission and robots adapters are mandatory; there are no live default sources. */
export async function safeFetch(raw, options) {
  const { allowedDomains, permitted, robotsAllowed, resolve = resolveHost, request = requestPinned,
    maxBytes = 2 * 1024 * 1024, timeoutMs = 10_000, maxRedirects = 5 } = options ?? {};
  if (!Array.isArray(allowedDomains) || !allowedDomains.length || typeof permitted !== 'function' || typeof robotsAllowed !== 'function'
    || !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 2 * 1024 * 1024 || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000
    || !Number.isInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 5) throw new FetchFailure('INVALID_FETCH_POLICY');
  let url = canonicalUrl(raw); const deadline = Date.now() + timeoutMs;
  async function bounded(task) {
    const ms = deadline - Date.now(); if (ms <= 0) throw new FetchFailure('TIMEOUT', true);
    let timer;
    try { return await Promise.race([Promise.resolve().then(task), new Promise((_, reject) => { timer = setTimeout(() => reject(new FetchFailure('TIMEOUT', true)), ms); })]); }
    finally { clearTimeout(timer); }
  }
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!url || !allowedDomains.includes(new URL(url).hostname)) throw new FetchFailure('DOMAIN_BLOCKED');
    if (!await bounded(() => permitted(url)) || !await bounded(() => robotsAllowed(url))) throw new FetchFailure('FETCH_NOT_PERMITTED');
    const addresses = await bounded(() => resolve(new URL(url).hostname));
    if (!Array.isArray(addresses) || !addresses.length || addresses.some(a => !isPublicAddress(a.address) || a.family !== isIP(a.address))) throw new FetchFailure('DNS_ADDRESS_BLOCKED');
    const response = await bounded(() => request(url, addresses[0], { maxBytes, timeoutMs: deadline - Date.now() }));
    if (response.status >= 300 && response.status < 400) {
      if (!response.location || hop === maxRedirects) throw new FetchFailure('REDIRECT_LIMIT');
      try { url = canonicalUrl(new URL(response.location, url).toString()); } catch { throw new FetchFailure('INVALID_REDIRECT'); }
      continue;
    }
    return { ...response, url };
  }
  throw new FetchFailure('REDIRECT_LIMIT');
}

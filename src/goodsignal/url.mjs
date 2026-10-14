/** URL syntax gate only; network adapters still check resolved addresses.
 * @param {string} raw
 * @returns {string | null}
 */
export function canonicalUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
    const h = u.hostname.toLowerCase();
    if (!h.includes('.') || h.endsWith('.') || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(h)
      || h.includes(':') || /^\d+(?:\.\d+)*$/.test(h)) return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ['fbclid', 'gclid', 'msclkid'].includes(key.toLowerCase())) u.searchParams.delete(key);
    }
    u.searchParams.sort(); return u.toString();
  } catch { return null; }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicAddress, safeFetch, FetchFailure } from '../../src/goodsignal/safe-fetch.node.mjs';
const publicDNS = async () => [{ address: '8.8.8.8', family: 4 }];
function options(overrides = {}) {
  return { allowedDomains: ['news.example.org'], permitted: async () => true, robotsAllowed: async () => true,
    resolve: publicDNS, request: async () => ({ status: 200, text: 'Synthetic article', contentType: 'text/html' }), ...overrides };
}
test('private, reserved, mapped, and metadata addresses are blocked', () => {
  for (const ip of ['127.0.0.1','10.1.2.3','172.31.0.1','192.168.1.1','169.254.169.254','0.0.0.0','100.64.0.1','192.0.2.1','198.51.100.2','203.0.113.1','224.0.0.1','::1','::ffff:127.0.0.1','::ffff:8.8.8.8','fc00::1','fe80::1','2001:db8::1','2002:7f00:1::1'])
    assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});
test('DNS answer is checked before transport sees it', async () => {
  let called = false;
  await assert.rejects(() => safeFetch('https://news.example.org/article', options({ resolve: async () => [{ address: '10.0.0.1', family: 4 }], request: async () => { called = true; } })), /DNS_ADDRESS_BLOCKED/);
  assert.equal(called, false);
});
test('mixed public/private answers are rejected', async () => {
  await assert.rejects(() => safeFetch('https://news.example.org/article', options({ resolve: async () => [{ address: '8.8.8.8', family: 4 }, { address: '::1', family: 6 }] })), /DNS_ADDRESS_BLOCKED/);
});
test('transport receives the pinned checked address', async () => {
  const result = await safeFetch('https://news.example.org/article?utm_source=x', options({ request: async (url, address) => {
    assert.equal(address.address, '8.8.8.8'); assert.equal(url, 'https://news.example.org/article');
    return { status: 200, text: 'Synthetic article' };
  } }));
  assert.equal(result.url, 'https://news.example.org/article');
});
test('redirect destination must be on the explicit allowlist', async () => {
  await assert.rejects(() => safeFetch('https://news.example.org/a', options({ request: async () => ({ status: 302, location: 'https://other.example.org/a' }) })), /DOMAIN_BLOCKED/);
});
test('DNS is rechecked after each redirect', async () => {
  let lookups = 0;
  await assert.rejects(() => safeFetch('https://news.example.org/a', options({
    resolve: async () => ++lookups === 1 ? [{ address: '8.8.8.8', family: 4 }] : [{ address: '169.254.169.254', family: 4 }],
    request: async () => ({ status: 302, location: '/b' }),
  })), /DNS_ADDRESS_BLOCKED/);
  assert.equal(lookups, 2);
});
test('redirect loops stop at the configured cap', async () => {
  await assert.rejects(() => safeFetch('https://news.example.org/a', options({ maxRedirects: 1, request: async () => ({ status: 302, location: '/a' }) })), /REDIRECT_LIMIT/);
});
test('permissions and robots policies both fail closed', async () => {
  await assert.rejects(() => safeFetch('https://news.example.org/a', options({ permitted: async () => false })), /FETCH_NOT_PERMITTED/);
  await assert.rejects(() => safeFetch('https://news.example.org/a', options({ robotsAllowed: async () => false })), /FETCH_NOT_PERMITTED/);
  await assert.rejects(() => safeFetch('https://news.example.org/a', {}), /INVALID_FETCH_POLICY/);
});
test('temporary HTTP failures remain retryable operational failures', () => {
  const e = new FetchFailure('HTTP_503', true); assert.equal(e.transient, true);
});
test('literal private targets cannot enter transport', async () => {
  await assert.rejects(() => safeFetch('https://127.0.0.1/a', options({ allowedDomains: ['127.0.0.1'] })), /DOMAIN_BLOCKED/);
});

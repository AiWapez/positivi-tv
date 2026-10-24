import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import shipped from '../../config/visit-counter.json' with { type: 'json' };
import { createVisitHandler } from '../../api/visit.ts';
import { createVisitsHandler } from '../../api/visits.ts';
import {
  parseVisitConfig, visitCounterOn, parsePause, createPauseReader, storeAccess, readSmallBody, validTickBody, createRateGate, dayKey, totalKey, utcDay,
} from '../../server/visit-counter.ts';
import { claimTodaysTick, parseVisits, VISIT_TICK_KEY } from '../../src/lib/visit-counter.ts';

const ORIGIN = 'https://positivi-tv.vercel.app';
const T0 = Date.parse('2026-10-24T12:00:00Z');
const ON = { ...shipped, enabled: true, dailyCeiling: 3 };
const ENV = { KV_REST_API_URL: 'https://example-123.upstash.io', KV_REST_API_TOKEN: 'synthetic-write-token', KV_REST_API_READ_ONLY_TOKEN: 'synthetic-read-token' };

function reply() {
  const state = { code: 0, body: undefined, ended: false, headers: {} };
  const res = { setHeader: (k, v) => { state.headers[k] = v; }, status: c => { state.code = c; return res; }, json: d => { state.body = d; state.ended = true; }, end: () => { state.ended = true; } };
  return { res, state };
}
function post(body = '{"v":1}', over = {}) {
  const headers = { origin: ORIGIN, 'content-type': 'application/json', ...(over.headers ?? {}) };
  return { method: 'POST', url: '/api/visit', ...over, headers, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(body); } };
}
function store(answers) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    const next = typeof answers === 'function' ? answers(calls.length) : answers;
    if (next instanceof Error) throw next;
    return { ok: next.ok ?? true, status: next.status ?? 200, json: async () => next.rows };
  };
  return { calls, fetcher };
}
const rows = (day, total) => ({ rows: [{ result: day }, { result: total }] });
async function run(handler, req) { const { res, state } = reply(); await handler(req, res); return state; }
function tickHandler(over = {}, answers = rows(1, 1)) {
  const s = store(answers); let clock = over.clock ?? T0;
  const handler = createVisitHandler({ config: ON, readPause: async () => false, env: ENV, fetcher: s.fetcher, now: () => clock, ...over });
  return { handler, calls: s.calls, setClock: v => { clock = v; } };
}

test('the shipped config is valid and OFF: not enabled, no ceiling, production origin only', () => {
  const config = parseVisitConfig(shipped);
  assert.ok(config);
  assert.equal(config.enabled, false);
  assert.equal(config.dailyCeiling, 0);
  assert.deepEqual(config.allowedOrigins, [ORIGIN]);
  assert.equal(visitCounterOn(config), false);
  assert.equal(visitCounterOn({ ...config, enabled: true }), false, 'a ceiling of 0 keeps it off even when enabled');
  assert.equal(visitCounterOn({ ...config, enabled: true, dailyCeiling: 1 }), true);
});

test('config parsing is strict: extra keys, wrong types, bad origins and bad prefixes all mean off', () => {
  assert.equal(parseVisitConfig(null), null);
  assert.equal(parseVisitConfig({ ...shipped, extra: 1 }), null);
  assert.equal(parseVisitConfig({ ...shipped, enabled: 'yes' }), null);
  assert.equal(parseVisitConfig({ ...shipped, dailyCeiling: -1 }), null);
  assert.equal(parseVisitConfig({ ...shipped, dailyCeiling: 1.5 }), null);
  assert.equal(parseVisitConfig({ ...shipped, perCopyPerMinute: 0 }), null);
  assert.equal(parseVisitConfig({ ...shipped, allowedOrigins: [] }), null);
  assert.equal(parseVisitConfig({ ...shipped, allowedOrigins: ['http://positivi-tv.vercel.app'] }), null);
  assert.equal(parseVisitConfig({ ...shipped, allowedOrigins: ['https://x.example/path'] }), null);
  assert.equal(parseVisitConfig({ ...shipped, keyPrefix: 'Bad Prefix' }), null);
});

test('while off, every request is an empty 204 and the store is never called', async () => {
  const s = store(rows(1, 1));
  const handler = createVisitHandler({ config: shipped, readPause: async () => { throw new Error('must not be read'); }, env: ENV, fetcher: s.fetcher, now: () => T0 });
  const out = await run(handler, post());
  assert.equal(out.code, 204);
  assert.equal(out.body, undefined);
  assert.equal(s.calls.length, 0);
  const bad = createVisitHandler({ config: { nonsense: true }, readPause: async () => false, env: ENV, fetcher: s.fetcher });
  assert.equal((await run(bad, post())).code, 204);
  assert.equal(s.calls.length, 0);
});

test('an accepted tick is written before the answer, as one pipeline: INCR the day, then INCR the total', async () => {
  const { handler, calls } = tickHandler();
  const out = await run(handler, post());
  assert.equal(out.code, 204);
  assert.equal(out.body, undefined);
  assert.equal(out.headers['Cache-Control'], 'no-store, max-age=0');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example-123.upstash.io/pipeline');
  assert.deepEqual(JSON.parse(calls[0].init.body), [['INCR', 'positivitv:visits:day:2026-10-24'], ['INCR', 'positivitv:visits:total']]);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer synthetic-write-token');
});

test('every rejection is the same empty 204 and writes nothing', async () => {
  const cases = {
    'GET instead of POST': post('{"v":1}', { method: 'GET' }),
    'query string': post('{"v":1}', { url: '/api/visit?x=1' }),
    'no origin': post('{"v":1}', { headers: { origin: undefined } }),
    'other origin': post('{"v":1}', { headers: { origin: 'https://evil.example' } }),
    'preview origin': post('{"v":1}', { headers: { origin: 'https://positivi-tv-git-x-aiwapezs-projects.vercel.app' } }),
    'content type with charset': post('{"v":1}', { headers: { 'content-type': 'application/json; charset=utf-8' } }),
    'text content type': post('{"v":1}', { headers: { 'content-type': 'text/plain' } }),
    'not JSON': post('hello'),
    'empty body': post(''),
    'no body': post(null),
    'wrong version': post('{"v":2}'),
    'extra key': post('{"v":1,"a":1}'),
    'array body': post('[1]'),
    'too big': post('{"v":1,"pad":"' + 'x'.repeat(80) + '"}'),
  };
  for (const [name, req] of Object.entries(cases)) {
    const { handler, calls } = tickHandler();
    const out = await run(handler, req);
    assert.equal(out.code, 204, name);
    assert.equal(out.body, undefined, name);
    assert.equal(calls.length, 0, name);
  }
});

test('a body larger than 64 bytes stops being read at the limit', async () => {
  let pulled = 0;
  const req = { async *[Symbol.asyncIterator]() { for (let i = 0; i < 100; i++) { pulled++; yield Buffer.alloc(20, 'a'); } } };
  assert.equal(await readSmallBody(req), null);
  assert.ok(pulled <= 4, 'stopped after ' + pulled + ' chunks');
  assert.equal(await readSmallBody({ body: { v: 1 } }), '{"v":1}', 'a body the platform already parsed is accepted when it is just as small');
  assert.equal(await readSmallBody({ body: { v: 'x'.repeat(100) } }), null);
  assert.equal(validTickBody('{"v":1}'), true);
  assert.equal(validTickBody(null), false);
});

test('the pause switch stops counting, and a pause that cannot be read fails closed', async () => {
  const paused = tickHandler({ readPause: async () => true });
  assert.equal((await run(paused.handler, post())).code, 204);
  assert.equal(paused.calls.length, 0);
  const throwing = tickHandler({ readPause: async () => { throw new Error('boom'); } });
  assert.equal((await run(throwing.handler, post())).code, 204);
  assert.equal(throwing.calls.length, 0);
});

test('pause reader: not connected = file decides; unreadable or invalid = paused; last good value is kept through an outage', async () => {
  assert.equal(await createPauseReader(null)(), false);
  assert.equal(await createPauseReader(async () => { throw new Error('down'); })(), true);
  assert.equal(await createPauseReader(async () => ({ visitCounterOff: 'yes' }))(), true);
  assert.equal(await createPauseReader(async () => 'junk')(), true);
  assert.equal(await createPauseReader(async () => ({}))(), false);
  assert.equal(await createPauseReader(async () => ({ visitCounterOff: true }))(), true);
  assert.equal(parsePause({ visitCounterOff: false }), false);
  assert.equal(parsePause([]), null);
  let now = 0, fail = false, value = false;
  const read = createPauseReader(async () => { if (fail) throw new Error('down'); return { visitCounterOff: value }; }, { okTtlMs: 10, failTtlMs: 10, clock: () => now });
  assert.equal(await read(), false);
  fail = true; now = 20;
  assert.equal(await read(), false, 'unreachable keeps the last good answer');
  fail = false; value = 'bad'; now = 40;
  assert.equal(await read(), true, 'a value that is read but not understood pauses');
  fail = true; now = 60;
  assert.equal(await read(), true, 'and an outage does not bring back an older good answer');
});

test('the store address must be an https upstash.io host with no credentials, port, path or query', () => {
  assert.ok(storeAccess('write', ENV));
  for (const url of ['http://example-123.upstash.io', 'https://evil.example', 'https://user:pw@example-123.upstash.io', 'https://example-123.upstash.io:8443', 'https://example-123.upstash.io/path', 'https://example-123.upstash.io/?a=1', 'not a url', '']) {
    assert.equal(storeAccess('write', { ...ENV, KV_REST_API_URL: url }), null, url);
  }
  assert.equal(storeAccess('write', { KV_REST_API_URL: ENV.KV_REST_API_URL }), null);
  assert.equal(storeAccess('read', { KV_REST_API_URL: ENV.KV_REST_API_URL, KV_REST_API_TOKEN: 'x' }), null, 'the read path never falls back to the write token');
});

test('a missing write token, a store error, a store that answers oddly, or a thrown fetch all end quietly', async () => {
  const noToken = tickHandler({ env: { KV_REST_API_URL: ENV.KV_REST_API_URL } });
  assert.equal((await run(noToken.handler, post())).code, 204);
  assert.equal(noToken.calls.length, 0);
  for (const answer of [{ ok: false, status: 500, rows: [] }, { rows: 'junk' }, { rows: [{ result: 1 }] }, { rows: [{ error: 'ERR' }, { result: 1 }] }, { rows: [{ result: -4 }, { result: 1 }] }, new Error('network')]) {
    const t = tickHandler({}, answer);
    const out = await run(t.handler, post());
    assert.equal(out.code, 204);
    assert.equal(out.body, undefined);
  }
});

test('hard daily ceiling: once the day count passes it, nothing more is written until the next UTC day', async () => {
  let day = 0;
  const s = store(() => { day++; return rows(day, day + 100); });
  let clock = T0;
  const handler = createVisitHandler({ config: ON, readPause: async () => false, env: ENV, fetcher: s.fetcher, now: () => clock });
  for (let i = 0; i < 3; i++) await run(handler, post());
  assert.equal(s.calls.length, 3, 'three ticks up to the ceiling are written');
  await run(handler, post());
  assert.equal(s.calls.length, 4, 'the fourth learns the ceiling is passed');
  for (let i = 0; i < 20; i++) await run(handler, post());
  assert.equal(s.calls.length, 4, 'then this copy writes nothing more that day');
  clock = Date.parse('2026-10-25T00:00:01Z'); day = 0;
  await run(handler, post());
  assert.equal(s.calls.length, 5, 'a new UTC day starts again');
  assert.equal(JSON.parse(s.calls[4].init.body)[0][1], 'positivitv:visits:day:2026-10-25');
});

test('per-copy cap: more than the allowed ticks in one minute are dropped quietly', async () => {
  let clock = T0;
  const allow = createRateGate(2, () => clock);
  assert.deepEqual([allow(), allow(), allow()], [true, true, false]);
  clock += 61_000;
  assert.equal(allow(), true);
  const t = tickHandler({ config: { ...ON, perCopyPerMinute: 2, dailyCeiling: 1000 } });
  for (let i = 0; i < 5; i++) await run(t.handler, post());
  assert.equal(t.calls.length, 2);
});

test('the tick endpoint reads only the Origin and Content-Type headers', async () => {
  const seen = new Set();
  const headers = new Proxy({ origin: ORIGIN, 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9', referer: 'https://reddit.example/', 'user-agent': 'UA' },
    { get: (target, key) => { seen.add(String(key)); return target[key]; } });
  const { handler, calls } = tickHandler();
  const out = await run(handler, { method: 'POST', url: '/api/visit', headers, async *[Symbol.asyncIterator]() { yield Buffer.from('{"v":1}'); } });
  assert.equal(out.code, 204);
  assert.equal(calls.length, 1);
  assert.deepEqual([...seen].sort(), ['content-type', 'origin']);
  const sent = JSON.stringify(calls[0]);
  for (const secret of ['203.0.113.9', 'reddit.example', 'UA']) assert.ok(!sent.includes(secret), secret + ' must never reach the store');
});

test('the counter code never touches IP, Referer, User-Agent or socket details, and never logs request data', () => {
  for (const file of ['server/visit-counter.ts', 'api/visit.ts', 'api/visits.ts', 'src/lib/visit-counter.ts', 'src/hooks/useVisitCounter.ts']) {
    const text = readFileSync(new URL('../../' + file, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const word of ['x-forwarded', 'x-real-ip', 'referer', 'referrer', 'user-agent', 'remoteAddress', 'socket', 'cf-connecting', 'req.headers.host', 'x-vercel']) {
      assert.ok(!text.toLowerCase().includes(word.toLowerCase()), file + ' mentions ' + word);
    }
  }
  const text = readFileSync(new URL('../../server/visit-counter.ts', import.meta.url), 'utf8');
  const logs = text.split('\n').filter(l => l.includes('console.'));
  assert.equal(logs.length, 2);
  assert.ok(logs.some(l => l.includes("console.error('visit-counter store status', response.status)")), 'one log line prints a status code');
  assert.ok(logs.some(l => l.includes("console.error('visit-counter store unreachable')")), 'one log line prints a fixed message');
});

test('/api/visits: GET only, no query, exactly two numbers, read-only token only, cached for a minute', async () => {
  const s = store(rows(7, 1234));
  const guarded = new Proxy({ KV_REST_API_URL: ENV.KV_REST_API_URL, KV_REST_API_READ_ONLY_TOKEN: ENV.KV_REST_API_READ_ONLY_TOKEN }, {
    get: (target, key) => { if (key === 'KV_REST_API_TOKEN') throw new Error('the read path must never touch the write token'); return target[key]; },
  });
  const handler = createVisitsHandler({ config: ON, readPause: async () => false, env: guarded, fetcher: s.fetcher, now: () => T0 });
  const out = await run(handler, { method: 'GET', url: '/api/visits' });
  assert.equal(out.code, 200);
  assert.deepEqual(out.body, { today: 3, total: 1234 }, 'today is clamped to the ceiling');
  assert.deepEqual(Object.keys(out.body).sort(), ['today', 'total']);
  assert.equal(out.headers['Cache-Control'], 'public, s-maxage=60, stale-while-revalidate=300');
  assert.deepEqual(JSON.parse(s.calls[0].init.body), [['GET', 'positivitv:visits:day:2026-10-24'], ['GET', 'positivitv:visits:total']]);
  assert.equal(s.calls[0].init.headers.Authorization, 'Bearer synthetic-read-token');
  const post405 = await run(handler, { method: 'POST', url: '/api/visits' });
  assert.equal(post405.code, 405);
  assert.equal(post405.body, undefined);
  const query = await run(handler, { method: 'GET', url: '/api/visits?x=1' });
  assert.equal(query.code, 400);
  assert.equal(query.body, undefined);
  assert.equal(s.calls.length, 1, 'neither refusal reached the store');
});

test('/api/visits: off, paused, or no read token = both null and no store call; a store failure serves the last numbers or null, never error text', async () => {
  const s = store(rows(1, 2));
  const off = createVisitsHandler({ config: shipped, readPause: async () => false, env: ENV, fetcher: s.fetcher });
  assert.deepEqual((await run(off, { method: 'GET', url: '/api/visits' })).body, { today: null, total: null });
  const paused = createVisitsHandler({ config: ON, readPause: async () => true, env: ENV, fetcher: s.fetcher });
  assert.deepEqual((await run(paused, { method: 'GET', url: '/api/visits' })).body, { today: null, total: null });
  const noRead = createVisitsHandler({ config: ON, readPause: async () => false, env: { KV_REST_API_URL: ENV.KV_REST_API_URL, KV_REST_API_TOKEN: ENV.KV_REST_API_TOKEN }, fetcher: s.fetcher });
  assert.deepEqual((await run(noRead, { method: 'GET', url: '/api/visits' })).body, { today: null, total: null });
  assert.equal(s.calls.length, 0);
  let fail = false;
  const flaky = createVisitsHandler({ config: ON, readPause: async () => false, env: ENV, now: () => T0,
    fetcher: async () => { if (fail) throw new Error('down'); return { ok: true, status: 200, json: async () => rows(1, 2).rows }; } });
  assert.deepEqual((await run(flaky, { method: 'GET', url: '/api/visits' })).body, { today: 1, total: 2 });
  fail = true;
  const again = await run(flaky, { method: 'GET', url: '/api/visits' });
  assert.equal(again.code, 200);
  assert.deepEqual(again.body, { today: 1, total: 2 });
  const cold = createVisitsHandler({ config: ON, readPause: async () => false, env: ENV, fetcher: async () => { throw new Error('down'); } });
  assert.deepEqual((await run(cold, { method: 'GET', url: '/api/visits' })).body, { today: null, total: null });
});

test('key names are one per UTC day plus one running total', () => {
  const config = parseVisitConfig(shipped);
  assert.equal(dayKey(config, T0), 'positivitv:visits:day:2026-10-24');
  assert.equal(totalKey(config), 'positivitv:visits:total');
  assert.equal(utcDay(Date.parse('2026-10-24T23:59:59Z')), '2026-10-24');
});

test('browser: one tick per UTC day, and a storage that throws or does not keep the value sends nothing', () => {
  const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); }, m }; };
  const s = memory();
  assert.equal(claimTodaysTick(s, T0), true);
  assert.equal(s.m.get(VISIT_TICK_KEY), '2026-10-24');
  assert.equal(claimTodaysTick(s, T0 + 3600_000), false, 'a reload the same day is not counted');
  assert.equal(claimTodaysTick(s, Date.parse('2026-10-25T00:00:01Z')), true, 'the next UTC day counts again');
  assert.equal(claimTodaysTick(null, T0), false);
  assert.equal(claimTodaysTick({ getItem: () => { throw new Error('blocked'); }, setItem: () => {} }, T0), false);
  assert.equal(claimTodaysTick({ getItem: () => null, setItem: () => { throw new Error('full'); } }, T0), false);
  assert.equal(claimTodaysTick({ getItem: () => null, setItem: () => {} }, T0), false, 'storage that silently drops writes never counts on every load');
});

test('browser: only the exact two-number answer is shown', () => {
  assert.deepEqual(parseVisits({ today: 3, total: 10 }), { today: 3, total: 10 });
  for (const bad of [null, [], {}, { today: null, total: null }, { today: 1 }, { today: 1, total: 2, extra: 3 }, { today: -1, total: 2 }, { today: 1.5, total: 2 }, { today: '1', total: 2 }, 'x']) {
    assert.equal(parseVisits(bad), null);
  }
});

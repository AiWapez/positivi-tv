import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({ entryPoints: [new URL('../../api/stories.ts', import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', write: false });
const { default: handler } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
function request(method) {
  const headers = {}, state = { code: 0, data: null, headers };
  const res = { setHeader: (key,value) => { headers[key] = value; }, status: code => { state.code = code; return res; }, json: data => { state.data = data; } };
  handler({ method },res); return state;
}
test('GET serves the checked-in reviewed edition with a fresh authoritative manifest', () => {
  const { code,data } = request('GET'); assert.equal(code,200); assert.deepEqual(data.stories,[]); assert.equal(data.manifest.version,data.revision);
  assert(Math.abs(Date.now() - Date.parse(data.manifest.generatedAt)) < 1000);
});
test('API response cannot be cached by browser or Vercel CDN', () => {
  const { headers } = request('GET'); for (const key of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control']) assert(headers[key].includes('no-store'));
});
test('public writes and unsupported methods are denied', () => {
  for (const method of ['POST','PUT','DELETE']) { const r = request(method); assert.equal(r.code,405); assert.equal(r.headers.Allow,'GET'); }
});

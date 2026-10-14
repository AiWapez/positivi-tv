import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
test('emitted Node API loads its JSON and rewritten JavaScript dependency paths', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'positivitv-runtime-'));
  try {
    const root = new URL('../../',import.meta.url);
    const result = spawnSync(process.execPath,[new URL('node_modules/typescript/bin/tsc',root).pathname,'--project','tsconfig.runtime.json','--outDir',dir], { cwd: root,encoding:'utf8' });
    assert.equal(result.status,0,result.stdout + result.stderr);
    await writeFile(join(dir,'package.json'),'{"type":"module"}');
    await symlink(new URL('node_modules/',root).pathname,join(dir,'node_modules'),'dir');
    // Vercel transpiles TypeScript but copies existing MJS without rewriting it.
    for (const path of ['server/collect.mjs','server/queue.mjs','src/goodsignal/safe-fetch.node.mjs','src/goodsignal/url.mjs']) await cp(new URL(path,root),join(dir,path));
    const { default: handler } = await import(pathToFileURL(join(dir,'api/stories.js')).href);
    let code, data; const response = { setHeader() {}, status(value) { code = value; return response; }, json(value) { data = value; } };
    handler({ method:'GET' },response); assert.equal(code,200); assert.deepEqual(data.stories,[]); assert(data.manifest.generatedAt);
    const { default: collect } = await import(pathToFileURL(join(dir,'api/collect.js')).href);
    await collect({ method:'GET',headers:{} },response); assert.equal(code,401);
  } finally { await rm(dir,{ recursive:true,force:true }); }
});

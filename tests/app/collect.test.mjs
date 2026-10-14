import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, collectCandidates, fetchPermittedFeed } from '../../server/collect.mjs';
import { queuePath, serializeBatch } from '../../server/queue.mjs';
import collect from '../../api/collect.ts';
const now = '2026-10-14T13:00:00Z';
const config = { id:'test', allowedDomains:['news.example.org'], topic:'science_space',url:'https://news.example.org/feed/',fetchPolicyRef:'https://news.example.org/terms' };
const item = (overrides = {}) => ({ title:'A library opens',link:'https://news.example.org/articles/library',pubDate:'Tue, 13 Oct 2026 12:00:00 GMT', description:'A public library opened. Event date needs review.',...overrides });
const xml = items => '<rss><channel>' + items.map(s => '<item>' + Object.entries(s).map(([key,v]) => `<${key}><![CDATA[${v}]]></${key}>`).join('') + '</item>').join('') + '</channel></rss>';
test('real feed fields become pending candidates without inferred outcomes, dates or geography', () => {
  const [s] = parseFeed(xml([item()]),config,now);
  assert.equal(s.title,'A library opens');assert.equal(s.url,item().link);assert.equal(s.publishedAt,'2026-10-13T12:00:00.000Z');
  assert.equal(s.status,'pending');assert.equal(s.review,undefined);assert.equal(s.eventDate,null);assert.equal(s.stage,'none');assert.equal(s.evidence.level,0);assert.deepEqual(s.location,{kind:'unknown',points:[]});
});
test('tracking variants deduplicate and IDs remain stable across collections', () => {
  const feed = xml([item(),item({link:item().link+'?utm_source=x'})]);
  assert.equal(parseFeed(feed,config,now).length,1);
  assert.equal(parseFeed(feed,config,now)[0].id,parseFeed(feed,config,'2026-10-15T13:00:00Z')[0].id);
});
test('off-domain links and unknown, future or old publication dates do not enter the queue', () => {
  for (const patch of [{link:'https://attacker.example/a'},{pubDate:'nonsense'},{pubDate:'2030-01-01'},{pubDate:'2019-01-01'}]) assert.equal(parseFeed(xml([item(patch)]),config,now).length,0);
});
test('DTD/entity declarations and oversized feeds are refused', () => {
  assert.throws(()=>parseFeed('<!DOCTYPE rss>'+xml([]),config,now));assert.throws(()=>parseFeed('x'.repeat(1024*1024+1),config,now));
});
test('batch has a hard daily cap of 10; the queue cannot contain an approval', () => {
  const candidates = parseFeed(xml(Array.from({length:20},(_,i)=>item({link:item().link+i}))),config,now);
  assert.equal(candidates.length,10);assert.doesNotThrow(()=>serializeBatch({schemaVersion:1,collectedAt:now,candidates}));
  assert.throws(()=>serializeBatch({schemaVersion:1,collectedAt:now,candidates:[{...candidates[0],status:'approved'}]}));
  assert.throws(()=>queuePath('../outside'));
});
test('robots denial prevents fetching feed content', async () => {
  let feedRead = false;
  const fetcher = async (url,options) => {
    if (url.endsWith('/robots.txt')) return {text:'User-agent: *\nDisallow: /feed/'};
    assert.equal(await options.robotsAllowed(url),false);feedRead=true;throw new Error('blocked');
  };
  await assert.rejects(()=>fetchPermittedFeed(config,fetcher));assert.equal(feedRead,true);
});
test('source failures are operational findings and never synthesize replacement news', async () => {
  const batch = await collectCandidates([config],now,async()=>{throw new Error('source unavailable')});
  assert.equal(batch.candidates.length,0);assert.equal(batch.errors.length,1);
});
test('collector API denies missing/wrong secrets before touching storage', async () => {
  const previous=process.env.CRON_SECRET;process.env.CRON_SECRET='synthetic-test-secret';
  try { for (const authorization of [undefined,'Bearer wrong']) { let code,data;const res={setHeader(){},status(n){code=n;return res},json(v){data=v}};await collect({method:'GET',headers:{authorization}},res);assert.equal(code,401);assert.equal(data.error,'Unauthorized'); } }
  finally { previous === undefined ? delete process.env.CRON_SECRET : process.env.CRON_SECRET=previous; }
});

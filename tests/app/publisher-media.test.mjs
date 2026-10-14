import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseFeed } from '../../server/collect.mjs';
import { collectPublisherFeed } from '../../server/publisher-collect.mjs';
import { screenHeadline } from '../../server/publisher-screen.ts';
import { locateFeedOutcome } from '../../server/feed-location.ts';
import { STORY_PHOTOS, photoFields, photoForStory, validStoryImage } from '../../src/lib/story-images.ts';
import { buildSnapshot } from '../../server/publisher-snapshot.ts';
import { projectPublisherFeed } from '../../src/lib/publisher-feed.ts';
import { NOW, sources, control, candidate, rss, item, fakeFetcher } from './publisher-fixtures.mjs';
const feed={id:'alpha',url:'https://alpha.example.org/feed/',allowedDomains:['alpha.example.org'],fetchPolicyRef:'https://alpha.example.org/terms',topic:'animals_nature',supplementalUrl:'https://alpha.example.org/wp-json/posts',supplementalBylineUrl:'https://alpha.example.org/wp-json/byline'};
const post=(patch={})=>({link:'https://alpha.example.org/articles/older',title:{rendered:'Giraffes return to Bicuar National Park'},excerpt:{rendered:'An animal reintroduction.'},date_gmt:'2026-09-23T19:46:09',byline:[42],yoast_head_json:{author:'An editor, not the writer'},...patch});
test('publisher metadata uses original UTC publication dates and explicit byline terms, never SEO author or modified time',()=>{
 const [c]=parseFeed(JSON.stringify([post({modified_gmt:'2026-10-14T10:00:00'})]),{...feed,format:'wordpress',bylineNames:{42:'Actual Writer'}},NOW,100);
 assert.equal(c.author,'Actual Writer');assert.equal(c.publishedAt,'2026-09-23T19:46:09.000Z');assert.equal(c.status,'pending');assert.equal(c.eventDate,null);
 assert.equal(parseFeed(JSON.stringify([post({date_gmt:''})]),{...feed,format:'wordpress',bylineNames:{42:'Actual Writer'}},NOW,100).length,0);
 assert.equal(parseFeed(JSON.stringify([post({link:'https://evil.example/article'})]),{...feed,format:'wordpress'},NOW,100).length,0);
 assert.equal(parseFeed(JSON.stringify([post()]),{...feed,format:'wordpress'},NOW,100)[0].author,null);
 assert.throws(()=>parseFeed('{}',{...feed,format:'wordpress'},NOW));
});
test('RSS and metadata merge without duplicates and use the article byline endpoint, with bounded spacing',async()=>{
 const bylineUrl='https://alpha.example.org/wp-json/byline?per_page=100&include=42&_fields=id%2Cname';
 const {fetcher,calls}=fakeFetcher({[feed.url]:rss([item('alpha.example.org','older','Giraffes return to Bicuar National Park',{'dc:creator':'RSS Writer'})]),[feed.supplementalUrl]:JSON.stringify([post()]),[bylineUrl]:JSON.stringify([{id:42,name:'Actual Writer'}])});
 const delays=[];const result=await collectPublisherFeed(feed,NOW,fetcher,async ms=>{delays.push(ms)});
 assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].author,'RSS Writer');assert.equal(result.warning,undefined);assert.deepEqual(delays,[10000,10000]);assert(calls.includes(bylineUrl));
});
test('a failed metadata supplement keeps working RSS and reports the partial failure',async()=>{
 const {fetcher}=fakeFetcher({[feed.url]:rss([item('alpha.example.org','current','Library opens in Kenya')]),[feed.supplementalUrl]:new Error('Unavailable')});
 const result=await collectPublisherFeed(feed,NOW,fetcher,async()=>{});assert.equal(result.candidates.length,1);assert.equal(result.warning,'SUPPLEMENT_UNAVAILABLE');
});
test('metadata without complete author attribution never lists a licensed-source card',()=>{
 const c=parseFeed(JSON.stringify([post()]),{...feed,format:'wordpress'},NOW,100);
 const ss=sources();ss.alpha.publisherFeed.requiresAuthor=true;ss.alpha.publisherFeed.license={name:'CC BY 4.0',url:'https://creativecommons.org/licenses/by/4.0/'};
 assert.equal(buildSnapshot(null,[{sourceId:'alpha',ok:true,candidates:c}],ss,control({windowDays:30}),NOW).items.length,0);
});
test('regional animal outcomes resolve without assigning Earth locations to space or origins',()=>{
 assert.equal(locateFeedOutcome('Giraffes return to Bicuar National Park','').mapArea.placeId,'ao-bicuar');
 assert.equal(locateFeedOutcome('Preparing Thailand’s rescued leopard cats for life in the wild','').name,'Thailand');
 assert.equal(locateFeedOutcome('Volunteers help protect livestock in Zimbabwe','').name,'Zimbabwe');
 assert.equal(locateFeedOutcome('Thailand’s rescued animals reopen a habitat abroad',''),null);
 assert.equal(locateFeedOutcome('Thailand’s rescued turtles return to Japan',''),null);
 assert.equal(locateFeedOutcome('Scientists find water on Mars','In Zimbabwe, a team worked on the study.'),null);
});
test('deterioration is not a constructive outcome merely because a report reveals or finds it',()=>{
 for(const title of ['New report reveals the environmental cost of habitat destruction','Coral reefs get less time to recover as oceans heat up, report finds'])assert.equal(screenHeadline({title,description:'',defaultCategory:'Planet',now:NOW}).decision,'exclude');
 assert.equal(screenHeadline({title:'Volunteers restore forests in Canada',description:'',defaultCategory:'Planet',now:NOW}).decision,'list');
});
test('every checked photo is bundled, small, licensed and cannot be replaced by an untrusted URL',async()=>{
 for(const photo of STORY_PHOTOS){const bytes=await readFile(new URL('../../public'+photo.path,import.meta.url));assert(bytes.length>1000 && bytes.length<200000);assert(validStoryImage(photoFields(photo)));assert(photo.sourceUrl.startsWith('https://commons.wikimedia.org/'));assert(photo.caption.includes('photo') || photo.caption.includes('illustration'));assert(!validStoryImage({...photoFields(photo),image:'https://evil.example/a.jpg'}));assert(!validStoryImage({...photoFields(photo),imageCredit:null}));}
 assert(!validStoryImage({image:'/assets/unknown.jpg',imageAlt:'',imageCredit:'Unknown',imageContext:'unknown'}));
});
test('public cards carry local photo references while source and event dates stay separate',()=>{
 const settings=control({locationResolver:'supported_feed'}),snapshot=buildSnapshot(null,[{sourceId:'alpha',ok:true,candidates:[candidate('alpha','kelp','Volunteers replant kelp forests in Clayoquot Sound')]}],sources(),settings,NOW);
 const [card]=projectPublisherFeed(snapshot,settings,sources(),NOW).stories;assert.equal(card.imageContext,'clayoquot');assert.equal(card.image,'/assets/stories/clayoquot.jpg');assert.equal(card.eventDate,null);assert.equal(card.attribution,undefined);assert(validStoryImage(card));assert.equal(photoForStory({title:'Perseverance rover reaches milestone',category:'Science'}).id,'rover');
});

test('JSON metadata fetching requires explicit opt-in and keeps the fetcher security policy',async()=>{
 const {safeFetch}=await import('../../src/goodsignal/safe-fetch.node.mjs');const observed=[];
 const options={allowedDomains:['alpha.example.org'],permitted:async()=>true,robotsAllowed:async()=>true,resolve:async()=>[{address:'93.184.216.34',family:4}],request:async(_url,_address,p)=>{observed.push(p.allowJson);return{status:200,text:'[]'}}};
 await safeFetch('https://alpha.example.org/data',options);await safeFetch('https://alpha.example.org/data',{...options,allowJson:true});assert.deepEqual(observed,[false,true]);
 await assert.rejects(()=>safeFetch('https://alpha.example.org/data',{...options,allowJson:'true'}),/INVALID_FETCH_POLICY/);
 const seen=[];const fetcher=async(url,options)=>{if(!url.endsWith('/robots.txt'))seen.push(options.allowJson);return{text:url.endsWith('/robots.txt')?'User-agent: *\nAllow: /':'[]'}};
 const {fetchPermittedFeed}=await import('../../server/collect.mjs');await fetchPermittedFeed(feed,fetcher);await fetchPermittedFeed({...feed,format:'wordpress'},fetcher);assert.deepEqual(seen,[false,true]);
});

test('a real BlobNotFoundError permits a first snapshot and retry after a lock disappears',async()=>{
 const {BlobNotFoundError}=await import('@vercel/blob');const {createPublisherStore}=await import('../../server/publisher-store.ts');
 const store=createPublisherStore({head:async()=>{throw new BlobNotFoundError()},get:async()=>{throw new BlobNotFoundError()},put:async()=>({}),del:async()=>{throw new BlobNotFoundError()}});
 assert.equal(await store.readCurrent(true),null);assert.equal(await store.readCurrent(false),null);await store.deleteCurrent();assert(await store.acquireLock());
});

test('subject photo selection differentiates animal stories while keeping the original catalog available',()=>{
 for(const [title,id] of [["Rescued leopard cats in Thailand",'leopard-cat'],['Giraffes return to Bicuar National Park','giraffe'],['Volunteers protect livestock in Zimbabwe','cattle']]){
  const story={title,category:'Planet'};assert.equal(photoForStory(story).id,id);assert.equal(photoForStory(story,false).id,'forest');
 }
 for(const title of ['Elephant herd returns to Kenya park','Bison herds roam the prairie again','Sea cows return to Florida springs'])assert.notEqual(photoForStory({title,category:'Planet'}).id,'cattle',title);
 assert.equal(photoForStory({title:'Dairy cows graze restored pasture',category:'Planet'}).id,'cattle');
});
test('the subject-photo API profile changes only presentation, preserves the manifest, and reads no external feed',async()=>{
 const {createStoriesHandler}=await import('../../api/stories.ts');const ss=sources(),settings=control({locationResolver:'supported_feed'});
 const snap=buildSnapshot(null,[{sourceId:'alpha',ok:true,candidates:[candidate('alpha','herd','Volunteers protect livestock in Zimbabwe')]}],ss,settings,NOW);
 let reads=0;const handler=createStoriesHandler({edition:{schemaVersion:1,revision:'empty',updatedAt:null,stories:[],statuses:{}},sources:ss,control:settings,now:()=>NOW,readSnapshot:async()=>{reads++;return{snapshot:snap,status:'ok'}}});
 const run=async(url)=>{let status,data;const res={setHeader(){},status(n){status=n;return res},json(value){data=value}};await handler({method:'GET',url},res);assert.equal(status,200);return data};
 const base=await run('/api/stories'),rich=await run('/api/stories?photos=subjects-v1&t=whatever'),unknown=await run('/api/stories?photos=unknown');
 assert.equal(base.stories[0].imageContext,'forest');assert.equal(rich.stories[0].imageContext,'cattle');assert.equal(unknown.stories[0].imageContext,'forest');assert.equal(reads,3);
 assert.deepEqual(base.manifest,rich.manifest);assert.equal(base.revision,rich.revision);assert.equal(base.stories[0].id,rich.stories[0].id);assert.equal(base.stories[0].version,rich.stories[0].version);
});
test('trafficked animals awaiting a return are not a completed rescue or reunion',()=>{
 const rejected=screenHeadline({title:'Five orangutans found in India face long road back home to Indonesia',description:'The animals may have been trafficked across international borders.',defaultCategory:'Planet',now:NOW});assert.equal(rejected.decision,'exclude');assert(rejected.reasons.includes('ENFORCEMENT_OR_LEGAL'));
 assert.equal(screenHeadline({title:'Animals found awaiting rescue in Thailand',description:'',defaultCategory:'Planet',now:NOW}).decision,'exclude');
 assert.equal(screenHeadline({title:'Volunteers reunite rescued animals in Thailand',description:'A completed reunion.',defaultCategory:'Planet',now:NOW}).decision,'list');
});

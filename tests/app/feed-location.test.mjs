import test from 'node:test';
import assert from 'node:assert/strict';
import { locateFeedOutcome } from '../../server/feed-location.ts';
import { buildSnapshot } from '../../server/publisher-snapshot.ts';
import { projectPublisherFeed } from '../../src/lib/publisher-feed.ts';
import { validPublicStory } from '../../src/lib/publication.ts';
import { POLICY_VERSION } from '../../src/goodsignal/types.ts';
import { NOW, sources, control, candidate } from './publisher-fixtures.mjs';
const settings=control({locationResolver:'supported_feed'});
test('physical outcomes resolve a named feature from an explicit headline relation',()=>{
 const p=locateFeedOutcome('Volunteers replant kelp forests in Clayoquot Sound','');
 assert.equal(p.mapArea.placeId,'ca-clayoquot-sound');assert.equal(p.mapArea.basis,'title');assert.equal(p.lat,49.233333);assert.equal(p.precision,'region');
});
test('a geographical opening in the feed lead can locate a terrestrial headline',()=>{
 const p=locateFeedOutcome('Salmon return to historical habitat after dam removal','The Klamath River in the U.S. was heavily dammed. Fish are returning to the river.');
 assert.equal(p.mapArea.placeId,'us-klamath-river');assert.equal(p.mapArea.basis,'feed_description');assert.equal(p.mapArea.areaKm,450);
});
test('origin, incidental, ambiguous and off-Earth locations abstain',()=>{
 const cases=[
 ['Scientists in Canada discover water on Mars',''],
 ['Volunteers based in Clayoquot Sound restore a distant reef',''],
 ['NASA develops batteries for the Moon','In Clayoquot Sound, a team provided components.'],
 ['Volunteers restore habitat','An author visited Clayoquot Sound last year.'],
 ['Volunteers restore habitat in Clayoquot Sound and the Klamath River',''],
 ['Researchers in Kenya restore a simulated reef',''],
 ['Volunteers restore habitat in an unknown valley',''],
 ['Volunteers restore reefs in Canada and Japan',''],
 ];for(const [t,d] of cases)assert.equal(locateFeedOutcome(t,d),null,t);
});
test('country fallback needs a physical outcome and an explicit local relation',()=>{
 assert.equal(locateFeedOutcome('Volunteers restore wetlands in Kenya','').precision,'country');
 assert.equal(locateFeedOutcome('Kenya team opens a shelter abroad',''),null);
});
test('located publisher cards retain uncertainty labels, safe public references and no feed excerpts',()=>{
 const c=candidate('alpha','kelp','Volunteers replant kelp forests in Clayoquot Sound');
 const snapshot=buildSnapshot(null,[{sourceId:'alpha',ok:true,candidates:[c]}],sources(),settings,NOW);
 const [card]=projectPublisherFeed(snapshot,settings,sources(),NOW).stories;
 assert(card.labels.includes('area_from_feed'));assert.equal(card.mapArea.placeId,'ca-clayoquot-sound');assert.equal(card.eventDate,null);
 assert(validPublicStory({...card,expiresAt:'2026-11-01T00:00:00Z',policyVersion:POLICY_VERSION}));
 assert.equal(Object.hasOwn(card,'body'),false);assert.equal(Object.hasOwn(card,'locationQuote'),false);
 const invalid={...card,lat:0,expiresAt:'2026-11-01T00:00:00Z',policyVersion:POLICY_VERSION};assert(!validPublicStory(invalid));
 snapshot.items[0].lng=1;assert.equal(projectPublisherFeed(snapshot,settings,sources(),NOW).stories.length,0);
});
test('turning location off removes coordinates, area evidence and mapping labels from an existing snapshot',()=>{
 const snapshot=buildSnapshot(null,[{sourceId:'alpha',ok:true,candidates:[candidate('alpha','kelp','Volunteers replant kelp forests in Clayoquot Sound')]}],sources(),settings,NOW);
 const [card]=projectPublisherFeed(snapshot,control({locationResolver:'off'}),sources(),NOW).stories;
 assert.equal(card.lat,null);assert.equal(card.mapArea,undefined);assert(!card.labels.includes('area_from_feed'));
});

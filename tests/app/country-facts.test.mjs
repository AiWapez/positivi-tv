import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndex, countryForLocation, relevantFacts, groupByTopic, topicWeights, validCountryFile, loadCountryFacts, resetCountryFactsForTests, TEASER_MAX_CHARS } from '../../src/lib/country-facts.ts';
import { clean, factsFor, namesFor, FACTS, TOPICS, PINNED_COMMIT } from '../../scripts/build-country-facts.mjs';

const file = JSON.parse(readFileSync(new URL('../../public/assets/country-facts.json', import.meta.url), 'utf8'));
const index = buildIndex(file);
const story = (title, category = 'Planet', location = 'Thailand') => ({ title, category, location });
const country = name => index.byName.get(name.toLowerCase());

test('the committed file is the pinned Factbook archive, with real sources and nothing left over from the markup', () => {
  assert.ok(validCountryFile(file));
  assert.equal(file.source.commit, PINNED_COMMIT);
  assert.match(file.source.note, /closed the World Factbook in February 2026/);
  assert.ok(file.countries.length > 200);
  const unwanted = /military|terror|refugee|religion|ethnic/i;
  for (const c of file.countries) for (const [topic, label, text] of c.facts) {
    assert.ok(topic >= 0 && topic < file.topics.length);
    assert.ok(text.length > 0 && !/[<>]|&[a-z]+;|&#\d+;/.test(text), `${c.name} ${label}: leftover markup`);
    assert.ok(!unwanted.test(label), label);
  }
});

test('markup is removed and nothing is shortened or invented', () => {
  assert.equal(clean('<p>Hello &amp; welcome</p>'), 'Hello & welcome');
  assert.equal(clean('<strong>metropolitan France:</strong> floods<br><br><strong>overseas:</strong> storms'), 'metropolitan France: floods; overseas: storms');
  assert.equal(clean('C&ocirc;te d&rsquo;Ivoire&nbsp;'), 'Côte d’Ivoire');
  const long = 'x'.repeat(500);
  const facts = factsFor({ Geography: { Climate: { text: long }, Terrain: { text: 'flat' } } });
  assert.deepEqual(facts.map(f => f[1]), ['Terrain'], 'a fact over its limit is left out, not cut down');
  assert.deepEqual(factsFor({ Geography: { Terrain: { text: 'NA' } } }), [], 'NA means the Factbook had nothing');
  assert.deepEqual(factsFor({ Geography: { Area: { 'total ': { text: '1 sq km' } } } }).map(f => f[2]), ['1 sq km'], 'a key with a trailing space still matches');
});

test('the sensitive field groups are not in the list of facts the script reads', () => {
  const fields = FACTS.map(f => `${f[2]} ${f[3]}`).join(' ');
  assert.doesNotMatch(fields, /Military|Terror|Refugee|Religion|Ethnic/i);
  assert.equal(TOPICS.length, file.topics.length);
});

test('a short form that is only initials is not used as the heading', () => {
  const names = namesFor({ Government: { 'Country name': { 'conventional short form': { text: 'DRC' }, 'conventional long form': { text: 'Democratic Republic of the Congo' }, abbreviation: { text: 'none' } } } });
  assert.equal(names.name, 'Democratic Republic of the Congo'); assert.ok(names.aliases.includes('DRC'));
});

test('a story place names its country only by an exact match of the whole text or of the part after the last comma', () => {
  const name = location => countryForLocation(location, index)?.name ?? null;
  assert.equal(name('Thailand'), 'Thailand');
  assert.equal(name('Klamath River area, US'), 'United States');
  assert.equal(name('Clayoquot Sound, Canada'), 'Canada');
  assert.equal(name('Bicuar National Park, Angola'), 'Angola');
  assert.equal(name('Zimbabwe'), 'Zimbabwe');
  assert.equal(name('Location not specified'), null);
  assert.equal(name('Near Thailand somewhere'), null, 'no guessing inside a longer phrase');
  assert.equal(name('Congo'), null, 'a name two countries share identifies neither');
  assert.equal(name(null), null); assert.equal(name(''), null);
  assert.equal(name("Ivory Coast"), "Côte d'Ivoire"); assert.equal(name('Turkey'), 'Turkey');
});

test('the facts shown follow the story: wildlife stories get nature facts, energy stories get energy facts, health stories get health facts', () => {
  const top = (title, category) => relevantFacts(country('Thailand'), file.topics, story(title, category), 3);
  assert.equal(top('Rescued leopard cats return to the wild', 'Planet')[0].topic, 'Nature and environment');
  assert.equal(top('Solar power lights up villages', 'Science')[0].topic, 'Energy');
  assert.equal(top('Malaria cases fall after a vaccine rollout', 'Health')[0].topic, 'Health');
  assert.equal(top('Village school teaches the local language', 'Community')[0].topic, 'People and culture');
  const salmon = relevantFacts(country('United States'), file.topics, story('Chinook salmon return after dams removed', 'Planet'), 3);
  assert.equal(salmon[0].label, 'Fresh water', 'the water fact answers a salmon-and-dams headline');
});

test('picks are short enough for the card, limited to two per topic, never the long background, and always the same', () => {
  for (const c of file.countries.slice(0, 80)) for (const [title, cat] of [['Forest wildlife returns', 'Planet'], ['New study', 'Science'], ['Clinic opens', 'Health'], ['Village festival', 'Community']]) {
    const picks = relevantFacts(c, file.topics, story(title, cat), 3), again = relevantFacts(c, file.topics, story(title, cat), 3);
    assert.deepEqual(picks, again);
    assert.ok(picks.length <= 3);
    for (const p of picks) { assert.ok(p.text.length <= TEASER_MAX_CHARS); assert.notEqual(p.label, 'Background'); }
    const perTopic = {}; for (const p of picks) perTopic[p.topic] = (perTopic[p.topic] ?? 0) + 1;
    assert.ok(Object.values(perTopic).every(n => n <= 2));
  }
});

test('whole words only in headlines, so Marsh does not count as space and Windsor does not count as wind', () => {
  assert.equal(topicWeights({ title: 'Marsh restored near Windsor', category: 'Community' })[7], 0);
  assert.equal(topicWeights({ title: 'Marsh restored near Windsor', category: 'Community' })[3], 0);
});

test('the country page lists every fact once, grouped by topic', () => {
  const c = country('Angola'), groups = groupByTopic(c, file.topics);
  assert.equal(groups.reduce((n, g) => n + g.facts.length, 0), c.facts.length);
  assert.ok(groups.every(g => g.facts.length > 0));
});

test('the facts file is fetched once, only when asked, and a failed or bad download shows no facts and is not retried', async () => {
  resetCountryFactsForTests();
  let calls = 0;
  const bad = async () => { calls++; return { ok: true, json: async () => ({ nonsense: true }) }; };
  assert.equal(await loadCountryFacts(bad), null); assert.equal(await loadCountryFacts(bad), null); assert.equal(calls, 1);
  resetCountryFactsForTests(); calls = 0;
  const down = async () => { calls++; return { ok: false, status: 503 }; };
  assert.equal(await loadCountryFacts(down), null); await loadCountryFacts(down); assert.equal(calls, 1);
  resetCountryFactsForTests();
  const good = async () => ({ ok: true, json: async () => file });
  assert.ok((await loadCountryFacts(good)).byName.size > 200);
  resetCountryFactsForTests();
});

test('the docs record the source, the pinned commit and what is left out, and the card and page show the source', () => {
  const docs = readFileSync(new URL('../../docs/country-facts.md', import.meta.url), 'utf8');
  assert.ok(docs.includes(PINNED_COMMIT)); assert.match(docs, /Left out on purpose/); assert.match(docs, /frozen/i);
  const page = readFileSync(new URL('../../src/components/CountryFacts.tsx', import.meta.url), 'utf8');
  assert.match(page, /country-source/); assert.match(page, /info\.source\.note/);
});

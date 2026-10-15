import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { animalForStory, animalLines, buildAnimalIndex, loadAnimalFacts, resetAnimalFactsForTests, validAnimalFile } from '../../src/lib/animal-facts.ts';
import { build, kept, pregnancyText, weightAmount, weightText, longDate, STATUS_WORDS, MIN_FACTS } from '../../scripts/build-animal-facts.mjs';
import { extractRecord } from '../../scripts/extract-wikidata-animals.mjs';
import { canonical, cleanWikitext, findValue, maximumLifespans, measures, wikipediaNames, wikipediaStatus } from '../../scripts/check-animal-facts.mjs';

const json = name => JSON.parse(readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8'));
const file = json('public/assets/animal-facts.json');
const checks = json('data/animal-facts/checks.json'), review = json('data/animal-facts/manual-review.json'), source = json('data/animal-facts/wikidata-source.json'), species = json('data/animal-facts/species.json');
const index = buildAnimalIndex(file);
const story = (title, category = 'Planet') => ({ title, category });
const entry = id => file.species.find(s => s.id === id);
const idOf = (title, category) => animalForStory(story(title, category), index)?.id ?? null;

test('the committed file is exactly what the data files build, and every animal has at least two checked facts', () => {
  assert.ok(validAnimalFile(file));
  assert.deepEqual(JSON.parse(JSON.stringify(build().file)), file, 'run npm run animals:build');
  assert.ok(file.species.length >= 90, 'about a hundred animals');
  for (const s of file.species) {
    const shown = ['scientificName', 'status', 'pregnancy', 'weight'].filter(k => s[k]);
    assert.ok(shown.length >= MIN_FACTS, `${s.id} has only ${shown.length} facts`);
    for (const k of ['name', 'scientificName', 'status', 'pregnancy', 'weight']) if (s[k]) assert.ok(!/[<>]|&[a-z]+;/.test(s[k]), `${s.id} ${k}: leftover markup`);
    if (s.status) assert.ok(Object.values(STATUS_WORDS).includes(s.status), `${s.id}: ${s.status}`);
  }
  assert.equal(file.source.license, 'CC0 1.0');
  assert.equal(file.source.credit, `Facts: Wikidata (CC0), matched automatically against Wikipedia on ${longDate(file.source.checkedOn)}.`);
});

test('every fact in the file passed the second-source check or was kept by a written decision, and a written drop always wins', () => {
  for (const s of file.species) {
    const field = { scientificName: 'scientificName', status: 'status', pregnancy: 'gestation', weight: 'adultWeight' };
    for (const [shown, name] of Object.entries(field)) if (s[shown]) assert.ok(kept(s.id, name, checks, review), `${s.id} ${name} was not confirmed by a second source`);
    assert.ok(s.wikidata.item.startsWith('Q') && s.wikidata.revision > 0 && s.wikipediaRevision > 0, 'every entry names the revisions it was checked against');
  }
  assert.equal(entry('green-sea-turtle'), undefined, 'Wikidata and Wikipedia disagree on its category, so only its name was left');
  assert.equal(entry('chinook-salmon'), undefined, 'Wikidata has no category for it');
  assert.equal(entry('northern-giraffe'), undefined, 'the category both sources give is for all giraffes together, so this exact animal has none');
  assert.equal(entry('bald-eagle').weight, undefined, 'a regional figure is not shown as the whole species');
  assert.equal(entry('bald-eagle').scientificName, 'Haliaeetus leucocephalus');
  assert.equal(kept('x', 'status', { species: { x: { checks: { status: { verdict: 'match' } } } } }, { decisions: { x: { status: { keep: false } } } }), false);
  assert.equal(kept('x', 'status', { species: { x: { checks: { status: { verdict: 'no-match' } } } } }, { decisions: {} }), false);
  assert.equal(kept('x', 'status', { species: { x: { checks: { status: { verdict: 'match' } } } } }, { decisions: {} }), true);
});

test('longest observed lifespan is never shown, because no second source confirmed any of those numbers', () => {
  assert.ok(Object.values(source.records).some(r => r.longestLifespan), 'the numbers are read, so this test would notice if they started to be shown');
  assert.ok(!JSON.stringify(file).match(/lifespan|years old|live up to/i));
  for (const s of species) assert.notEqual(checks.species[s.id]?.checks?.longestLifespan?.verdict, 'match', `${s.id}: a lifespan matched; decide whether to start showing them`);
});

test('every record in the data files points at a species or subspecies and the species list agrees with the file', () => {
  for (const s of species) assert.ok(source.records[s.id]?.rankIsSpecies, `${s.id} is not a species record`);
  assert.deepEqual(Object.keys(source.records).sort(), species.map(s => s.id).sort());
  assert.ok(source.requests.length > 0 && checks.requests.length > 0 && checks.secondSource.includes('never copied'));
  const ids = new Set(file.species.map(s => s.id));
  assert.equal(ids.size, file.species.length, 'no duplicates');
  const phrases = file.species.flatMap(s => s.matches);
  assert.equal(new Set(phrases).size, phrases.length, 'two animals share a name');
  for (const b of file.blockers) assert.ok(!phrases.includes(b), `${b} is both a blocker and an animal name`);
});

test('the sentences are written from the values and say "about" for numbers', () => {
  assert.equal(pregnancyText(669.68), 'about 22 months');
  assert.equal(pregnancyText(502.26), 'about 16.5 months');
  assert.equal(pregnancyText(108), 'about 108 days');
  assert.equal(pregnancyText(0), null);
  assert.equal(weightAmount(70), '70 kg'); assert.equal(weightAmount(117.5), '120 kg'); assert.equal(weightAmount(4.13), '4.1 kg');
  assert.equal(weightAmount(0.376), '380 g'); assert.equal(weightAmount(1500), '1.5 tonnes'); assert.equal(weightAmount(1000), '1 tonne'); assert.equal(weightAmount(-3), null);
  assert.equal(weightText({ both: { amount: 70, unit: 'kg' } }), 'about 70 kg');
  assert.equal(weightText({ male: { amount: 29, unit: 'kg' }, female: { amount: 24, unit: 'kg' } }), 'about 29 kg for males and 24 kg for females');
  assert.equal(weightText({ both: { amount: 2400, unit: 'lb' } }), 'about 1.1 tonnes');
  assert.equal(weightText({ male: { amount: 3, unit: 'kg' } }), null, 'one sex alone is not enough to say anything');
  assert.equal(longDate('2026-10-15'), 'October 15, 2026');
  assert.equal(entry('komodo-dragon').weight, 'about 70 kg');
  assert.equal(entry('african-bush-elephant').pregnancy, 'about 22 months');
});

test('the card shows the lines in a fixed order, with the IUCN link on those words only', () => {
  assert.deepEqual(animalLines(entry('komodo-dragon')).map(l => `${l.label}: ${l.text}`), ['Conservation status: Endangered (IUCN Red List)', 'Adult weight: about 70 kg', 'Scientific name: Varanus komodoensis']);
  const lion = animalLines(entry('lion'));
  assert.deepEqual(lion.map(l => l.label), ['Conservation status', 'Pregnancy', 'Scientific name']);
  assert.equal(lion[1].text, 'lasts about 108 days');
  assert.equal(lion[0].link.text, 'IUCN Red List'); assert.ok(lion[0].text.includes(lion[0].link.text));
  assert.match(lion[0].link.href, /^https:\/\/www\.iucnredlist\.org\/search\?query=Panthera%20leo&searchType=species$/);
  assert.equal(entry('lion').wikipedia, 'https://en.wikipedia.org/wiki/Lion');
  assert.equal(entry('kakapo').wikipedia, 'https://en.wikipedia.org/wiki/K%C4%81k%C4%81p%C5%8D');
});

test('a headline gets an animal only when it names exactly one, in a Planet or Science story', () => {
  assert.equal(idOf('Tigers are back in the forests of Nepal'), 'tiger');
  assert.equal(idOf('Wild tiger numbers rise for the first time in a century'), 'tiger');
  assert.equal(idOf('Snow leopards spotted on camera in Mongolia'), 'snow-leopard', 'the longer name wins over "leopard"');
  assert.equal(idOf('A leopard cat is photographed for the first time in a village'), 'leopard-cat');
  assert.equal(idOf('Orca calf spotted off the coast', 'Science'), 'orca');
  assert.equal(idOf('Killer whales return to the bay'), 'orca');
  assert.equal(idOf('Przewalski’s horse herd released in Mongolia'), 'przewalskis-horse', 'a curly apostrophe still matches');
  assert.equal(idOf('The kakapo breeding season is the best on record'), 'kakapo');
  assert.equal(idOf('African bush elephants gain protected corridor'), 'african-bush-elephant');
  assert.equal(idOf('A tiger and a lion rescued from a closed zoo'), null, 'two animals: no card');
  assert.equal(idOf('Tigers and tiger cubs thrive'), 'tiger', 'the same animal twice is still one animal');
  assert.equal(idOf('Elephants are protected by a new law'), null, 'a general word does not pick a species');
  assert.equal(idOf('African elephants gain a new corridor'), null, 'two African species share that name');
  assert.equal(idOf('Giraffes return to a reserve'), null, 'giraffes are not on the list');
  assert.equal(idOf('Northern giraffes return to a reserve'), null, 'the northern giraffe has no card either');
  assert.equal(idOf('Tigers in the city win the cup', 'Community'), null, 'only Planet and Science stories');
  assert.equal(idOf('Tigers return', 'Health'), null);
  assert.equal(idOf('A wonderful day for everyone'), null);
});

test('words that contain an animal name but are not that animal, or are a subspecies with its own category, give nothing', () => {
  for (const title of ['Sea lions return to the harbour', 'A mountain lion is rescued', 'The lionfish invasion slows', 'Tiger Global funds a clean energy start-up', 'Tiger sharks tagged off Hawaii',
    'Sumatran tigers are counted again', 'The Amur tiger recovery continues', 'Asiatic lions get a second home', 'Amur leopards breed in the wild', 'Southern resident orcas have a new calf',
    'Western gray whales return to the Pacific', 'The northern white rhino embryo transfer works', 'Cook Inlet belugas are counted', 'Mexican gray wolves reach a new record', 'Detroit Lions open a youth clinic',
    'A leopard seal visits a beach', 'Sumatran elephants get a new patrol', 'Western chimpanzees are protected']) assert.equal(idOf(title), null, title);
  assert.equal(idOf('Lions return to a park where they were gone for years'), 'lion');
  assert.equal(idOf('The ape and the monarchy'), null);
  assert.equal(idOf('Monarch butterfly numbers climb'), 'monarch-butterfly');
  assert.equal(idOf('Guatemalan quetzal trades steady'), null, 'the currency is not the bird');
});

test('a bad or partial animal file is refused, and links must go where they say', () => {
  assert.equal(validAnimalFile(null), false); assert.equal(validAnimalFile({ species: [] }), false); assert.equal(validAnimalFile({}), false);
  const copy = () => JSON.parse(JSON.stringify(file));
  const wrongLink = copy(); wrongLink.species[0].wikipedia = 'https://evil.example/wiki/Tiger'; assert.equal(validAnimalFile(wrongLink), false);
  const wrongIucn = copy(); wrongIucn.species[0].iucn = 'javascript:alert(1)'; assert.equal(validAnimalFile(wrongIucn), false);
  const markup = copy(); markup.species[0].scientificName = '<b>x</b>'; assert.equal(validAnimalFile(markup), false);
  const noName = copy(); delete noName.species[0].scientificName; assert.equal(validAnimalFile(noName), false);
  assert.equal(validAnimalFile(copy()), true);
});

test('the animal file is fetched once, only when asked, and a failed or bad download shows no animal facts and is not retried', async () => {
  resetAnimalFactsForTests();
  let calls = 0;
  const bad = async () => { calls++; return { ok: true, json: async () => ({ nonsense: true }) }; };
  assert.equal(await loadAnimalFacts(bad), null); assert.equal(await loadAnimalFacts(bad), null); assert.equal(calls, 1);
  resetAnimalFactsForTests(); calls = 0;
  const down = async () => { calls++; return { ok: false, status: 503 }; };
  assert.equal(await loadAnimalFacts(down), null); await loadAnimalFacts(down); assert.equal(calls, 1);
  resetAnimalFactsForTests();
  assert.ok((await loadAnimalFacts(async () => ({ ok: true, json: async () => file }))).byPhrase.size > 90);
  resetAnimalFactsForTests();
});

test('reading Wikidata: only a single clear value is kept, birth weights and unknown units are left out', () => {
  const claim = (amount, unit, qualifiers) => ({ rank: 'normal', mainsnak: { datavalue: { value: { amount: `+${amount}`, unit: `http://www.wikidata.org/entity/${unit}` } } }, ...(qualifiers ? { qualifiers } : {}) });
  const item = id => ({ datavalue: { value: { id } } });
  const entity = {
    id: 'Q1', lastrevid: 7, modified: 'x', labels: { en: { value: 'Thing' } }, sitelinks: { enwiki: { title: 'Thing' } },
    claims: {
      P105: [{ rank: 'normal', mainsnak: item('Q7432') }], P225: [{ rank: 'normal', mainsnak: { datavalue: { value: 'Genus species' } } }], P141: [{ rank: 'normal', mainsnak: item('Q96377276') }],
      P4214: [claim(30, 'Q577'), claim(40, 'Q577')], P3063: [claim(2, 'Q5151')],
      P2067: [claim(30, 'Q11570', { P3831: [item('Q78101716')], P21: [item('Q44148')] }), claim(20, 'Q11570', { P3831: [item('Q78101716')], P21: [item('Q43445')] }), claim(2, 'Q11570', { P3831: [item('Q4128476')] })],
    },
  };
  const r = extractRecord(entity);
  assert.equal(r.status, 'EN'); assert.equal(r.scientificName, 'Genus species'); assert.equal(r.rankIsSpecies, true);
  assert.equal(r.longestLifespan, null, 'two different values: ambiguous, so none');
  assert.deepEqual(r.gestation, { amount: 2, unit: 'month' });
  assert.deepEqual(r.adultWeight, { male: { amount: 30, unit: 'kg' }, female: { amount: 20, unit: 'kg' } }, 'the birth weight is not used');
  entity.claims.P2067 = [claim(5, 'Q99999')]; assert.equal(extractRecord(entity).adultWeight, null, 'a unit we do not know is dropped, never guessed');
  entity.claims.P141 = [{ rank: 'normal', mainsnak: item('Q123') }]; assert.equal(extractRecord(entity).status, null);
  assert.equal(canonical('gestation', { amount: 22, unit: 'month' }), 22 * 30.44);
});

test('the second-source check is strict: the number, the words and the way it is said all have to fit', () => {
  const clean = text => cleanWikitext(text), look = (field, wanted, text, who) => findValue(field, wanted, clean(text), undefined, who);
  assert.ok(look('gestation', 108, 'The average gestation period is around 110{{spaces}}days; the female gives birth.'), 'a single number within 3%');
  assert.equal(look('gestation', 130, 'The gestation period is somewhere between 95 and 160 days.'), null, 'a very wide range confirms nothing');
  assert.ok(look('gestation', 480, 'The gestation period is 15–17 months.'), 'a narrow range that contains it');
  assert.ok(look('gestation', 669.68, 'Gestation lasts {{convert|22|month|day}}.') || look('gestation', 669.68, 'Gestation lasts 22 months.'));
  assert.equal(look('gestation', 108, 'Cubs stay for 110 days with their mother.'), null, 'the right number in a sentence about something else');
  assert.ok(look('longestLifespan', 51.6, 'In captivity they have been known to live up to 51 years old.'));
  assert.equal(look('longestLifespan', 51.6, 'The average lifespan is 51 years.'), null, 'an average life is not the longest');
  assert.equal(look('longestLifespan', 65, 'Teeth are well worn by the age of 65 years.'), null, 'age of tooth wear is not a lifespan');
  assert.equal(look('longestLifespan', 59.4, 'Chimpanzees have been recorded to live over 60 years.'), null, '"over 60" does not confirm 59');
  assert.equal(look('longestLifespan', 45, 'White rhinos can live up to 40–50 years.'), null, 'a lifespan must match the top of the range');
  assert.equal(look('adultWeight', 7.5, 'Males put a mean mass of 7.3 kg, while females weigh 6.2 kg on average.', 'both'), null, 'a figure for one sex is not a figure for both');
  assert.ok(look('adultWeight', 70, 'Adult Komodo dragons usually weigh around 70 kg.', 'both'));
  const otters = 'Weights are between 26 to 32 kg for males and 22 to 26 kg for females.';
  assert.ok(look('adultWeight', 29, otters, 'male')); assert.ok(look('adultWeight', 24, otters, 'female'));
  assert.equal(look('adultWeight', 24, otters, 'male'), null, 'the female figure does not confirm the male one');
  const tigers = 'Male Sumatran tigers weigh 100 to 140 kg, and females weigh 75 to 110 kg.';
  assert.equal(look('adultWeight', 120, tigers, 'female'), null, 'the male range sits next to the word "females" but belongs to the males');
  assert.equal(look('adultWeight', 8.45, 'The weight ranges from 7 to 14.1 kg.', 'both'), null, 'a wide range');
  assert.equal(look('adultWeight', 38, 'The male weighs 38 kg.', 'both'), null, 'a weight for both cannot come from a sentence about one sex');
  assert.equal(measures(clean('{{convert|2|-|3|kg|lb}}'))[0].lo, 2);
  assert.deepEqual(maximumLifespans(clean('The oldest was 38 years old. The typical lifespan is 20 years.')), [38]);
});

test('the second source is read from the species box: category code, scientific name and the opening of the article', () => {
  const raw = '{{Speciesbox\n| genus = Panthera\n| species = tigris\n| status = EN\n| status_system = IUCN3.1\n}}\nThe tiger (\'\'Panthera tigris\'\') is a big cat.';
  assert.deepEqual(wikipediaStatus(raw), { code: 'EN', system: 'IUCN3.1' });
  assert.equal(wikipediaStatus('no box'), null);
  assert.ok(wikipediaNames(raw, cleanWikitext(raw)).names.has('panthera tigris'));
  assert.equal(cleanWikitext('Text.<ref>cited</ref> More {{cite web|url=x}} words.'), 'Text. More words.');
});

test('the docs and the card state the sources and what is left out, and a visitor’s browser only ever asks our own site', () => {
  const docs = readFileSync(new URL('../../docs/animal-facts.md', import.meta.url), 'utf8');
  for (const word of [/Wikidata/, /CC0/, /Left out on purpose/, /IUCN/, /second source/i, /Wikipedia/, /User-Agent/]) assert.match(docs, word);
  const card = readFileSync(new URL('../../src/components/AnimalFacts.tsx', import.meta.url), 'utf8');
  assert.match(card, /animal-source/); assert.match(card, /Read more on Wikipedia/); assert.match(card, /info\.credit/);
  const lib = readFileSync(new URL('../../src/lib/animal-facts.ts', import.meta.url), 'utf8');
  assert.match(lib, /ANIMAL_FACTS_URL = '\/assets\/animal-facts\.json'/);
  assert.doesNotMatch(lib, /wikidata\.org\/w\/|query\.wikidata|iucnredlist\.org\/api/, 'the app never calls Wikidata or the IUCN');
});

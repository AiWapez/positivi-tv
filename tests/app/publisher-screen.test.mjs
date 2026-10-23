import test from 'node:test';
import assert from 'node:assert/strict';
import { screenHeadline } from '../../server/publisher-screen.ts';
import { countryFromHeadline } from '../../server/publisher-location.ts';
import { NOW } from './publisher-fixtures.mjs';
const screen = (title, description = '', defaultCategory = 'auto') => screenHeadline({ title, description, defaultCategory, now: NOW });

test('regressions: constructive headlines with negative-looking words are listed', () => {
  for (const title of ['Community opens shelter for abuse survivors', 'Teen wins deadlift championship', 'Scientists restore dead coral to a thriving reef']) {
    const r = screen(title);
    assert.equal(r.decision, 'list', `${title}: ${r.reasons.join(',')}`);
    assert(r.labels.includes('event_date_unconfirmed'));
  }
  assert.equal(screen('Scientists restore dead coral to a thriving reef').category, 'Planet');
  assert(!screen('Scientists restore dead coral to a thriving reef').labels.includes('research_finding'), 'a completed restoration is not labelled as research');
});

test('negative vocabulary still excludes when no recovery or protective outcome is stated', () => {
  for (const title of ['Wildfire destroys homes across valley', 'Drought leaves farmers stranded', 'Dead whale washes ashore']) assert.equal(screen(title).decision, 'exclude', title);
});

test('harm, enforcement, conflict, governance and health stories are excluded', () => {
  const cases = {
    'Three killed in bus crash near capital': 'HARM_EVENT',
    'Police arrest poachers after raid': 'ENFORCEMENT_OR_LEGAL',
    'Ceasefire holds as aid reaches town': 'CONFLICT_OR_CRISIS',
    'Parliament passes bill to protect bees': 'GOVERNANCE_NEVER_AUTOMATED',
    'New cancer drug helps patients': 'HEALTH_NEVER_AUTOMATED',
    'Critics slam new park design': 'OPINION_OR_DISPUTE',
  };
  for (const [title, reason] of Object.entries(cases)) { const r = screen(title); assert.equal(r.decision, 'exclude', title); assert(r.reasons.includes(reason), `${title}: ${r.reasons}`); }
});

test('hard harm words in the description lead also exclude', () => {
  const r = screen('Village celebrates new bridge', 'The bridge replaces one where two people were killed last year.');
  assert.equal(r.decision, 'exclude'); assert(r.reasons.includes('HARM_EVENT'));
});

test('plans, intentions and work in progress are not presented as outcomes', () => {
  for (const title of ['City will open new park next year', 'Town plans to restore wetland', 'Council to open library', 'Charity aims to plant a million trees',
    'Solar farm could power 10,000 homes', 'Construction begins on community solar farm', 'New reef may help fish recover']) {
    const r = screen(title); assert.equal(r.decision, 'exclude', title);
    assert(r.reasons.some(x => ['PLAN_OR_UNCERTAIN', 'IN_PROGRESS_NOT_OUTCOME'].includes(x)), `${title}: ${r.reasons}`);
  }
  assert.equal(screen('Thoughts on community gardens').reasons.includes('NO_COMPLETED_OUTCOME'), true);
});

test('research is listed only with a visible research label', () => {
  const r = screen('Astronomers discover water vapour around distant star');
  assert.equal(r.decision, 'list'); assert(r.labels.includes('research_finding')); assert.equal(r.category, 'Science');
});

test('the month of May is not read as uncertainty; lower-case "may" is', () => {
  assert.equal(screen('Sea turtles hatch on protected beach in May').decision, 'list');
  assert.equal(screen('Sea turtles may hatch on protected beach').decision, 'exclude');
});

test('whole-word matching: award, deadlift and warmth are not war, dead or harm words', () => {
  assert.equal(screen('Award-winning school opens community garden').decision, 'list');
  assert.equal(screen('Volunteers knit warmth for shelter animals and help them find homes').decision, 'list');
});

test('questions, explainers, listicles, promotion, hype and retrospectives are excluded', () => {
  for (const title of ['Can cities save their bees?', 'Why the reef recovered', '10 ways to help wildlife this autumn', 'Sponsored: solar panels on sale',
    'Miracle coral restored overnight', 'Park celebrates 50th anniversary']) assert.equal(screen(title).decision, 'exclude', title);
});

test('old events reported today are excluded by headline year or dated description phrase', () => {
  const headline = screen('Lake Turkana wind farm opened in 2019 marks record output');
  assert.equal(headline.decision, 'exclude'); assert(headline.reasons.includes('OLD_YEAR_IN_HEADLINE'));
  const described = screen('Wind farm reaches record output', 'The wind farm, inaugurated in 2019, now powers thousands of homes.');
  assert.equal(described.decision, 'exclude'); assert(described.reasons.includes('OLD_EVENT_YEAR_IN_DESCRIPTION'));
  assert.equal(screen('Wind farm reaches record output', 'The farm reached the milestone in 2026.').decision, 'list');
});

test('source default category wins; Health is never assigned automatically', () => {
  assert.equal(screen('Rover sets record drive', '', 'Science').category, 'Science');
  for (const t of ['Community opens shelter for abuse survivors', 'Teen wins deadlift championship', 'Rover sets record drive']) assert.notEqual(screen(t).category, 'Health');
});

test('location: one preposition-anchored country in the headline gives an approximate centre, never 0/0', () => {
  const g = countryFromHeadline('Wolves return in Germany after a century');
  assert.equal(g.name, 'Germany'); assert(Math.abs(g.lat) > 1 && Math.abs(g.lng) > 1);
  assert.equal(countryFromHeadline('Mangroves restored across the Philippines').name, 'Philippines');
  assert.equal(countryFromHeadline('Rangers rescue elephants in South Sudan').name, 'South Sudan');
  assert.equal(countryFromHeadline('Library opens in the US for refugees').name, 'United States');
});

test('location: no anchor, incidental or demonym mentions, several countries, ambiguity and wrong case stay unknown', () => {
  for (const title of ['Teen wins deadlift championship', "Brazil's team wins cup", 'Kenyan startup opens solar farm', 'Solar farm in Kenya powers homes in Uganda',
    'Volunteers plant trees in Georgia', 'Join us in celebrating new park', 'Farmers grow chile in New Mexico', 'Students in Peru and Chile win award'])
    assert.equal(countryFromHeadline(title), null, title);
});

test('false positives found in a dry run on real headline shapes stay excluded', () => {
  // Paraphrased patterns from the 2026-10-14 dry run; no publisher text is stored here.
  for (const title of ['Painted turbines can save millions of birds', 'Oil pollution is drifting into protected areas, report finds',
    'Imported squid tied to labor abuses finds an easy route to markets', 'Protected areas are not for mining: Interview with a ranger',
    'As sand becomes more valuable, the coast grows more vulnerable', 'Town to capture and relocate baboon troops'])
    assert.equal(screen(title, '', 'Planet').decision, 'exclude', title);
  assert.equal(screen('Researcher who listens to forests wins environmental award').labels.includes('research_finding'), false, 'an award is not a research finding');
  assert.equal(screen('Salmon return to habitat after removal of old dams', '', 'Planet').decision, 'list');
});

test('independent review: negative trends, returning problems and disease stories are excluded', () => {
  for (const title of ['Violence returns to the capital', 'Drought returns to the valley', 'Deforestation rebounds in the forest', 'Toxic sludge released into river',
    'Poachers return to national park', 'Arctic sea ice reaches record low', 'Global emissions hit record high', 'Unemployment hits record high',
    'Coral bleaching reaches record extent across Australia', 'Measles cases reach record high in US', 'Bird flu found in dairy cattle',
    'First case of mpox confirmed in Sweden', 'Polio returns in Pakistan', 'Egypt becomes malaria-free, WHO confirms', 'HIV cases fall to record low in Kenya',
    'City unveils car-free centre design'])
    assert.equal(screen(title).decision, 'exclude', title);
});

test('independent review: lab results and prototypes carry the research label', () => {
  for (const title of ['Researchers create plastic-eating enzyme', 'Researchers achieve record solar cell efficiency',
    'NSF-funded team creates self-healing concrete', 'Prototype desalination device delivers clean water']) {
    const r = screen(title); assert.equal(r.decision, 'list', title); assert(r.labels.includes('research_finding'), title);
  }
  assert.equal(screen('Teens who knit blankets win community award').decision, 'list', 'ordinary "who" is not the WHO acronym');
});

test('location: an origin or base ("based in", "born in") is not the event location', () => {
  for (const title of ['Startup based in Germany launches ocean cleanup', 'Artist born in Peru opens studio', 'Solar panels made in China power village'])
    assert.equal(countryFromHeadline(title), null, title);
});

test('second review: extractive, governance, funding, pests and trend records are excluded; community builds are not research', () => {
  for (const title of ['Locusts return to East Africa', 'Child marriage returns in Afghanistan', 'Gunfire returns to capital', 'Whalers return with record haul',
    'Global emissions reach new record', 'Ocean temperatures break records', 'Fishing fleet lands record catch', 'Mosquito population doubles in Europe',
    'Algae bloom doubles in size across Baltic', 'Sinking island village marks final school year as families relocate', 'New pipeline delivers gas to Europe',
    'Huge oil reserve discovered offshore', 'New coal mine opens in Australia', 'Hunters receive permits to cull 30 wolves', 'EU confirms ban on pesticides',
    'Country becomes first in region to legalise same-sex marriage', 'Workers win pay rise after month-long strike', 'Record number of migrants cross Channel',
    'Airline unveils order for 100 electric planes', 'Wetland restoration project wins funding', 'Firm raises $50m for carbon capture'])
    assert.equal(screen(title).decision, 'exclude', title);
  for (const title of ['Team builds playground in Kenya', 'Students build wheelchair ramp for neighbour']) {
    const r = screen(title); assert.equal(r.decision, 'list', title); assert(!r.labels.includes('research_finding'), title);
  }
  assert.equal(screen('First Nation-led effort replants kelp forests', '', 'Planet').decision, 'list');
});

test('second review: origin clauses and same-named towns do not create pins; a scene-setting "In X," opening does', () => {
  for (const title of ['Man who grew up in Ghana opens bakery', 'Famous in France, chef opens soup kitchen in New York', 'Community garden opens in Jamaica, Queens',
    'Library reopens in Peru, Indiana', 'Studying in India, student wins science prize'])
    assert.equal(countryFromHeadline(title), null, title);
  assert.equal(countryFromHeadline('In Kenya, women restore degraded forests').name, 'Kenya');
});

test('plural forms of excluded words are excluded too (stricter-only fix)', () => {
  const cases = {
    'Governors celebrate new state park': 'GOVERNANCE_NEVER_AUTOMATED',
    'Mayors open shared bike lanes': 'GOVERNANCE_NEVER_AUTOMATED',
    'City councils open community gardens': 'GOVERNANCE_NEVER_AUTOMATED',
    'Two treaties protect migratory birds': 'GOVERNANCE_NEVER_AUTOMATED',
    'Prime ministers open joint solar plant': 'GOVERNANCE_NEVER_AUTOMATED',
    'Famines ended in two regions': 'CONFLICT_OR_CRISIS',
    'Pandemics shaped how cities build parks': 'CONFLICT_OR_CRISIS',
    'Massacres remembered as town opens memorial garden': 'HARM_EVENT',
    'Investigations reveal wildlife sanctuary success': 'ENFORCEMENT_OR_LEGAL',
    'Debates end as town opens new library': 'OPINION_OR_DISPUTE',
    'Cancers detected earlier with new scan': 'HEALTH_NEVER_AUTOMATED',
    'Refineries closed and replaced by solar parks': 'EXTRACTIVE_INDUSTRY',
    'Breakthroughs restore coral reef': 'HYPE',
    'Obituaries honour reef pioneer': 'RETROSPECTIVE',
  };
  for (const [title, reason] of Object.entries(cases)) {
    const r = screen(title);
    assert.equal(r.decision, 'exclude', title);
    assert(r.reasons.includes(reason), `${title}: ${r.reasons}`);
  }
});

test('plural fix does not exclude constructive headlines that use none of the listed words', () => {
  for (const title of ['Community opens shelter for abuse survivors', 'Teen wins deadlift championship', 'Scientists restore dead coral to a thriving reef',
    'Award-winning school opens community garden', 'Volunteers discover new dinosaur fossils in the desert']) {
    const r = screen(title); assert.equal(r.decision, 'list', `${title}: ${r.reasons}`);
  }
});

// Policy 0.6.0 (stricter only). Every headline below is an invented pattern, not a real story, so it is safe to keep in the public repository.
const HELD_BACK_0_6_0 = [
  'Town opens memorial after killings', 'Bombings end as town reopens market', 'Massacred village rebuilt by volunteers', 'Shooter captured after rampage ends',
  'Prisoner was executed, now honoured with plaque', 'Tortured activist wins award', 'Abducted children return home', 'Starvation ends as new farm opens',
  'Deadly virus-free zone opens', 'War-torn region opens first new school', 'Drought-stricken village finds water', 'Post-war city welcomes tourists',
  'Conflict-hit farmers earn record harvest', 'Rebels capture provincial capital', 'Militia opens checkpoint on highway', 'Army captures border town',
  'Soldiers return after offensive succeeds', 'Cartel lands new shipping route', 'Regime unveils national stadium', 'Missile test reaches new range',
  'Drone maker delivers first armed units', 'Nuclear warhead plant reopens', 'Weapons maker lands record contract', 'Neo-Nazi group opens community center',
  'White supremacist rally reaches record turnout', 'Casino opens on former farmland', 'Betting app launches in new states', 'Tobacco firm wins approval for new plant',
  'Vape maker opens factory', 'Strip club reopens after renovation', 'Adult film studio wins award', 'Charity helps child abuse survivors rebuild',
  'Shelter opens for women fleeing domestic violence', 'Rescued from sex slavery, women open bakery', 'Former cult members find new homes',
  'Village built on landmine field reopens', 'A decade ago this reef was dead; today it thrives', 'Last century this forest was cleared; it has returned',
  'Company readies first launch', 'Surveillance firm wins city contract', 'Facial recognition rollout reaches every station', 'Volcano eruption creates new island',
  'Town celebrates as blackout ends',
  'After a decade of growth, a country becomes the largest producer of processed nickel', 'Lithium smelter opens on the coast',
  'Elastic fantastic: the deadly fluid of a carnivorous flower',
];
const STILL_LISTED_0_6_0 = [
  'Village opens first library', 'Volunteers plant 10,000 trees along river', 'Award-winning rangers return rescued pangolins', 'Mars rover lands safely',
  'Student team builds solar boat', 'Community garden opens in Lagos', 'New butterfly species discovered in Peru', 'Coral reef restored by local divers',
  'Wolves return to Alpine valley', 'Library reopens after renovation', 'Kiwi return to Wellington for first time in a century',
  'Rescued sea turtles released into ocean', 'Town celebrates reopening of its river beach', 'Researchers discover ancient forest under ice',
  'Twin pandas born at sanctuary', 'Flood-ravaged town rebuilds bridge', 'Landslide village rebuilt in record time', 'Preparing rescued owls for life in the wild',
  'Copperbelt choir wins national award', 'Gold medal team returns home',
];

test('0.6.0: each invented pattern the old rules listed is now held back', () => {
  for (const title of HELD_BACK_0_6_0) { const r = screen(title); assert.equal(r.decision, 'exclude', `${title}: ${r.reasons}`); }
});

test('0.6.0: near misses and controls still list', () => {
  for (const title of STILL_LISTED_0_6_0) { const r = screen(title); assert.equal(r.decision, 'list', `${title}: ${r.reasons}`); }
});

test('0.6.0: the bare words "conflict" and "executed" are not banned', () => {
  for (const title of ['Rangers ease human-wildlife conflict with chili fences', 'NASA team executed flawless orbit maneuver']) {
    const r = screen(title);
    assert(!r.reasons.includes('CONFLICT_OR_CRISIS') && !r.reasons.includes('SENSITIVE_TOPIC') && !r.reasons.includes('VICE_OR_ADULT'), `${title}: ${r.reasons}`);
  }
});

test('0.6.0: the new reasons are reported under their own codes', () => {
  assert(screen('Neo-Nazi group opens community center').reasons.includes('SENSITIVE_TOPIC'));
  assert(screen('Casino opens on former farmland').reasons.includes('VICE_OR_ADULT'));
  assert(screen('Rebels capture provincial capital').reasons.includes('CONFLICT_OR_CRISIS'));
  assert(screen('War-torn region opens first new school').reasons.includes('CONFLICT_OR_CRISIS'));
  assert(screen('Village opens first library', 'The library was funded after an episode of domestic violence in the district.').reasons.includes('SENSITIVE_TOPIC'), 'the description lead is read');
});

test('0.6.0: invisible and lookalike characters hold a story back instead of hiding a banned word', () => {
  const soft = 'Three people kil­led in market, town reopens it';
  const zero = 'Village celebrates after w​ar ends';
  const cyrillicA = 'Village opens first grаve garden';          // Cyrillic "а" inside a Latin word
  const cyrillicE = 'Rescued owls rеturn to the wild';          // Cyrillic "е" inside a Latin word
  for (const title of [soft, zero, cyrillicA, cyrillicE]) {
    const r = screen(title); assert.equal(r.decision, 'exclude', title); assert(r.reasons.includes('SUSPICIOUS_CHARACTERS'), `${title}: ${r.reasons}`);
  }
  assert(screen('Village opens first library', 'A short description with a zero​width space.').reasons.includes('SUSPICIOUS_CHARACTERS'), 'the description lead is checked too');
  assert.equal(screen('Village opens first library').reasons.includes('SUSPICIOUS_CHARACTERS'), false);
  assert.equal(screen('Москва opens first library').reasons.includes('SUSPICIOUS_CHARACTERS'), false, 'a word fully in one script is not mixed');
});

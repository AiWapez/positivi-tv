/**
 * Country facts for the story card: a few facts that fit the story, and a full "About this country" page.
 * The facts are the CIA World Factbook's own text (a frozen public archive), built into public/assets/country-facts.json by
 * scripts/build-country-facts.mjs. Nothing here writes or invents a fact; it only picks which ones to show. Pure functions, so the rules
 * can be tested without a browser.
 */
import type { Category } from '../types';

export const COUNTRY_FACTS_URL = '/assets/country-facts.json';
/** Topic names in the file's order; the file stores facts as [topic number, label, text]. */
export type Fact = readonly [number, string, string];
export interface CountryEntry { name: string; aliases: string[]; facts: Fact[] }
export interface CountryFile { source: { name: string; archive: string; commit: string; terms: string; note: string }; rules: string; topics: string[]; countries: CountryEntry[] }
export interface CountryIndex { file: CountryFile; byName: Map<string, CountryEntry> }

const TOPIC = { country: 0, geography: 1, environment: 2, energy: 3, health: 4, people: 5, economy: 6, science: 7 } as const;
type Topic = keyof typeof TOPIC;

/** True only for a file shaped the way the build script writes it, so a bad or partial download is ignored instead of shown. */
export function validCountryFile(value: unknown): value is CountryFile {
  const file = value as CountryFile | null;
  return !!file && typeof file === 'object' && !!file.source && typeof file.source.commit === 'string' && Array.isArray(file.topics) && file.topics.every(t => typeof t === 'string')
    && Array.isArray(file.countries) && file.countries.length > 0 && file.countries.every(c => typeof c?.name === 'string' && Array.isArray(c.aliases) && Array.isArray(c.facts)
      && c.facts.every(f => Array.isArray(f) && Number.isInteger(f[0]) && f[0] >= 0 && f[0] < file.topics.length && typeof f[1] === 'string' && typeof f[2] === 'string'));
}
export function buildIndex(file: CountryFile): CountryIndex {
  const byName = new Map<string, CountryEntry>();
  for (const country of file.countries) for (const name of [country.name, ...country.aliases]) byName.set(name.toLowerCase(), country);
  return { file, byName };
}

/**
 * The country a story's place text names. Only an exact match counts: the whole text ("Thailand"), or its last part after a comma
 * ("Clayoquot Sound, Canada" gives Canada, "Klamath River area, US" gives the United States). Nothing is guessed from inside a longer
 * phrase, and a story with no place on Earth never gets a country.
 */
export function countryForLocation(location: string | null | undefined, index: CountryIndex): CountryEntry | null {
  if (!location) return null;
  const text = location.trim().toLowerCase();
  const last = text.includes(',') ? text.slice(text.lastIndexOf(',') + 1).trim() : null;
  return index.byName.get(text) ?? (last ? index.byName.get(last) ?? null : null);
}

const words = (re: string) => new RegExp(`\\b(?:${re})`, 'i');
/** Headline words that point at a topic. Whole words only, so "Marsh" never counts as "Mars". */
const TITLE_TOPICS: [Topic, number, RegExp][] = [
  ['energy', 4, words('solar|wind farms?|wind power|hydro\\w*|renewables?|electricity|power grid|grid|batter(?:y|ies)|coal|geothermal|clean energy|nuclear')],
  ['environment', 4, words('forests?|wild|wildlife|species|salmon|rivers?|oceans?|coral|reefs?|mangroves?|kelp|habitat|giraffes?|leopards?|elephants?|rhinos?|whales?|frogs?|birds?|animals?|conservation|rewild\\w*|extinct\\w*|climate|dams?|wetlands?|ecosystems?|biodiversity|nature')],
  ['health', 4, words('vaccin\\w*|malaria|hospitals?|disease|health|cancer|clinics?|doctors?|measles|polio|nutrition|medicine|patients?')],
  ['economy', 3, words('farm\\w*|crops?|agricultur\\w*|jobs|trade|markets?|livestock|fisher\\w*|economy|business|cattle')],
  ['people', 3, words('schools?|students?|language|culture|festival|music|women|children|community|communities|indigenous|village|heritage|tradition\\w*')],
  ['science', 3, words('internet|digital|satellites?|space|research\\w*|stud(?:y|ies)|universit\\w*|technology|scientists?|telescope|discover\\w*')],
  ['geography', 2, words('mountains?|islands?|deserts?|lakes?|coasts?|valleys?|canyons?|sound')],
];
/** The facts that answer a particular word in the headline get extra weight, so a salmon-and-dams story prefers fresh water to forest cover. */
const LABEL_WORDS: [string, RegExp][] = [
  ['Forest cover', words('forests?|trees?|woodland|rainforests?|logging|deforest\\w*')],
  ['Fresh water', words('rivers?|dams?|water|lakes?|wetlands?|salmon|fisher\\w*|kelp|mangroves?')],
  ['Environmental issues', words('wild|animals?|species|conservation|extinct\\w*|pollution|habitat|wildlife|rewild\\w*|coral|reefs?|biodiversity')],
  ['Natural resources', words('mining|mines?|minerals?|oil|gold|lithium|copper|resources|timber|logging')],
  ['Area', words('largest|biggest|size')],
  ['Natural hazards', words('floods?|storms?|fires?|drought|earthquakes?|cyclones?|hurricanes?')],
  ['Where electricity comes from', words('solar|wind|hydro\\w*|renewables?|electricity|grid|geothermal|batter(?:y|ies)|power')],
  ['Carbon dioxide emissions', words('carbon|emissions?|climate')],
  ['Farm products', words('farm\\w*|crops?|agricultur\\w*|livestock|cattle|harvest')],
  ['Life expectancy', words('health|disease|vaccin\\w*|malaria|hospitals?|clinics?')],
  ['Doctors', words('hospitals?|clinics?|doctors?|patients?|medicine')],
  ['Languages', words('language|indigenous|culture|heritage')],
  ['Internet use', words('internet|digital|online')],
  ['Space programme', words('space|satellites?|rockets?|astronaut\\w*')],
];
const CATEGORY_TOPICS: Record<Category, Partial<Record<Topic, number>>> = {
  Planet: { environment: 3, geography: 2, energy: 1 }, Science: { science: 3, energy: 2, environment: 1 },
  Community: { people: 3, economy: 2, health: 1 }, Health: { health: 3, people: 1, economy: 1 },
};
/** How much a story leans on each topic: its category first, then the words in its headline. */
export function topicWeights(story: { title: string; category: Category }): number[] {
  const weights = new Array<number>(8).fill(0);
  for (const [topic, weight] of Object.entries(CATEGORY_TOPICS[story.category] ?? {})) weights[TOPIC[topic as Topic]] += weight as number;
  for (const [topic, weight, re] of TITLE_TOPICS) if (re.test(story.title)) weights[TOPIC[topic]] += weight;
  return weights;
}

export const TEASER_MAX_CHARS = 260;
/** Facts that describe a country in general rather than any story; they are shown only when the headline asks for them. */
const GENERAL_LABELS = new Set(['Natural resources', 'Area', 'Size compared', 'Highest point']);
export interface PickedFact { topic: string; label: string; text: string }
/**
 * The facts that fit this story best. Each fact scores its topic's weight, plus a bonus when its label answers a word in the headline.
 * At most two per topic, only facts short enough for the card, best first; ties keep the file's order. Always the same facts for the same story.
 */
export function relevantFacts(country: CountryEntry, topics: string[], story: { title: string; category: Category }, max = 3): PickedFact[] {
  const weights = topicWeights(story);
  const scored = country.facts.map((fact, order) => {
    const bonus = LABEL_WORDS.some(([label, re]) => label === fact[1] && re.test(story.title)) ? 5 : 0;
    return { fact, order, score: weights[fact[0]] + bonus - (bonus === 0 && GENERAL_LABELS.has(fact[1]) ? 3 : 0) };
  }).filter(s => s.score > 0 && s.fact[2].length <= TEASER_MAX_CHARS && s.fact[1] !== 'Background').sort((a, b) => b.score - a.score || a.order - b.order);
  const taken = new Map<number, number>(), picked: PickedFact[] = [];
  for (const { fact } of scored) {
    if (picked.length >= max) break;
    if ((taken.get(fact[0]) ?? 0) >= 2) continue;
    taken.set(fact[0], (taken.get(fact[0]) ?? 0) + 1); picked.push({ topic: topics[fact[0]], label: fact[1], text: fact[2] });
  }
  return picked;
}
/** Every fact for a country page, grouped by topic in the file's order. */
export function groupByTopic(country: CountryEntry, topics: string[]): { topic: string; facts: PickedFact[] }[] {
  return topics.map((topic, n) => ({ topic, facts: country.facts.filter(f => f[0] === n).map(f => ({ topic, label: f[1], text: f[2] })) })).filter(g => g.facts.length);
}

let loading: Promise<CountryIndex | null> | null = null;
/** Fetched once, only when a story with a place is opened; never on page load, and a failure is not retried (the card simply shows no facts). */
export function loadCountryFacts(fetcher: typeof fetch = fetch): Promise<CountryIndex | null> {
  loading ??= fetcher(COUNTRY_FACTS_URL).then(r => { if (!r.ok) throw new Error(`facts ${r.status}`); return r.json(); }).then(file => validCountryFile(file) ? buildIndex(file) : null).catch(() => null);
  return loading;
}
export function resetCountryFactsForTests() { loading = null; }

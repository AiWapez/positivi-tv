/**
 * Animal facts for the story card: when a Planet or Science headline names exactly one animal from our list, the card shows a few checked
 * facts about that animal. The facts are in public/assets/animal-facts.json, built from Wikidata (CC0) by scripts/build-animal-facts.mjs.
 * Nothing here writes or invents a fact; it only decides which animal a headline means, and puts the file's values into fixed sentences.
 * Pure functions, so the rules can be tested without a browser.
 */
import type { Category } from '../types';

export const ANIMAL_FACTS_URL = '/assets/animal-facts.json';

export interface AnimalEntry {
  id: string; name: string; matches: string[]; scientificName: string; status?: string; pregnancy?: string; weight?: string;
  wikipedia: string; iucn: string; wikidata: { item: string; revision: number }; wikipediaRevision: number;
}
export interface AnimalFile {
  source: { name: string; url: string; license: string; licenseUrl: string; checkedOn: string; credit: string; note: string };
  blockers: string[]; species: AnimalEntry[];
}
export interface AnimalIndex { file: AnimalFile; finder: RegExp; byPhrase: Map<string, AnimalEntry>; blocked: Set<string> }

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length < 200 && !/[<>]/.test(value);
const optionalText = (value: unknown) => value === undefined || isText(value);
const link = (value: unknown, prefix: string) => typeof value === 'string' && value.startsWith(prefix) && value.length < 300 && !/\s/.test(value);

/** True only for a file shaped the way the build script writes it, so a bad or partial download is ignored instead of shown. Links must go where we say they go. */
export function validAnimalFile(value: unknown): value is AnimalFile {
  const file = value as AnimalFile | null;
  return !!file && typeof file === 'object' && !!file.source && isText(file.source.credit) && link(file.source.url, 'https://www.wikidata.org/')
    && Array.isArray(file.blockers) && file.blockers.every(isText) && Array.isArray(file.species) && file.species.length > 0
    && file.species.every(s => !!s && isText(s.id) && isText(s.name) && Array.isArray(s.matches) && s.matches.length > 0 && s.matches.every(isText) && isText(s.scientificName)
      && optionalText(s.status) && optionalText(s.pregnancy) && optionalText(s.weight)
      && link(s.wikipedia, 'https://en.wikipedia.org/wiki/') && link(s.iucn, 'https://www.iucnredlist.org/'));
}

const normalize = (text: string) => text.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The finder reads a headline once, left to right. At each place it tries the longest phrase first, and the phrase can end in a plural
 * ("tigers"). Phrases that are not the animal ("sea lion") or a subspecies with its own category ("Sumatran tiger") are in the same list, so
 * they use up their words before the shorter animal name can match.
 */
export function buildAnimalIndex(file: AnimalFile): AnimalIndex {
  const byPhrase = new Map<string, AnimalEntry>(), blocked = new Set(file.blockers.map(normalize));
  for (const entry of file.species) for (const phrase of entry.matches) byPhrase.set(normalize(phrase), entry);
  const phrases = [...new Set([...byPhrase.keys(), ...blocked])].sort((a, b) => b.length - a.length);
  const finder = new RegExp(`(?<![a-z0-9])(${phrases.map(escapeRegExp).join('|')})(?:e?s)?(?![a-z0-9])`, 'g');
  return { file, finder, byPhrase, blocked };
}

/** Categories that can carry an animal card. A sports team named after an animal is a Community story, so it never gets one. */
const CATEGORIES: ReadonlySet<Category> = new Set<Category>(['Planet', 'Science']);

/**
 * The animal a story is about: only when the headline names exactly one animal from the list. Two different animals, an animal that
 * is only part of a longer name ("sea lion"), or a headline with none gives nothing. Only the headline is read.
 * A blocker also cancels an animal word that comes straight after it ("Southern resident orcas": the group has its own category).
 */
export function animalForStory(story: { title: string; category: Category }, index: AnimalIndex): AnimalEntry | null {
  if (!CATEGORIES.has(story.category)) return null;
  const found = new Map<string, AnimalEntry>();
  let blockedUntil = -1;
  for (const match of normalize(story.title).matchAll(index.finder)) {
    const end = match.index! + match[0].length;
    if (index.blocked.has(match[1])) { blockedUntil = end + 1; continue; }
    if (match.index! <= blockedUntil) continue;
    const entry = index.byPhrase.get(match[1]);
    if (entry) found.set(entry.id, entry);
  }
  return found.size === 1 ? [...found.values()][0] : null;
}

export interface AnimalLine { label: string; text: string; link?: { text: string; href: string } }
/**
 * The lines on the card, in a fixed order, with the exact words the card uses. The values come from the file; the sentences are ours.
 * The conservation category links to the species' IUCN page.
 */
export function animalLines(entry: AnimalEntry): AnimalLine[] {
  const lines: AnimalLine[] = [];
  if (entry.status) lines.push({ label: 'Conservation status', text: `${entry.status} (IUCN Red List)`, link: { text: 'IUCN Red List', href: entry.iucn } });
  if (entry.pregnancy) lines.push({ label: 'Pregnancy', text: `lasts ${entry.pregnancy}` });
  if (entry.weight) lines.push({ label: 'Adult weight', text: entry.weight });
  lines.push({ label: 'Scientific name', text: entry.scientificName });
  return lines;
}

let loading: Promise<AnimalIndex | null> | null = null;
/** Fetched once, only when a Planet or Science story is opened; never on page load, and a failure is not retried (the card simply shows no animal facts). */
export function loadAnimalFacts(fetcher: typeof fetch = fetch): Promise<AnimalIndex | null> {
  loading ??= fetcher(ANIMAL_FACTS_URL).then(r => { if (!r.ok) throw new Error(`animal facts ${r.status}`); return r.json(); }).then(file => validAnimalFile(file) ? buildAnimalIndex(file) : null).catch(() => null);
  return loading;
}
export function resetAnimalFactsForTests() { loading = null; }

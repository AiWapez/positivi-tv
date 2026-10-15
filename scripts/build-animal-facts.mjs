#!/usr/bin/env node
/**
 * Builds public/assets/animal-facts.json, the small frozen file behind the "Good to know" card for animal stories.
 *
 * Nothing here talks to the internet. It reads files that are committed in data/animal-facts/:
 *   species.json          the species we cover, the words in a headline that name each one, and the English Wikipedia page
 *   blockers.json         phrases that contain a species word but are not that animal (or a subspecies with its own category)
 *   wikidata-source.json  the values taken from Wikidata (CC0), with the revision of every record (scripts/extract-wikidata-animals.mjs)
 *   checks.json           the second-source check against English Wikipedia (scripts/check-animal-facts.mjs)
 *   manual-review.json    the few decisions the script could not make
 *
 * A fact is written only if it passed the second-source check, or a decision in manual-review.json keeps it. Every sentence is written
 * here from the Wikidata value; no text is copied from Wikipedia or anyone else. A species needs at least two checked facts to appear.
 * Longest observed lifespan is read from Wikidata but never shown: no second source confirmed any of those numbers.
 *
 * Usage:  node scripts/build-animal-facts.mjs           writes the file
 *         node scripts/build-animal-facts.mjs --check   fails if the committed file is not exactly what this produces
 */
import { readFileSync, writeFileSync } from 'node:fs';

const DATA = name => new URL(`../data/animal-facts/${name}`, import.meta.url);
const OUT = new URL('../public/assets/animal-facts.json', import.meta.url);
const read = name => JSON.parse(readFileSync(DATA(name), 'utf8'));

export const STATUS_WORDS = { LC: 'Least Concern', NT: 'Near Threatened', VU: 'Vulnerable', EN: 'Endangered', CR: 'Critically Endangered', DD: 'Data Deficient' };
export const MIN_FACTS = 2;
const MONTH = 30.44;
const FACTOR = { gestation: { day: 1, month: MONTH, year: 365.25 }, weight: { kg: 1, tonne: 1000, g: 0.001, lb: 0.45359, oz: 0.02835 } };

/** "about 15 months" or "about 108 days". Half months are kept ("16.5"), anything finer is rounded away. */
export function pregnancyText(days) {
  if (!(days > 0)) return null;
  if (days < 200) return `about ${Math.round(days)} days`;
  const months = Math.round((days / MONTH) * 2) / 2;
  return `about ${months} months`;
}

const two = n => Number(n.toPrecision(2));
/** "70 kg", "380 g", "1.5 tonnes": two significant figures at most, because Wikidata's numbers are averages. */
export function weightAmount(kg) {
  if (!(kg > 0)) return null;
  if (kg >= 1000) { const t = two(kg / 1000); return `${t} ${t === 1 ? 'tonne' : 'tonnes'}`; }
  if (kg >= 1) return `${two(kg)} kg`;
  return `${two(kg * 1000)} g`;
}
/** "about 70 kg", or "about 29 kg for males and 24 kg for females" when Wikidata gives one figure for each sex. */
export function weightText(weight) {
  const kg = q => q.amount * FACTOR.weight[q.unit];
  if (weight.both) { const a = weightAmount(kg(weight.both)); return a && `about ${a}`; }
  if (weight.male && weight.female) { const m = weightAmount(kg(weight.male)), f = weightAmount(kg(weight.female)); return m && f && `about ${m} for males and ${f} for females`; }
  return null;
}

/** "October 15, 2026" from "2026-10-15". */
export function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${d}, ${y}`;
}

const wikipediaUrl = title => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2C/g, ',').replace(/%27/g, "'").replace(/%28/g, '(').replace(/%29/g, ')')}`;
const iucnUrl = scientificName => `https://www.iucnredlist.org/search?query=${encodeURIComponent(scientificName)}&searchType=species`;

/** Whether a fact may be used: the second-source check matched it, or a written decision keeps it. A written decision to drop it always wins. */
export function kept(id, field, checks, review) {
  const decision = review.decisions?.[id]?.[field];
  if (decision) return decision.keep === true;
  return checks.species[id]?.checks?.[field]?.verdict === 'match';
}

export function buildEntry(species, record, check, checks, review) {
  const use = field => kept(species.id, field, checks, review);
  const out = { id: species.id, name: species.name, matches: species.matches };
  const verified = [];
  if (record.scientificName && use('scientificName')) { out.scientificName = record.scientificName; verified.push('scientificName'); }
  if (record.status && use('status')) { out.status = STATUS_WORDS[record.status]; verified.push('status'); }
  if (record.gestation && use('gestation')) {
    const days = record.gestation.amount * FACTOR.gestation[record.gestation.unit], text = pregnancyText(days);
    if (text) { out.pregnancy = text; verified.push('gestation'); }
  }
  if (record.adultWeight && use('adultWeight')) {
    const text = weightText(record.adultWeight);
    if (text) { out.weight = text; verified.push('adultWeight'); }
  }
  if (verified.length < MIN_FACTS || !out.scientificName) return { entry: null, verified };
  out.wikipedia = wikipediaUrl(record.wikipediaTitle);
  out.iucn = iucnUrl(record.scientificName);
  out.wikidata = { item: record.qid, revision: record.lastrevid };
  out.wikipediaRevision = check.revid;
  return { entry: out, verified };
}

export function build() {
  const species = read('species.json'), blockers = read('blockers.json'), source = read('wikidata-source.json'), checks = read('checks.json'), review = read('manual-review.json');
  const entries = [], left = [];
  for (const s of species) {
    const record = source.records[s.id], check = checks.species[s.id];
    if (!record || !check) { left.push(`${s.id}: missing record or check`); continue; }
    const { entry, verified } = buildEntry(s, record, check, checks, review);
    if (entry) entries.push(entry); else left.push(`${s.id}: only ${verified.length} checked fact(s)`);
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const checkedOn = checks.retrieved > source.retrieved ? checks.retrieved : source.retrieved;
  const file = {
    source: {
      name: 'Wikidata', url: 'https://www.wikidata.org/', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      checkedOn, credit: `Facts: Wikidata (CC0), matched automatically against Wikipedia on ${longDate(checkedOn)}.`,
      note: 'Each sentence is written by PositiviTV from a Wikidata value that a second source (English Wikipedia) also gave. Conservation categories are the IUCN Red List category words only.',
    },
    blockers,
    species: entries,
  };
  return { file, left };
}

const render = file => JSON.stringify(file) + '\n';

function main(argv) {
  const { file, left } = build(), text = render(file);
  if (argv.includes('--check')) {
    const committed = readFileSync(OUT, 'utf8');
    if (committed !== text) { console.error('public/assets/animal-facts.json is not what the data files produce. Run: npm run animals:build'); process.exit(1); }
    console.log(`animal-facts.json is up to date (${file.species.length} species)`); return;
  }
  writeFileSync(OUT, text);
  console.log(`wrote ${file.species.length} species (${Buffer.byteLength(text)} bytes)`);
  if (left.length) console.log(`left out:\n  ${left.join('\n  ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));

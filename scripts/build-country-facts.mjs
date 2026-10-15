#!/usr/bin/env node
// Builds public/assets/country-facts.json: up to about thirty facts per country, each tagged with a topic, for the "Good to know" facts on a story
// card and the "About this country" page.
//
// Source: the CIA World Factbook, which is in the public domain. The CIA closed the Factbook in February 2026, so this uses the frozen public archive
// "factbook.json" (github.com/factbook/factbook.json, data dedicated CC0), pinned to ONE commit below. Nothing in the output is typed by hand:
// every sentence is the Factbook's own text, with the markup removed. Numbers keep the Factbook's own year, for example "(2023 est.)".
//
// Run:   node scripts/build-country-facts.mjs --archive path/to/factbook.json     (rewrites the file)
//        node scripts/build-country-facts.mjs --archive path/to/factbook.json --check   (fails if the committed file is not exactly what this produces)
// The archive folder must be a git checkout at the pinned commit; any other commit stops the build instead of quietly changing the facts.
//
// Rules (also written into the output file and into docs/country-facts.md):
//   - Only the fields in FACTS below are used. Military, terrorism, refugees, religion and ethnic-group fields are left out on purpose.
//   - A fact longer than its limit is left out, never shortened, so a sentence is never cut in a way that changes its meaning.
//   - A country with no short or long name in the Factbook is left out. Names that two countries share are not used as aliases.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decodeHTML } from 'entities';

export const PINNED_COMMIT = '144d6977b2b01ac1cbd220de754c0a005616760b';
const OUT = new URL('../public/assets/country-facts.json', import.meta.url);

/** Topic keys, in the order they are numbered in the file. */
export const TOPICS = [
  ['country', 'The country'], ['geography', 'Land and geography'], ['environment', 'Nature and environment'], ['energy', 'Energy'],
  ['health', 'Health'], ['people', 'People and culture'], ['economy', 'Economy'], ['science', 'Science and technology'],
];
/**
 * One row per fact: [topic, label, section, field, which, limit].
 * `which` says what to take from the field: 'text' (the field's own text), a list of sub-field names, or 'all' (every sub-field).
 */
export const FACTS = [
  ['country', 'Capital', 'Government', 'Capital', ['name'], 120],
  ['country', 'Population', 'People and Society', 'Population', ['total'], 120],
  ['country', 'Background', 'Introduction', 'Background', 'text', 1400],
  ['country', 'National symbol', 'Government', 'National symbol(s)', 'text', 200],
  ['geography', 'Area', 'Geography', 'Area', ['total'], 120],
  ['geography', 'Size compared', 'Geography', 'Area - comparative', 'text', 250],
  ['geography', 'Terrain', 'Geography', 'Terrain', 'text', 450],
  ['geography', 'Highest point', 'Geography', 'Elevation', ['highest point'], 200],
  ['geography', 'Climate', 'Geography', 'Climate', 'text', 450],
  ['environment', 'Forest cover', 'Geography', 'Land use', ['forest'], 120],
  ['environment', 'Natural resources', 'Geography', 'Natural resources', 'text', 450],
  ['environment', 'Natural hazards', 'Geography', 'Natural hazards', 'text', 450],
  ['environment', 'Environmental issues', 'Environment', 'Environmental issues', 'text', 450],
  ['environment', 'Fresh water', 'Environment', 'Total renewable water resources', 'text', 200],
  ['energy', 'Where electricity comes from', 'Energy', 'Electricity generation sources', 'all', 450],
  ['energy', 'Electricity access', 'Energy', 'Electricity access', ['electrification - total population'], 160],
  ['energy', 'Carbon dioxide emissions', 'Environment', 'Carbon dioxide emissions', ['total emissions'], 160],
  ['health', 'Life expectancy', 'People and Society', 'Life expectancy at birth', ['total population'], 120],
  ['health', 'Infant mortality', 'People and Society', 'Infant mortality rate', ['total'], 160],
  ['health', 'Health spending', 'People and Society', 'Health expenditure', ['Health expenditure (as % of GDP)'], 160],
  ['health', 'Doctors', 'People and Society', 'Physician density', 'text', 160],
  ['people', 'Languages', 'People and Society', 'Languages', 'text', 450],
  ['people', 'National holiday', 'Government', 'National holiday', 'text', 250],
  ['people', 'Independence', 'Government', 'Independence', 'text', 450],
  ['economy', 'Farm products', 'Economy', 'Agricultural products', 'text', 450],
  ['economy', 'Industries', 'Economy', 'Industries', 'text', 450],
  ['economy', 'Economy', 'Economy', 'Economic overview', 'text', 900],
  ['science', 'Internet use', 'Communications', 'Internet users', ['percent of population'], 120],
  ['science', 'Space programme', 'Space', 'Space program overview', 'text', 900],
];

/** Factbook text is a little HTML: break tags separate paragraphs, a few entities appear, and nothing else is kept. */
export function clean(html) {
  if (typeof html !== 'string') return '';
  return decodeHTML(html.replace(/<br\s*\/?>(\s*<br\s*\/?>)*/gi, '; ').replace(/<\/p>\s*<p>/gi, ' ').replace(/<[^>]+>/g, '')
    ).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').replace(/(?:;\s*)+$/, '').replace(/\s*;\s*;/g, ';').trim();
}
const textOf = value => (value && typeof value === 'object' ? clean(value.text) : '');
function pull(field, which) {
  if (!field || typeof field !== 'object') return '';
  if (which === 'text') return textOf(field);
  // The Factbook has a few keys with a trailing space ("total "), so keys are matched trimmed.
  const trimmed = new Map(Object.keys(field).map(k => [k.trim(), field[k]]));
  const keys = which === 'all' ? [...trimmed.keys()].filter(k => k !== 'note' && typeof trimmed.get(k) === 'object') : which;
  const parts = keys.map(k => [k, textOf(trimmed.get(k))]).filter(([, text]) => text);
  if (!parts.length) return '';
  const single = parts.length === 1 && which !== 'all';
  return single ? parts[0][1] : parts.map(([k, text]) => `${k}: ${text}`).join('; ');
}
/** A fact only counts when it has real text. "NA" and "none" mean the Factbook had nothing to say. */
const empty = text => !text || /^(?:NA|none|n\/a)$/i.test(text) || /^\$?0(?:\.0+)?$/.test(text);

/** Up to FACTS.length facts for one Factbook country file. */
export function factsFor(country) {
  const facts = [];
  for (const [topic, label, section, field, which, limit] of FACTS) {
    const text = pull(country[section]?.[field], which);
    if (empty(text) || text.length > limit) continue;
    facts.push([TOPICS.findIndex(t => t[0] === topic), label, text]);
  }
  return facts;
}
const splitNames = text => clean(text).split(/\s+or\s+|[;,]/).map(s => s.trim()).filter(Boolean);
/** Names a story's location could use for this country: the Factbook's short and long forms and its abbreviations. */
export function namesFor(country) {
  const given = country.Government?.['Country name'] ?? {};
  const short = textOf(given['conventional short form']), abbreviation = textOf(given.abbreviation);
  // The long form sometimes carries a note after a semicolon ("United Kingdom of Great Britain and Northern Ireland; note - ..."): keep the name only.
  const long = textOf(given['conventional long form']).split(/;/)[0].trim();
  const real = text => text && !/^none$/i.test(text);
  // A short form that is only initials ("DRC") is a poor heading, so the long form becomes the name and the initials an alias.
  const initials = real(short) && /^[A-Z]{2,5}$/.test(short);
  const name = initials && real(long) ? long : real(short) ? short : real(long) ? long : null;
  const aliases = [initials ? short : null, long, ...splitNames(abbreviation).filter(a => a.length >= 2 && a.length <= 6 && !/^none$/i.test(a))].filter(a => real(a) && a !== name);
  return { name, aliases };
}
/** Extra names stories use that the Factbook writes differently. Each is a plain alias of a Factbook short name; the build fails if the target is missing. */
export const EXTRA_ALIASES = {
  'United States': ['U.S.', 'U.S.A.'], 'United Kingdom': ['Britain', 'Great Britain', 'U.K.'], "C\u00f4te d'Ivoire": ['Ivory Coast', "Cote d'Ivoire"],
  'Turkey': ['T\u00fcrkiye', 'Turkiye'], 'Burma': ['Myanmar'], 'Vietnam': ['Viet Nam'], 'Laos': ['Lao PDR'], 'Congo (Brazzaville)': ['Republic of the Congo', 'Congo-Brazzaville'],
  'Democratic Republic of the Congo': ['DR Congo', 'Congo-Kinshasa'], 'Eswatini': ['Swaziland'], 'Timor-Leste': ['East Timor'], 'Cabo Verde': ['Cape Verde'],
  'The Bahamas': ['Bahamas'], 'The Gambia': ['Gambia'], 'Netherlands': ['The Netherlands', 'Holland'], 'Federated States of Micronesia': ['Micronesia'],
  'Saint Vincent and the Grenadines': ['Saint Vincent & Grenadines'],
};


export function build(archive) {
  const head = execFileSync('git', ['-C', archive, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== PINNED_COMMIT) throw new Error(`The archive is at ${head}, not the pinned ${PINNED_COMMIT}. Check out the pinned commit or review the data and update PINNED_COMMIT.`);
  const countries = [], used = new Map();
  for (const region of readdirSync(archive, { withFileTypes: true }).filter(d => d.isDirectory() && !['meta', 'oceans', '.git', 'node_modules'].includes(d.name)).map(d => d.name).sort()) {
    for (const file of readdirSync(join(archive, region)).filter(f => f.endsWith('.json')).sort()) {
      const data = JSON.parse(readFileSync(join(archive, region, file), 'utf8')), { name, aliases } = namesFor(data);
      if (!name) continue;
      const facts = factsFor(data);
      if (!facts.length) continue;
      countries.push({ code: file.replace(/\.json$/, ''), name, aliases, facts });
    }
  }
  countries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const byName = new Map(countries.map(c => [c.name, c]));
  for (const [target, extra] of Object.entries(EXTRA_ALIASES)) {
    const country = byName.get(target);
    if (!country) throw new Error(`EXTRA_ALIASES names a country the Factbook does not have: ${target}`);
    country.aliases.push(...extra.filter(a => a !== country.name));
  }
  // A name that two countries share cannot identify either one, so it is dropped from both.
  for (const c of countries) for (const alias of new Set([c.name, ...c.aliases])) used.set(alias.toLowerCase(), (used.get(alias.toLowerCase()) ?? new Set()).add(c.code));
  for (const c of countries) c.aliases = [...new Set(c.aliases)].filter(a => used.get(a.toLowerCase()).size === 1 && a.toLowerCase() !== c.name.toLowerCase());
  return {
    source: {
      name: 'CIA World Factbook, frozen public archive', archive: 'https://github.com/factbook/factbook.json', commit: PINNED_COMMIT,
      terms: 'The Factbook is a CIA publication in the public domain; the archive dedicates its data under CC0 1.0.',
      note: 'The CIA closed the World Factbook in February 2026. These facts are frozen at the archive and each number carries the year the Factbook gave it.',
    },
    rules: 'Only the Factbook’s own text, with markup removed. A fact longer than its limit is left out, never shortened. Military, terrorism, refugee, religion and ethnic-group fields are not used.',
    topics: TOPICS.map(t => t[1]),
    countries: countries.map(c => ({ name: c.name, aliases: c.aliases, facts: c.facts })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), at = args.indexOf('--archive');
  if (at < 0 || !args[at + 1] || !existsSync(args[at + 1])) { console.error('Usage: node scripts/build-country-facts.mjs --archive <factbook.json checkout> [--check]'); process.exit(2); }
  const text = JSON.stringify(build(args[at + 1])) + '\n';
  if (args.includes('--check')) {
    const same = existsSync(OUT) && readFileSync(OUT, 'utf8') === text;
    console.log(same ? 'country-facts.json is exactly what the script produces.' : 'country-facts.json is OUT OF DATE or edited by hand.'); process.exit(same ? 0 : 1);
  }
  writeFileSync(OUT, text);
  const data = JSON.parse(text), counts = data.countries.map(c => c.facts.length);
  console.log(`${data.countries.length} countries, ${counts.reduce((a, b) => a + b, 0)} facts (most ${Math.max(...counts)}, fewest ${Math.min(...counts)}), ${(text.length / 1024).toFixed(0)} KB`);
}

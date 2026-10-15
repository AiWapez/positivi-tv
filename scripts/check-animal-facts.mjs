#!/usr/bin/env node
/**
 * The second-source check for animal facts. For every fact taken from Wikidata (data/animal-facts/wikidata-source.json) this looks for the
 * same fact in the English Wikipedia article for the species, and writes the result to data/animal-facts/checks.json.
 *
 * Wikipedia is read here only to check a value. Nothing it says is copied, so the log keeps the page's revision number and, for each fact,
 * only whether it matched and the number that was found. It never keeps a sentence.
 *
 * How to fetch (at most four titles per request so a response stays small enough to save whole):
 *   https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content|ids&rvslots=main&redirects=1&format=json&formatversion=2&titles=<Title1>|<Title2>
 * Save each response as JSON, wrapped as { "requestUrl": "...", "response": <the response> }.
 *
 * A check can only say "found the same value near the right words" or "did not find it". A person then reads every miss, and decides in
 * data/animal-facts/manual-review.json whether the fact stays. See docs/animal-facts.md.
 *
 * Usage: node scripts/check-animal-facts.mjs <retrieved YYYY-MM-DD> <batch.json> [<batch.json> ...] [--show]
 *   --show  also prints, for each fact, the few words around the match so a person can read them (nothing is saved from this).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SPECIES = new URL('../data/animal-facts/species.json', import.meta.url);
const SOURCE = new URL('../data/animal-facts/wikidata-source.json', import.meta.url);
const OUT = new URL('../data/animal-facts/checks.json', import.meta.url);

/** Removes everything in the article that is not plain reading text, turns convert templates into "a-b unit", and keeps the rest. */
export function cleanWikitext(raw) {
  let text = raw.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<ref\b[^>]*\/>/gi, ' ').replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, ' ').replace(/<gallery[\s\S]*?<\/gallery>/gi, ' ');
  text = removeTemplates(text, /^(?:cite|citation|sfn|harvnb|efn|notelist|reflist|refn|webarchive|short description|use \w+ dates|good article|featured article)\b/i);
  text = text.replace(/\{\{\s*(?:convert|cvt)\s*\|([^{}]*)\}\}/gi, (_, args) => convertToText(args.split('|')));
  text = text.replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, ' ').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/https?:\/\/\S+/g, ' ');
  return text.replace(/\{\{(?:nbsp|spaces|hsp|thinsp)(?:\|[^{}]*)?\}\}|&nbsp;|&ndash;|\u00a0/gi, ' ').replace(/''+/g, '').replace(/\s+/g, ' ');
}

/** Drops {{name ...}} templates whose name matches, however deeply other templates are nested inside them. */
function removeTemplates(text, nameRe) {
  let out = '', i = 0;
  while (i < text.length) {
    if (text.startsWith('{{', i)) {
      let depth = 0, j = i;
      for (; j < text.length; j++) {
        if (text.startsWith('{{', j)) { depth++; j++; } else if (text.startsWith('}}', j)) { depth--; j++; if (depth === 0) { j++; break; } }
      }
      const inner = text.slice(i + 2, Math.max(i + 2, j - 2));
      if (nameRe.test(inner.trim())) { i = j; continue; }
      out += '{{' + removeTemplates(inner, nameRe) + '}}'; i = j; continue;
    }
    out += text[i++];
  }
  return out;
}

const CONVERT_UNITS = { t: 'tonnes', yr: 'years', d: 'days', mo: 'months', wk: 'weeks', ST: 'short tons', LT: 'tons', lb: 'lb', g: 'g', kg: 'kg', oz: 'oz' };
/** {{convert|80|-|90|yr|...}} becomes "80-90 yr" so the number finder sees it like any other sentence. */
function convertToText(args) {
  const parts = [];
  for (const a of args.map(s => s.trim())) {
    if (/^-?[\d,]*\.?\d+$/.test(a)) parts.push(a.replace(/,/g, ''));
    else if (['-', '–', '—', 'to', 'and', 'or', 'and(-)'].includes(a)) parts.push('–');
    else if (/^[a-z][a-z/ ]*$/i.test(a) && parts.length) { parts.push(' ' + (CONVERT_UNITS[a] ?? a)); break; }
    else if (/^[a-z]/i.test(a) && !parts.length) break;
  }
  return parts.join('').replace('–', ' to ').replace(/\s+/g, ' ');
}

const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;
const UNIT = String.raw`(years?|yrs?|months?|weeks?|days?|kilograms?|kg|pounds?|lbs?|lb|tonnes?|metric tons?|short tons?|tons?|grams?|g|ounces?|oz)`;
const MEASURE = new RegExp(String.raw`${NUM}(?:\s*(?:–|-|—|to|and|or)\s*${NUM})?\s*-?\s*${UNIT}\b`, 'gi');
const num = s => Number(String(s).replace(/,/g, ''));

/** Every "number unit" in the text, with the position. Units are converted to years, days or kilograms so values can be compared. */
export function measures(text) {
  const found = [];
  for (const m of text.matchAll(MEASURE)) {
    const lo = num(m[1]), hi = m[2] ? num(m[2]) : lo, unit = m[3].toLowerCase();
    if (!(lo > 0) || hi < lo) continue;
    found.push({ index: m.index, end: m.index + m[0].length, lo, hi, unit });
  }
  return found;
}

const TO_YEARS = { year: 1, years: 1, yr: 1, yrs: 1, month: 1 / 12, months: 1 / 12 };
const TO_DAYS = { day: 1, days: 1, week: 7, weeks: 7, month: 30.44, months: 30.44, year: 365.25, years: 365.25, yr: 365.25, yrs: 365.25 };
const TO_KG = { kg: 1, kilogram: 1, kilograms: 1, lb: 0.45359, lbs: 0.45359, pound: 0.45359, pounds: 0.45359, tonne: 1000, tonnes: 1000, 'metric ton': 1000, 'metric tons': 1000, 'short ton': 907.185, 'short tons': 907.185, g: 0.001, gram: 0.001, grams: 0.001, oz: 0.028350, ounce: 0.028350, ounces: 0.028350 };
/** How close two single numbers must be to count as the same value. */
const TOLERANCE = 0.03;
/** Words that must appear in the same sentence as the number. */
const SENTENCE_WORDS = {
  longestLifespan: /life ?span|longevity|\blive[sd]?\b|living|oldest|years? old|captiv|record/i,
  gestation: /gestation|pregnan|incubat|carr(?:y|ies|ied)\b/i,
  adultWeight: /weigh|\bmass\b|weight|heaviest|heavy/i,
};
/** A longest-observed lifespan has to be said as a maximum ("up to 47 years", "the oldest was 38 years"), so a typical life expectancy never counts. */
const MAXIMUM_WORDS = /(?:oldest|longest|maxim\w+|up to|record(?:ed)?|live[sd]? (?:to|for|over)|known to (?:live|reach)|as (?:old|long) as|reach(?:ed|es)? (?:an )?ages? of)\D{0,45}$/i;
const FLOOR_WORDS = /(?:over|more than|at least|exceed\w*)\s*$/i;
const UNITS = { longestLifespan: TO_YEARS, gestation: TO_DAYS, adultWeight: TO_KG };
const CANON_FACTOR = { longestLifespan: { year: 1, month: 1 / 12 }, gestation: { day: 1, month: 30.44, year: 365.25 }, adultWeight: { kg: 1, tonne: 1000, g: 0.001, lb: 0.45359, oz: 0.02835 } };
/** A range may only confirm a value when it is narrow; "somewhere between 95 and 160 days" confirms nothing. */
const MAX_RANGE_WIDTH = { gestation: 0.3, adultWeight: 0.35 };

/** The Wikidata amount in the unit the comparison uses (years, days or kilograms). */
export function canonical(field, q) { return q.amount * (CANON_FACTOR[field][q.unit] ?? NaN); }

function sentenceAround(text, from, to) {
  const start = text.lastIndexOf('. ', from), end = text.indexOf('. ', to);
  return { start: start < 0 ? 0 : start + 2, end: end < 0 ? text.length : end + 1 };
}

/**
 * Looks for the same value, said the same way, in the article. Returns where it was found, or null. The rules are deliberately strict,
 * because a miss costs a person a minute of reading and a false match would put a wrong number on a card:
 *  - the number and the words for the fact ("gestation", "weighs") are in the same sentence;
 *  - a single number must be within 3% of the Wikidata value; a range must contain it and be narrow, except a lifespan, which must be
 *    the top of the range ("up to 40 or 50") and be said as a maximum;
 *  - "over 60 years" is a floor, so a value below 60 does not match it;
 *  - a weight for one sex has to sit next to that sex's word, and a weight for both must not be a figure for just one sex.
 */
export function findValue(field, wanted, text, found = measures(text), who = 'value') {
  const table = UNITS[field];
  for (const m of found) {
    const factor = table[m.unit];
    if (factor === undefined) continue;
    const lo = m.lo * factor, hi = m.hi * factor, single = m.lo === m.hi;
    const sentence = sentenceAround(text, m.index, m.end), words = text.slice(sentence.start, sentence.end);
    if (!SENTENCE_WORDS[field].test(words)) continue;
    const before = text.slice(Math.max(sentence.start, m.index - 60), m.index);
    if (field === 'longestLifespan') {
      if (!MAXIMUM_WORDS.test(before)) continue;
      if (Math.abs(wanted - hi) / hi > TOLERANCE) continue;
      if (single && FLOOR_WORDS.test(before) && wanted < lo) continue;
    } else if (single) {
      if (Math.abs(wanted - lo) / lo > TOLERANCE) continue;
    } else {
      if (wanted < lo || wanted > hi || (hi - lo) / ((hi + lo) / 2) > MAX_RANGE_WIDTH[field]) continue;
    }
    if (field === 'adultWeight' && !sexFits(who, text, m, words)) continue;
    return { at: m.index, end: m.end, shown: `${single ? m.lo : `${m.lo} to ${m.hi}`} ${m.unit}` };
  }
  return null;
}

/**
 * A weight given for one sex has to belong to that sex: its word comes earlier in the same clause ("males weigh 30 kg") or right after
 * the number ("30 kg for males"). A weight for both must come from a sentence that does not split by sex.
 */
function sexFits(who, text, m, sentence) {
  if (who === 'both' || who === 'value') return !/\b(?:males?|females?)\b/i.test(sentence);
  const own = who === 'male' ? /\bmales?\b/i : /\bfemales?\b/i, other = who === 'male' ? /\bfemales?\b/i : /\bmales?\b/i;
  const clause = text.slice(Math.max(0, m.index - 80), m.index).split(/[,;.]|\band\b|\bwhile\b|\bagainst\b/i).at(-1);
  if (own.test(clause) && !other.test(clause)) return true;
  const after = text.slice(m.end, m.end + 40).match(/^\W{0,3}(?:kg|g|lb|lbs|pounds?)?\s*(?:for|in|among|of)\s+(?:the\s+|adult\s+)*(males?|females?)\b/i);
  return !!after && own.test(after[1]);
}

/** Every longest-lifespan figure the article states as a maximum, in years, so a larger one than the Wikidata value can be noticed. */
export function maximumLifespans(text, found = measures(text)) {
  const out = [];
  for (const m of found) {
    const factor = TO_YEARS[m.unit];
    if (factor === undefined) continue;
    const sentence = sentenceAround(text, m.index, m.end), words = text.slice(sentence.start, sentence.end);
    if (!SENTENCE_WORDS.longestLifespan.test(words) || !MAXIMUM_WORDS.test(text.slice(Math.max(sentence.start, m.index - 60), m.index))) continue;
    out.push(m.hi * factor);
  }
  return out;
}

/** The IUCN category code Wikipedia's species box gives, or null. */
export function wikipediaStatus(raw) {
  const head = raw.slice(0, 8000);
  const m = head.match(/\|\s*status\s*=\s*([A-Za-z]{2})\b/);
  const system = head.match(/\|\s*status_system\s*=\s*([^\n|]+)/);
  if (!m) return null;
  return { code: m[1].toUpperCase(), system: system ? system[1].trim() : null };
}

/** Every scientific name the species box and the opening of the article give, lower-cased. */
export function wikipediaNames(raw, clean) {
  const names = new Set();
  const head = raw.slice(0, 8000);
  const taxon = head.match(/\|\s*taxon\s*=\s*([^\n|]+)/);
  if (taxon) names.add(taxon[1].replace(/'+/g, '').replace(/\[\[|\]\]/g, '').trim().toLowerCase());
  const genus = head.match(/\|\s*genus\s*=\s*([^\n|]+)/), species = head.match(/\|\s*species\s*=\s*([^\n|]+)/), sub = head.match(/\|\s*subspecies\s*=\s*([^\n|]+)/);
  if (genus && species) {
    const base = `${genus[1].trim()} ${species[1].trim()}`.toLowerCase();
    names.add(base); if (sub) names.add(`${base} ${sub[1].trim().toLowerCase()}`);
  }
  const binomial = head.match(/\|\s*binomial\s*=\s*([^\n|]+)/);
  if (binomial) names.add(binomial[1].replace(/'+/g, '').replace(/\[\[|\]\]/g, '').trim().toLowerCase());
  return { names, opening: clean.slice(0, 3500).toLowerCase() };
}

function main(argv) {
  const show = argv.includes('--show');
  const [retrieved, ...files] = argv.filter(a => a !== '--show');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(retrieved ?? '') || !files.length) { console.error('usage: check-animal-facts.mjs <YYYY-MM-DD> <batch.json>... [--show]'); process.exit(2); }
  const species = JSON.parse(readFileSync(SPECIES, 'utf8')), source = JSON.parse(readFileSync(SOURCE, 'utf8'));
  const pages = new Map(), requests = [];
  for (const file of files) {
    const { requestUrl, response } = JSON.parse(readFileSync(file, 'utf8'));
    requests.push(requestUrl);
    const redirects = new Map((response.query.redirects ?? []).map(r => [r.to, r.from]));
    for (const page of response.query.pages) {
      if (page.missing || !page.revisions) continue;
      const rev = page.revisions[0], entry = { title: page.title, revid: rev.revid, raw: rev.slots.main.content };
      pages.set(page.title, entry); if (redirects.has(page.title)) pages.set(redirects.get(page.title), entry);
    }
  }
  const log = {}, summary = { checked: 0, matched: 0, notMatched: 0 };
  for (const s of species) {
    const record = source.records[s.id], page = pages.get(s.title);
    if (!record || !page) { console.error(`${s.id}: no ${!record ? 'Wikidata record' : 'Wikipedia page'}`); continue; }
    const clean = cleanWikitext(page.raw), found = measures(clean), checks = {};
    const add = (field, verdict, extra = {}) => { checks[field] = { verdict, ...extra }; summary.checked++; verdict === 'match' ? summary.matched++ : summary.notMatched++; };
    const names = wikipediaNames(page.raw, clean), want = record.scientificName?.toLowerCase();
    add('scientificName', want && (names.names.has(want) || names.opening.includes(want)) ? 'match' : 'no-match', { found: [...names.names].join(' / ') || null });
    const st = wikipediaStatus(page.raw);
    add('status', st && st.code === record.status ? 'match' : 'no-match', { found: st ? st.code : null });
    for (const field of ['longestLifespan', 'gestation', 'adultWeight']) {
      if (!record[field]) continue;
      const values = field === 'adultWeight' ? Object.entries(record.adultWeight).map(([who, q]) => [who, canonical(field, q)]) : [['value', canonical(field, record[field])]];
      const results = values.map(([who, v]) => [who, v, findValue(field, v, clean, found, who)]);
      const larger = field === 'longestLifespan' ? maximumLifespans(clean, found).filter(y => y > canonical(field, record[field]) * (1 + TOLERANCE)) : [];
      add(field, results.every(r => r[2]) && !larger.length ? 'match' : 'no-match', { found: results.map(r => r[2] ? r[2].shown : null), ...(larger.length ? { articleAlsoStatesLonger: larger.map(y => Math.round(y * 10) / 10) } : {}) });
      if (show) for (const [who, v, hit] of results) console.log(`${s.id} ${field}/${who} wikidata=${v.toFixed(2)} ${hit ? `FOUND "${hit.shown}" ...${clean.slice(Math.max(0, hit.at - 70), hit.end + 50)}...` : 'NOT FOUND'}`);
    }
    log[s.id] = { title: s.title, wikipediaTitle: page.title, revid: page.revid, checks };
  }
  writeFileSync(OUT, JSON.stringify({ secondSource: 'English Wikipedia (read only, never copied)', retrieved, requests, summary, species: log }, null, 1) + '\n');
  console.log(JSON.stringify(summary));
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));

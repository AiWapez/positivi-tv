#!/usr/bin/env node
/**
 * Pulls the few facts the app uses out of saved Wikidata API responses and writes data/animal-facts/wikidata-source.json.
 *
 * Why a saved step: the app never calls Wikidata. A person (or Claude) fetches the records once, this script keeps only the claims
 * we may use, and the result is committed with the revision number of every record, so the build is pinned and repeatable.
 *
 * How to fetch (English Wikipedia titles come from data/animal-facts/species.json, at most ten titles per request so a response
 * stays small enough to save whole):
 *   https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=<Title1>|<Title2>&props=claims|labels|sitelinks|info
 *     &languages=en&sitefilter=enwiki&format=json
 * Save each response as JSON, wrapped as { "requestUrl": "...", "response": <the response> }.
 *
 * Usage: node scripts/extract-wikidata-animals.mjs <retrieved YYYY-MM-DD> <batch.json> [<batch.json> ...]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SPECIES = new URL('../data/animal-facts/species.json', import.meta.url);
const OUT = new URL('../data/animal-facts/wikidata-source.json', import.meta.url);

/** Wikidata items that mean an IUCN Red List category (labels checked against Wikidata on 2026-10-15). */
export const STATUS_ITEMS = { Q211005: 'LC', Q719675: 'NT', Q278113: 'VU', Q96377276: 'EN', Q219127: 'CR', Q3245245: 'DD' };
/** Units we know how to say. Anything else is dropped, never guessed. */
export const UNIT_ITEMS = { Q577: 'year', Q573: 'day', Q5151: 'month', Q11570: 'kg', Q191118: 'tonne', Q41803: 'g', Q100995: 'lb', Q48013: 'oz' };
/** Qualifier values on a weight statement. */
const ADULT_WEIGHT = 'Q78101716', MALE = 'Q44148', FEMALE = 'Q43445';
const SPECIES_RANKS = new Set(['Q7432', 'Q68947']); // species, subspecies

const item = snak => snak?.datavalue?.value?.id ?? null;
const unitOf = value => UNIT_ITEMS[String(value?.unit ?? '').split('/').pop()] ?? null;
const number = value => { const n = Number(String(value?.amount ?? '').replace('+', '')); return Number.isFinite(n) ? n : null; };
const best = claims => (claims ?? []).filter(c => c.rank !== 'deprecated');
const qualifierItems = (claim, property) => (claim.qualifiers?.[property] ?? []).map(item).filter(Boolean);

function quantity(claim) {
  const value = claim.mainsnak?.datavalue?.value, unit = unitOf(value), amount = number(value);
  return unit && amount !== null && amount > 0 ? { amount, unit } : null;
}

/** One quantity claim, kept only if there is exactly one usable value. Ambiguous records are left out. */
function single(claims) {
  const usable = best(claims).map(quantity).filter(Boolean);
  return usable.length === 1 ? usable[0] : null;
}

/** Adult weight: a single value, or one value for each sex. Birth weights, ranges by period and anything unlabelled are left out. */
function adultWeight(claims) {
  const usable = best(claims).map(claim => ({ claim, q: quantity(claim) })).filter(x => x.q);
  const adult = usable.filter(x => qualifierItems(x.claim, 'P3831').includes(ADULT_WEIGHT));
  const pool = adult.length ? adult : usable.filter(x => !x.claim.qualifiers);
  const bySex = pool.filter(x => qualifierItems(x.claim, 'P21').length === 1);
  if (pool.length === 1 && !bySex.length) return { both: pool[0].q };
  const male = bySex.filter(x => qualifierItems(x.claim, 'P21')[0] === MALE), female = bySex.filter(x => qualifierItems(x.claim, 'P21')[0] === FEMALE);
  if (pool.length === 2 && male.length === 1 && female.length === 1) return { male: male[0].q, female: female[0].q };
  return null;
}

export function extractRecord(entity) {
  const claims = entity.claims ?? {};
  const rank = best(claims.P105).map(c => item(c.mainsnak))[0] ?? null;
  const statusItem = best(claims.P141).map(c => item(c.mainsnak)).find(id => STATUS_ITEMS[id]) ?? null;
  return {
    qid: entity.id,
    lastrevid: entity.lastrevid,
    modified: entity.modified,
    wikidataLabel: entity.labels?.en?.value ?? null,
    wikipediaTitle: entity.sitelinks?.enwiki?.title ?? null,
    rankIsSpecies: SPECIES_RANKS.has(rank),
    scientificName: best(claims.P225).map(c => c.mainsnak?.datavalue?.value).find(v => typeof v === 'string') ?? null,
    status: statusItem ? STATUS_ITEMS[statusItem] : null,
    longestLifespan: single(claims.P4214),
    gestation: single(claims.P3063),
    adultWeight: adultWeight(claims.P2067),
  };
}

function main(argv) {
  const [retrieved, ...files] = argv;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(retrieved ?? '') || !files.length) { console.error('usage: extract-wikidata-animals.mjs <YYYY-MM-DD> <batch.json>...'); process.exit(2); }
  const species = JSON.parse(readFileSync(SPECIES, 'utf8'));
  const byTitle = new Map(), requests = [];
  for (const file of files) {
    const { requestUrl, response } = JSON.parse(readFileSync(file, 'utf8'));
    requests.push(requestUrl);
    for (const entity of Object.values(response.entities ?? {})) if (!('missing' in entity) && entity.sitelinks?.enwiki) byTitle.set(entity.sitelinks.enwiki.title, entity);
  }
  const records = {}, problems = [];
  for (const s of species) {
    const entity = byTitle.get(s.title);
    if (!entity) { problems.push(`${s.id}: no Wikidata record for "${s.title}"`); continue; }
    records[s.id] = extractRecord(entity);
    if (!records[s.id].scientificName) problems.push(`${s.id}: no taxon name`);
    if (!records[s.id].rankIsSpecies) problems.push(`${s.id}: not a species or subspecies record`);
  }
  if (problems.length) console.error(problems.join('\n'));
  writeFileSync(OUT, JSON.stringify({ source: 'Wikidata (CC0 1.0)', retrieved, requests, records }, null, 1) + '\n');
  console.log(`wrote ${Object.keys(records).length} records`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));

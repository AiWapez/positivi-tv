# Animal facts

When a Planet or Science headline names exactly one animal from our list, its card shows a small "Good to know" box about that animal: its conservation category, sometimes how long a pregnancy lasts or how much an adult weighs, and its scientific name. The box states its source and links to the animal's English Wikipedia page. This page records where the facts come from, how each one is checked, and the rules a change must keep.

## Source and terms record

- **Source:** Wikidata, whose data is dedicated to the public domain under CC0 1.0 (checked 15 October 2026). The app never calls Wikidata. A person (or Claude) fetches about a hundred records once, `scripts/extract-wikidata-animals.mjs` keeps only the claims we may use, and the result is committed with the revision number of every record, so the build is pinned and repeatable.
- **User-Agent:** when records are fetched, the request sends a descriptive User-Agent, for example `PositiviTV-animal-facts/1.0 (https://github.com/AiWapez/positivi-tv)`, as Wikidata asks. The General Counsel approved this from the legal side.
- **Credit on the card:** "Facts: Wikidata (CC0), checked by PositiviTV on <date>." and a "Read more on Wikipedia" link to the animal's English Wikipedia page. The About dialog also names Wikidata.
- **Nothing is pasted.** Every sentence is written by PositiviTV from a Wikidata value. No Wikipedia sentence, and no sentence from any other site, is copied or lightly reworded.
- **IUCN Red List:** the IUCN's terms bar commercial use and redistribution of its data. Only the category word (for example "Endangered") is shown, as "Conservation status: Endangered (IUCN Red List)", with the words "IUCN Red List" linking to the IUCN's search page for the animal's scientific name. No population trend, range, assessment text or other IUCN data is used. The link form is unverified: the IUCN website could not be opened from the build environment.
- **Left out on purpose:** longest observed lifespan (Wikidata has it for about a third of the animals, but no second source confirmed any of those numbers, so none is shown); Encyclopedia of Life, USFWS ECOS and FishWatch (terms not confirmed); Animal Diversity Web, other IUCN data and YES! Magazine (non-commercial terms); any Wikipedia text or image; population numbers, ranges and trends.
- **For General Counsel:** see the handoff for this change. The finished file and the card wording go back to her for a final check before anything is merged.

## How each fact is checked

Alex chose a Builder cross-check, not a person checking each fact. The Builder (Claude, an AI model) does it like this:

1. `data/animal-facts/wikidata-source.json` holds the values from Wikidata. A scientific name and a category are kept when present. A pregnancy length and an adult weight are kept only when Wikidata gives one clear value (or one for each sex). Anything ambiguous, a birth weight, or a unit we do not know is dropped.
2. `scripts/check-animal-facts.mjs` looks for the same value in the English Wikipedia article for the species. The rules are strict: the number and the words for the fact are in the same sentence; a single number must be within 3 percent; a range must contain the value and be narrow; a lifespan must be said as a maximum ("up to 47 years") and must not be beaten by a larger maximum elsewhere in the article; "over 60 years" does not confirm 59; a weight for one sex must sit next to that sex's word, and a weight for both must not be a one-sex figure. Wikipedia is only read here. The log (`data/animal-facts/checks.json`) keeps the page's revision number and, for each fact, only "match" or "no-match" and the number found. It never keeps a sentence.
3. A fact that did not match is left out. The few cases that needed a decision are in `data/animal-facts/manual-review.json`, each with its reason. A written decision to drop a fact always wins over a match.
4. `scripts/build-animal-facts.mjs` writes `public/assets/animal-facts.json` from facts that passed. An animal needs at least two checked facts (its name and its category count) or it is left out. `npm run animals:check` fails if the committed file is not exactly what the data files produce.

Honest limits: the second source is not independent in the strongest sense, because Wikipedia's species boxes and Wikidata can draw on the same published literature. It does catch typing mistakes, stale entries (the green sea turtle's category changed in 2025 and the two sources disagreed, so no category is shown) and misread units. Conservation categories change over time; the date on the card says when they were last checked.

## Which animal a headline means

`animalForStory` in `src/lib/animal-facts.ts` reads only the headline, only for Planet and Science stories. It finds whole words, allows a plural, and tries the longest phrase first. It returns an animal only when the headline names exactly one animal from the list. Several things are on purpose:

- A general word does not pick a species: "elephant" and "African elephant" (two species share that name) match nothing, and giraffes are not on the list (both sources give one category for all giraffes together, and Wikipedia's own text says the northern giraffe is the most endangered, so the category for that exact animal is not confirmed).
- `data/animal-facts/blockers.json` holds phrases that contain an animal word but are not that animal ("sea lion", "Tiger Global", "leopard seal") and subspecies or populations that have their own category ("Sumatran tiger", "southern resident orca", "Cook Inlet beluga"). Their words are used up before the shorter animal name can match, so those headlines get no whole-species card.
- A sports team or a company named after an animal is in a different category, so it never gets a card.

## What the card shows

In this order, when each is available: **Conservation status** (category word plus "(IUCN Red List)", the last two words linked), **Pregnancy** ("lasts about 15 months"), **Adult weight** ("about 70 kg", or "about 29 kg for males and 24 kg for females"), **Scientific name**. Numbers are rounded to two figures and always say "about". Then the credit line and the Wikipedia link.

## Loading

The file (about 40 KB) is fetched once, from our own site (no change to the Content Security Policy), about a second and a half after a Planet or Science story is opened, so it never competes with the globe. If the download fails or the file is not shaped as expected, the card simply shows nothing and nothing is retried. A visitor's browser never contacts Wikidata, Wikipedia or the IUCN unless the visitor taps a link.

## Refreshing the data

Fetch the Wikidata records and the Wikipedia pages again (the URLs are in the header of each script), then run, in order: `node scripts/extract-wikidata-animals.mjs <date> <batches>`, `node scripts/check-animal-facts.mjs <date> <batches> --show`, read every fact that did not match, update `manual-review.json` if a decision is needed, then `npm run animals:build`. Run `npm run test:app` and send the changed file to the General Counsel before merging.

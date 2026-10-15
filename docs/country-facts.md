# Country facts

When a story has a place on Earth, its card shows up to three "Good to know" facts about that country, picked to fit the story, and a button that opens a full "About this country" page. This page records where the facts come from, how they are picked, and the rules a change must keep.

## Source and terms record

- **Source:** the CIA World Factbook, a US government publication in the public domain. The CIA closed the Factbook in February 2026, so the facts come from the frozen public archive "factbook.json" (github.com/factbook/factbook.json), whose data is dedicated CC0 1.0. The build is pinned to one commit (`144d6977b2b01ac1cbd220de754c0a005616760b`, September 2026) and refuses to run on any other.
- **Nothing is typed by hand.** Every sentence is the Factbook's own text with the markup removed. Each number keeps the year the Factbook gave it, for example "(2023 est.)". A fact longer than its limit is left out, never shortened.
- **Left out on purpose:** military, terrorism, refugee, religion and ethnic-group fields. The list of fields used is `FACTS` in `scripts/build-country-facts.mjs`.
- **Frozen:** these numbers will not update. The page says so plainly. If the Factbook is ever replaced by another source, that source needs its own terms check before it is used.
- **For General Counsel (not yet sent):** confirm that showing the archived Factbook text, with the source line on the country page, needs no further credit, and whether the source line wording is acceptable. No About-panel, Privacy-panel or security-policy wording changed.

## What gets built

`npm run facts:build -- <path to a factbook.json checkout>` writes `public/assets/country-facts.json` (about 680 KB, about 190 KB sent; 254 countries and territories, up to 29 facts each, eight topics: The country, Land and geography, Nature and environment, Energy, Health, People and culture, Economy, Science and technology). `npm run facts:check -- <path>` fails if the committed file is not exactly what the script produces. Names that two countries share (such as "Congo") are not used to find either country.

## How a story finds its country

`countryForLocation` in `src/lib/country-facts.ts` matches the story's place text exactly: the whole text ("Thailand") or the part after the last comma ("Clayoquot Sound, Canada", "Klamath River area, US"). It never guesses from inside a longer phrase. A story with no place on Earth (a space story or an unlocated story) gets no country facts.

## How facts are picked for a story

Each fact scores its topic's weight for the story, plus a bonus when its label answers a word in the headline (a salmon-and-dams story prefers "Fresh water"). A topic's weight comes from the story's category (Planet leans on nature, Science on science and energy, Community on people and economy, Health on health) and from whole words in the headline. General facts (area, size compared, highest point, natural resources) are shown only when the headline asks for them. The card shows at most three facts, at most two from one topic, each short enough for the card. The same story always gets the same facts. The country page lists every fact, grouped by topic, with the most relevant ones first.

## Loading

The file is fetched once, from our own site (no change to the Content Security Policy), about a second and a half after a story with a place is opened, so it never competes with the globe at load. If the download fails or the file is not shaped as expected, the card simply shows no facts and nothing is retried.

# Automatic publisher-feed lane (contract)

Status: integrated on the redesign branch on 14 October 2026. The global switch is enabled for preview verification. Production remains unchanged until release.

## 1. Purpose and policy

PositiviTV now has two publication lanes that are never conflated.

| Lane | `provenance` | Manifest status | Visible label | Who decides |
| --- | --- | --- | --- | --- |
| Reviewed edition (`content/edition.json`) | `reviewed` | `approved` / `archived` | Reviewed by PositiviTV | A recorded human editorial decision (unchanged GoodSignal workflow) |
| Publisher feeds (this document) | `publisher_feed` | `listed` | From publisher feeds | Deterministic rules over permitted publisher feeds, with no per-story human approval |

The automatic lane does not create, fake or imply a human review. It never writes `review`, never sets review checks, and never uses the `approved` status. GoodSignal's engine still has no automatic publication path; this lane sits beside it and uses its own explicit policy (`PUBLISHER_FEED_POLICY = publisher-feed-0.3.0`).

What the lane promises: a bounded list of recent headlines from sources whose terms were checked, each linking to the original article, labelled as automatically selected, with withdrawal, version and switch checks on every request.

What it does not promise: accuracy of the underlying reporting, that every listed item is good news, that every good-news item is listed, suitability for every reader or child, independent corroboration, or zero maintenance.

## 2. What a visitor sees

Each automatic card shows the source name, "Published <date>", "From publisher feeds", "Event date not confirmed; this is recently published reporting.", and, where applicable, "Research finding, not yet an outcome in use" or "Pin: approximate country centre from the headline" (or, for a publisher with one home country, "Approximate pin: placed in <country> because this publisher covers <country>. The headline doesn't name a place."). The headline is unmodified. Images are never imported; the existing category artwork is used. The About dialog and the Terms panel explain both lanes.

## 3. Dates (decision: show as recently published reporting)

Three dates are kept separate:

- `publishedAt`: the feed's publication timestamp (`pubDate` or Atom `published`), parsed and normalised. Items with a missing, invalid or future timestamp, or with only an Atom `updated` timestamp, are dropped individually; the batch continues.
- `fetchedAt`: when PositiviTV first retrieved the item. Later runs keep the original value; it starts the retention clock.
- `eventDate`: always `null` in this lane. Rules cannot establish when an event happened.

Nothing is ever filled with "now". The selected policy is to display these items explicitly as recently published reporting (label `event_date_unconfirmed`, required by validation) rather than omit them. To reduce old events reported as new, headlines containing a year before the current year, retrospective wording (anniversary, years ago, looking back) or a description phrase such as "inaugurated in 2019" are excluded. This is a heuristic: an old event described without a year can still pass, which is why the label is mandatory. Items leave the lane 30 days after publication (`windowDays`) or when the source's retention period ends, whichever is first. Since October 15, 2026 every enabled source keeps items for 30 days.

## 4. Screening rules and their limits

Implemented in `server/publisher-screen.ts`. It returns only "list with labels" or "exclude with reasons". It does **not** implement the GoodSignal v3 grounding, evidence-span, event-date, entailment or corroboration system, and it cannot read the article.

- Whole-word matching only, so "deadlift" is not "dead" and "award" is not "war".
- Always excluded (headline and the first 400 characters of the description): harm events, enforcement and legal action, conflict and crisis.
- Excluded when in the headline: opinion and dispute framing (including interviews, commentary and podcasts); governance, rights, labour and migration topics and institutional acronyms such as EU and UN; health topics including named diseases and case counts (these two groups match GoodSignal's never-automate topics); extractive and fossil industries (coal, oil, gas, mining, whaling, hunting, culls); economic distress and trend records ("record high", "new record", "record number", bleaching, sea ice); hype; promotion; retrospectives; alarm framing; questions, explainers and listicles; designs, proposals, funding, orders and money amounts; and any year earlier than the current year.
- Context-dependent words such as abuse, dead, flood, endangered, invasive or pollution are allowed only when the same headline states a recovery or protective outcome (shelter, survivors, restore, rescue, removal and similar). Verbs that also describe a problem coming back (returns, rebounds, released) do not count as recovery. Pests, algae blooms, melting, sinking and relocation count as context-negative.
- Plans and uncertainty (will, plans, aims, could, can, set to, "to open") exclude the item. Work in progress (begins, breaks ground, pilot) excludes it. A completed-outcome marker is required (opens, wins, restores, replants, returns, record and similar). Weak markers that often describe bad news (first, doubles, confirms, marks) do not count on their own.
- Studies, discoveries, observations, prototypes, and results attributed to researchers, scientists, engineers, teams or labs are listed only with the visible `research_finding` label, so research is not presented as an outcome in use.

Known limitations: word rules miss sarcasm, negation and context; they will exclude many constructive stories and can still list a misleading or unsuitable one; English only; categories come from the source or simple keyword hints; Health is never assigned automatically. In a dry run on 42 real headlines seen on 14 October 2026 (NASA, NSF, Global Voices, Mongabay), the first rule version listed 6 items that should not have been listed. Two independent review passes then tried about 90 constructed adversarial headlines and found further misses ("Violence returns to ...", "Arctic sea ice reaches record low", disease headlines, a new coal mine, a cull, funding announcements, lab results without a research label, wrong pins). The rules were tightened against every reported miss, and those headlines are now regression tests. The final version lists 6 of the 42 real headlines, all of which a reader would reasonably call constructive. This is tuning on small samples, not an accuracy measurement, and misses remain possible: for example "Polar bear spotted far from ice in Iceland" is still listed (with an Iceland pin), because nothing in the words marks it as bad news. Expect low volume: a handful of cards per day across the enabled sources.

## 5. Location

Implemented in `server/publisher-location.ts`, headline-only and strict. A pin is set only when the headline says "in", "across", "throughout" or "around" one recognised country, names no other recognised country, and the phrase is not an origin or base ("based in", "born in", "made in", "headquartered in" and similar). The pin is that country's approximate centre with `locationPrecision: "country"` and the `country_from_headline` label. Otherwise `lat`/`lng` are `null`, the location reads "Location not specified", and the story stays in the list without a pin. The publisher's location, the feed's regional theme, demonyms ("Kenyan") and descriptions are never used. Incidental mentions are filtered by these rules: an origin or base ("grew up in", "studying in", "famous in"), a country inside an opening clause other than a plain "In X," opening, and a country followed by a comma and a capitalised place ("Peru, Indiana") do not create pins. Validation rejects 0/0 for every card.

Limitations: no cities, regions or oceans; ambiguous names (Chad, Jordan, Georgia, Guinea, Niger, Congo, Korea, Turkey, Dominica, America) are not resolved; "in X" can describe a team or product rather than where something happened; multi-country stories stay unlocated. Set `"locationResolver": "off"` to disable pins for this lane entirely.

## 6. Identity, duplicates and attribution

- IDs are `<sourceId>-<first 24 hex characters of SHA-256(canonical URL)>`, from the existing collector. Tracking parameters are removed before hashing, so IDs are stable across runs.
- Exact URL repeats are merged. Headlines with token similarity of at least 0.6 published within 3 days are recorded as duplicate proposals for the maintainer, and both stay visible. Only near-identical headlines (similarity of at least 0.85) from different sources that both resolved to the same country are shown once, keeping the earliest-published item as the likely original. Two stories from one source, or with different resolved countries, are never merged. None of this is proof that two reports describe the same event.
- If the reviewed edition has ever given an ID a status (including withdrawn), or serves the same URL, the automatic lane does not show it. Editorial decisions always win.
- A suppressed copy adds nothing to the kept card. There is no "reported by N outlets", no evidence level and no independent-corroboration claim anywhere in this lane.
- Versions start at 1 and increase when the stored title, summary, category, location or labels change for the same ID. The manifest carries the version, so a changed card is refused until the client refreshes.

## 7. Sources and permissions (checked 14 October 2026)

Full records live in `config/feeds.json` under `sources.<id>.publisherFeed`. A reachable feed is not treated as permission.

| Source | Feed URL | Allowed domains | Terms checked | Fields used | Status |
| --- | --- | --- | --- | --- | --- |
| NASA | https://www.nasa.gov/feed/ | www.nasa.gov, science.nasa.gov | https://www.nasa.gov/multimedia/guidelines/index.html | title, link, date, shortened description | Enabled |
| U.S. National Science Foundation | https://www.nsf.gov/rss/rss_www_news.xml | www.nsf.gov | https://www.nsf.gov/policies/digital | title, link, date, shortened description | Enabled |
| Mongabay | https://news.mongabay.com/feed/ | news.mongabay.com | https://news.mongabay.com/copyright/creative-commons/ (CC BY-ND 4.0) | title, link, date, author, linked license | Enabled, headline only |
| Mongabay Happy-Upbeat topic feed | https://news.mongabay.com/feed/?post_type=post&topic=happy-upbeat-environmental | news.mongabay.com | https://news.mongabay.com/copyright/creative-commons/ (CC BY-ND 4.0, same site as Mongabay) | title, link, date, author, linked license | Enabled 2026-10-15, headline only, about two items a week |
| Global Voices Featured and Sub-Saharan Africa feeds | https://globalvoices.org/-/type/feature/feed/ and https://globalvoices.org/-/world/sub-saharan-africa/feed/ | globalvoices.org | https://globalvoices.org/about/global-voices-attribution-policy/ (CC BY 3.0, same site as Global Voices) | title, link, date, author, linked license | Enabled 2026-10-15, headline only |
| Mongabay India | https://india.mongabay.com/feed/ | india.mongabay.com | https://news.mongabay.com/copyright/creative-commons/ (believed CC BY-ND 4.0; coverage of the India edition unconfirmed) | title, link, date, author, linked license | Paused 2026-10-15 on General Counsel's ruling until bylines are checked and Mongabay confirms the license in writing |
| Global Voices | https://globalvoices.org/-/topics/good-news/feed/ | globalvoices.org | https://globalvoices.org/about/global-voices-attribution-policy/ (CC BY 3.0) | title, link, date, author, linked license | Enabled, headline only, low volume |
| The Conversation | https://theconversation.com/articles.atom | theconversation.com | https://theconversation.com/republishing-guidelines | none | Disabled |
| ScienceDaily | not configured | | https://www.sciencedaily.com/terms.htm | none | Disabled: terms forbid altering or omitting feed content and storing it in a database without consent |
| Positive News, Good News Network | not configured | | not verified for this use | none | Disabled: restrictive general reuse terms reported |
| Reasons to be Cheerful, Optimist Daily, Good Good Good, Upworthy, The Better India | not configured | | not verified | none | Disabled until verified |

### Terms records (General Counsel review, 15 October 2026; draft pending licensed attorney review)

These are the written records General Counsel asked for. They describe what the code does today.

- **Global Voices** (globalvoices.org/feed/), CC BY 3.0 per the Global Voices attribution policy, read 2026-10-15. Commercial use is allowed. Fields: title, link, publication date, author, license link. The headline is unchanged, and author, publisher, original link and license link show on every card. Third-party images and media are excluded and not imported. Items credited as republished from partners are blocked. robots.txt Crawl-delay 10 is honored, with one request per feed per run. GC reviewed 2026-10-15: cleared.
- **NOAA** (www.noaa.gov/rss.xml, enabled). U.S. federal government works are not under U.S. copyright. The NOAA National Ocean Service FAQ says most NOAA information is public domain unless a credit says otherwise, asks for credit to NOAA, and forbids implying endorsement or presenting modified content as official. Fields: title, link, publication date, shortened plain-text description. Third-party material and images are excluded, and NOAA logos are not used. robots.txt does not disallow /rss.xml (confirm with the fetcher's own check). A separate link to a NOAA river reference page (cnrfc.noaa.gov, KLMC1) supports the Klamath River map area and needs nothing more. GC reviewed 2026-10-15: cleared.
- **Mongabay India** (india.mongabay.com/feed/), believed CC BY-ND 4.0 as on news.mongabay.com, coverage unconfirmed. Fields: title, link, publication date, author, license link. Headline unchanged, no descriptions shown, no photos. robots.txt allows all with Crawl-delay 10. GC reviewed 2026-10-15: ON HOLD pending byline verification against five live article pages and written confirmation from Mongabay (rights@mongabay.com). The source is switched off until then.

Correction recorded 2026-10-15: NASA, NSF and NOAA items also keep a shortened plain-text description, so "headline, link, date, author and license only" is true for Mongabay and Global Voices only. The description is stored and served in the story data, but the app's cards do not display it today (check made on `src/components/StoryCard.tsx`). If a card ever shows it, add a plain "Summary shortened" label first.

Home-country pin (built, switched off): a source may set `defaultCountry` in its `publisherFeed` record. When the headline names no place, the card then gets that country's approximate centre pin with the label `country_from_publisher`: "Approximate pin: placed in <country> because this publisher covers <country>. The headline doesn't name a place." (wording approved by General Counsel on 2026-10-15). A place the headline does name always wins, and nothing happens for a source without the setting, with an unknown country name, or when the location switch is off. No source uses it today: General Counsel held the Mongabay India use (the India pin) until Mongabay India clears its own terms check.

Publisher place tags (on for the main Mongabay feed only): some publishers attach their own place facts to each post. Mongabay's WordPress API (the same one the byline lookup uses) gives every post Location tags in the core `class_list` field (for example `location-south-africa`, `location-asia`) and, on about a quarter of posts, a `coordinates` string the publisher chose for the story. A source with `placeFromPublisherTags: true` in its `publisherFeed` record may use them, in this order: (1) the publisher's coordinates, but only if they fall inside the padded outline of a country the same post is tagged with, rounded to one decimal place (about 11 km) so a card never shows a sharper spot than "approximate", label `area_from_publisher`: "Approximate pin: placed near the location the publisher gives for this story. It may be a nearby town or site, not the exact spot." (it names no country, because the padded outline means a pin can sit just across a border from the tagged country); (2) exactly one tagged country, that country's centre, label `country_from_publisher_tag`: "Approximate pin: placed in <country> because the publisher tags this story with that country. The headline doesn't name a place."; (3) otherwise no pin (Global only, a region or ocean only, several countries without usable coordinates, coordinates outside every tagged country). General Counsel reviewed the feature and both labels on 2026-10-15 (draft rulings pending a licensed New York attorney): the Mongabay tags and coordinates are facts used only to place a pin, not a modification under CC BY-ND 4.0, and the 11 km rounding must not be made finer. Combined with the headline rules: a curated map area from the headline always wins; a headline country plus a publisher point inside the same country uses the closer point; a headline country and a different publisher country disagree, so there is no pin (and not the home-country pin either). `server/publisher-place-tags.mjs` reads the two fields defensively, `server/publisher-place.ts` decides, and `server/country-boxes.json` (built by `scripts/build-country-boxes.mjs` from Natural Earth 5.1.2, public domain, with `npm run boxes:build` and `npm run boxes:check`) holds the padded country boxes used for the coordinate check. A 50-post sample on 2026-10-15 found a single country tag on 39 posts, coordinates on 13, several countries on 4, "Global" only on 6 and a region only on 1; on a detailed country map 10 of the 13 coordinate pairs fell inside the tagged country and the other 3 sat on a coast or border (Manhattan, the north coast of New Zealand, a forest on the Poland and Belarus border), which the padded outlines accept. The two Mongabay terms records (`mongabay`, `mongabay-upbeat`) now list the tags and coordinates in `permittedFields`. Status: on for the `mongabay` source since 2026-10-15, after General Counsel approval. Its `supplementalUrl` now also asks for `class_list` and `coordinates` (about 67 KB for 100 posts, inside the 2 MB fetcher cap, and no extra request, so the 60-second run budget is unchanged), and its `publisherFeed` record sets `placeFromPublisherTags: true`. A dry run on 2026-10-15 over the latest 100 posts found only 6 that pass the positive-news screen; with tags on, the pinned count moved from 2 to 4 (a Bolivia story and a Uganda story gained a country pin, and a Thailand story moved from the headline country centre to the publisher's point). Still off: `mongabay-upbeat` has no `supplementalUrl`, so it has no tags yet (a story that is in both feeds may keep the Upbeat copy without a pin). Adding the metadata request for it was approved by General Counsel with the per-host 10-second spacing and per-run robots check kept, but the run-time budget must be re-checked first, so it is not added. `mongabay-india` stays on hold. A test checks that only `mongabay` has the switch on and that its request asks for exactly the two cleared extra fields.

Same-host spacing (2026-10-15): feeds on one publisher host run one after another in a run, with at least 10 seconds between them (`HOST_SPACING_MS` in `server/publisher-refresh.ts`), so several feeds from Mongabay or Global Voices never hit the site at once and their robots.txt Crawl-delay of 10 is respected. Different hosts still run in parallel, at most three at a time. The slowest host today is news.mongabay.com (main feed with its two spaced metadata requests, then the Happy-Upbeat feed), roughly 35 to 40 seconds of a 60-second function limit. Add any further feed on an existing host with that budget in mind. Outside research suggested the Mongabay URLs `...&feedtype=bulletpoints&...` and `mongabay.com/xml/happy-upbeat_environmental1.xml`; the first errors and the second stopped in 2008, so neither is used.

Rules that apply to every source: only the configured feed URL and its robots.txt are fetched; article links are validated against the source's domains and are never fetched or added to the allowlist; headlines are not edited (a headline longer than 300 characters is excluded rather than shortened); descriptions are never stored or shown publicly (public-domain sources may show a shortened summary; every other description is kept only unchanged in the private teaching batch, below); feed images and third-party media are never imported; no endorsement is implied. Exceptions noted in the records: NASA insignia and third-party material, NSF visual media, CC-excluded photos at Mongabay and Global Voices.

## 8. Collection and storage

- `GET /api/refresh-feeds` is the only code path that contacts publishers for this lane. It requires `Authorization: Bearer $CRON_SECRET` (the same secret as `/api/collect`), accepts GET only, and is scheduled daily in `vercel.json` at 10:00 UTC.
- It reuses `fetchPermittedFeed` and `parseFeed` from `server/collect.mjs`, so the hardened `safeFetch` boundary applies unchanged: HTTPS only, domain allowlist, public-address enforcement with DNS pinning, redirect revalidation, 10 second timeouts, size limits (1 MB by default, 2 MB for the two large feeds, never above the fetcher's cap), robots.txt checks, and DTD/entity refusal.
- Sources are fetched with a concurrency of 3. One source failing keeps its previous still-eligible items. If every source fails, the job returns 502 and the previous snapshot is left untouched.
- Overlapping runs: a lock object (`publisher-feed/lock.json`, created with `allowOverwrite: false`, considered stale after 5 minutes and removed only by ETag) stops a second run before it fetches anything. The snapshot (`publisher-feed/current.json`) is replaced with an ETag precondition, so if two runs ever overlap, the slower one writes nothing and returns 409.
- The snapshot is private, capped at 500 items and 512 KB, and stores only the fields listed above plus per-source run counts and duplicate proposals for maintenance. Retention is applied when storing as well as when serving. An item that is still in a source's feed is never carried forward from an older run, so a corrected headline that the rules now exclude removes the old card.
- If the stored object's content is ever oversized, not JSON or not a snapshot, the next run replaces it (with the same ETag precondition) instead of failing repeatedly. A network or stream error while reading is a failure, not an empty snapshot: the run stops and writes nothing, so carried items and retention clocks survive. When the global switch is off, a scheduled run deletes the stored snapshot (best effort) and fetches nothing.

## 9. Visitor path

`GET /api/stories` reads the stored snapshot and never fetches feeds. Query strings, including the client's refresh parameter, are ignored. The snapshot is cached in memory per server instance (30 minutes after a good read, 60 seconds after a miss, failure or an invalid stored object, keeping the last good copy) and read with the Blob CDN cache enabled. Withdrawals, switches, domains, the window and retention are rechecked on every request, so a cached snapshot cannot override them. Responses stay `no-store` and carry a fresh manifest; the existing 25 second polling and 30 second display check apply to both lanes. If the snapshot cannot be read, the reviewed edition is served alone and `publisherFeed.status` is `unavailable`. A malformed stored row is skipped on its own. The browser also checks that each card's provenance matches its manifest status (`reviewed` with `approved`/`archived`, `publisher_feed` with `listed`).

## 10. Switches and withdrawals

- Global: `config/publisher-feed.json` `enabled`. When false, nothing is collected or served from this lane, and the next scheduled run deletes the stored snapshot.
- Per source: `config/feeds.json` `sources.<id>.publisherFeed.enabled` (or `sources.<id>.enabled`).
- Withdraw a card: add `{ "id": "...", "reason": "...", "at": "YYYY-MM-DD" }` or `{ "url": "https://...", "reason": "...", "at": "..." }` to `withdrawn` and redeploy. The manifest then reports `withdrawn` and clients drop the card at their next status check. Like the reviewed edition, removal takes effect after deployment and does not alter older immutable deployment URLs.

## 11. Setup on existing free infrastructure

1. Merge the candidate after review. No new dependency is added; `package.json` is unchanged.
2. Confirm the existing private Blob store (`positivitv-editorial-queue`) and `CRON_SECRET` are configured for Production. No new service or key is needed.
3. Set `"enabled": true` in `config/publisher-feed.json` when ready, then deploy to Production. Cron jobs run only on the production deployment.
4. Optionally run the job once immediately: `curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/refresh-feeds`. Expect a JSON summary per source.
5. Check `/api/stories`: `publisherFeed.status` should be `ok`, and cards should show "From publisher feeds".

Optional more frequent refresh: a GitHub Actions scheduled workflow can call the same endpoint with the secret stored as a repository secret. It is not included as a file because it would start running on merge. Scheduled workflows can be delayed, and GitHub disables them after 60 days without repository activity in public repositories.

Limits, as checked on 14 October 2026 (verify current values on Vercel's pricing pages before relying on them):

- Vercel Hobby cron: once per day per job, with timing anywhere inside the scheduled hour.
- Vercel Blob on Hobby: 1 GB storage, 10,000 simple operations, 2,000 advanced operations and 10 GB data transfer per month. Exceeding the allowance blocks Blob access for 30 days, which would also stop the private editorial queue.
- This lane's expected use: about 2 advanced and 2 simple operations per scheduled run (about 60 of each per month), plus visitor-path reads limited to one per server instance per 30 minutes and only counted on a Blob cache miss. Busy traffic across many instances raises the read count; watch Blob usage in the Vercel dashboard and raise `okTtlMs` in `server/publisher-store.ts` if needed. Function invocations for `/api/stories` are unchanged in number, since the endpoint already runs per request.
- Publisher limits still apply: Global Voices and Mongabay set a 10 second crawl delay; this job makes one feed request per source per run.

## 12. Maintenance this needs

Someone must recheck source terms periodically, read the per-source `excluded` counts and duplicate proposals in the snapshot, withdraw bad cards, and adjust rules when they misfire. Feed URLs and formats change. This is lower effort than per-story approval, not zero effort.

## 13. Unresolved decisions

1. The lane is enabled on the integration branch for preview testing; release to production remains separate.
2. The Conversation: whether listing headlines automatically counts as "systematic republishing", and robots.txt could not be verified here. Disabled until decided.
3. ScienceDaily's separate grant for `/releases/` headlines and summaries: not used, because the general RSS terms forbid omission and storage.
4. Attribution is implemented: Global Voices and Mongabay require supplied author credits, publisher and original article links, and linked CC licenses. Missing authors, explicit restrictive item-rights notices and recognized third-party/syndication credits are excluded. No descriptions or images are displayed for those sources. Undisclosed licensing exceptions cannot be detected reliably from a feed; source policy review remains necessary.
5. Duplicate display: near-identical cross-source copies (similarity of at least 0.85, same location) are hidden; everything else is only proposed. Decide whether to show all copies with a "similar story" note instead.
6. The supported-feed resolver is enabled: physical outcomes may use an explicit headline-country relation or an unambiguous named physical feature from a small, sourced gazetteer. Coordinates are broad reference points, never exact event sites. Unsupported stories stay unpinned.
7. Whether to add a GitHub Actions schedule for more than one refresh per day.
8. Withdrawal requires a redeploy. A faster path would need a shared status store.
9. The release content gate supports publisher-only editions: `npm run release:check -- --publisher-snapshot /private/path/snapshot.json`. It reads a private exported snapshot, does not crawl or approve, and rejects empty or stale content. Without a snapshot it checks the reviewed edition alone. Never commit the private snapshot.
10. Global Voices volume is low on the good-news topic feed. The main feed (https://globalvoices.org/feed/, fetched on 14 October 2026) has more items, but most are political and would be excluded.

## 14. Files

| File | Role |
| --- | --- |
| `api/refresh-feeds.ts` | Authenticated scheduled endpoint for this lane |
| `api/stories.ts` | Visitor endpoint; serves the edition plus the stored snapshot, never crawls |
| `server/publisher-refresh.ts` | One collection run: lock, fetch, build, compare-and-swap write |
| `server/publisher-screen.ts` | Headline screening rules |
| `server/publisher-location.ts` | Headline-only country resolver |
| `server/publisher-place.ts` | Publisher place tags and coordinates into an approximate pin (on for the main Mongabay feed only) |
| `server/publisher-place-tags.mjs` | Defensive reader for a post's `class_list` location tags and `coordinates` |
| `server/country-boxes.json` | Padded country boxes for the coordinate check, built by `scripts/build-country-boxes.mjs` |
| `server/publisher-snapshot.ts` | Pure snapshot builder, deduplication, summaries, size limit |
| `server/publisher-store.ts` | Private Blob storage, run lock, visitor-path cached reader |
| `server/cron-auth.ts` | Bearer `CRON_SECRET` check |
| `src/lib/publisher-feed.ts` | Snapshot types and request-time projection into public cards |
| `src/lib/publication.ts` | Public card contract for both provenances |
| `config/publisher-feed.json` | Global switch, window, caps, resolver, withdrawals |
| `config/feeds.json` | Feed URLs, lanes and per-source permission records |
| `tests/app/publisher-*.test.mjs` | Lane tests (fixtures in `publisher-fixtures.mjs`) |

## Integration verification

Node 24.19.0 local baseline: all 162 supplied tests and the build passed before integration amendments. Additional tests cover author extraction, required attribution, recognized third-party credits, restrictive rights notices, license-link validation, author version changes and the publisher-only release content gate. See `verification.md` for the exact final check results. Browser/device checks remain unperformed.

Real preview run, 14 October 2026: all four enabled feeds fetched successfully through the application fetcher; 7 stories were persisted and served. NASA contributed 4 and Mongabay 3. Unauthenticated collection returned 401. Reader refresh with a timestamp parameter returned the same saved revision. This does not establish screening accuracy or prove a recurring production cron has run.

## Supported map areas (policy 0.3)

`server/feed-location.ts` requires a physical-outcome headline and a local relation or geographical scene-setting opening. Origin/base, ambiguous multiple-feature, nonlocal research and off-Earth stories abstain. Known features come from `src/lib/map-places.ts`, currently Clayoquot Sound and the Klamath River. This is a deliberately small, expandable gazetteer, not broad worldwide place-name recognition. Country fallback retains the existing conservative headline-country relation and is explicitly labelled as a country reference.

Clayoquot Sound uses the Canadian Geographical Names Database point (49.233333, -126.044444): https://geonames.nrcan.gc.ca/search-place-names/unique?id=JADRA. The Klamath area uses the NOAA lower-river reference point (41.51, -123.98): https://www.cnrfc.noaa.gov/obsRiver.php?id=KLMC1. It does not locate the precise salmon observations or removed dams. Registry area radii are conservative display areas, not measured confidence intervals. The point source is linked from the selected card, and cards and accessible pins disclose approximation.

No new article fetching, geocoding API or paid service is added. Feed description text is used in memory and not retained or publicly quoted for location evidence. Stored/public area metadata contains a place ID, input-field basis, reference URL and display-area size. Projection checks named-region coordinates and metadata against the sourced registry. Changing geography changes the story version. The initial live selection opens a mapped card when available, globe discovery prefers other mapped cards, and selecting an unlocated story returns to the overview.

## Coverage and image amendment

The current policy is `publisher-feed-0.6.0` (0.6.0 closes thirteen gaps in the screening rules and only ever holds more stories back; see "Policy 0.6.0" below. 0.5.0 added the person-approved "Picked by PositiviTV" list described below; 0.4.1 added rejection of unresolved trafficked-animal journeys; see coverage and photos), with a 30-day publication window and policy-scoped private snapshot paths. It supplements Mongabay RSS with bounded keyless metadata and real byline records. Public cards may use only the checked local illustration catalog. See [coverage and photos](coverage-and-photos.md) for the exact boundaries and attribution rules. Earlier no-image and fixed snapshot-path descriptions above describe the original candidate.

Stricter-only rule fix, October 19, 2026: several exclusion words matched only their singular form (for example "governor" but not "governors", and likewise mayors, councils, treaties, massacres, famines, pandemics, investigations and prime ministers). Their plural forms are now excluded too. This change can only exclude more stories, never list more, so the policy version stays `publisher-feed-0.4.1` and the stories already on the site are not dropped. Before the change, the 12 cards the site was showing were re-checked against the new rules by headline and all still pass; a carried card is not re-checked against its description until it appears in a feed again. A comparison over the 144 headlines of the October 16 sample found no decision that changed in either direction. Approved by General Counsel (draft ruling of October 19, 2026).

### Same-day pull-down and off switch (no redeploy)

Two controls live outside the deployment, in the project's Vercel Global Config store (formerly Edge Config), so they take effect without a redeploy. Alex can change them from the Vercel dashboard on his own (Storage, then the Global Config store, then its items), and the Builder can change them too.

- `publisherLaneOff`: set to `true` to pause the whole automatic lane. The reviewed edition is still served. Set it back to `false` (or delete it) to resume.
- `withdrawnStories`: a list of stories to take off the site. Each entry is either the story's original article link (the "Read the original" link on its card) or its story id, for example `["https://news.mongabay.com/2026/10/example-story/"]`.

How fast: each server copy re-reads the controls at most every 3 minutes, and Global Config takes up to 10 seconds to spread, so a change normally shows within about 3 minutes. Open browsers re-check every 25 seconds while the page is visible and drop a withdrawn card when they see it.

Safety: these controls can only pause or hold back. They can never list a story, add a story type, loosen a rule, or switch on a lane that `config/publisher-feed.json` has switched off. If the store is connected but cannot be read, or holds a value the code does not understand (a wrong type, an entry that is neither a link nor a story id, or more than 500 entries), the automatic lane is paused until a good read. Each copy keeps its last good read through a short outage. When no store is connected, the config file alone applies, exactly as before. The file's own `withdrawn` list still works and is kept.

Cost: the Hobby plan includes the first 100,000 Global Config reads and at least the first 100 writes a month (Vercel pages give 100 or 250), one store, and up to 1 MB. The 3-minute memory cache keeps visitor traffic far below the read allowance, and the reads happen only when someone loads the site. Exceeding a Hobby allowance pauses that feature for up to 30 days, which would pause this lane (fail closed) rather than show withdrawn stories.

Setup, once, after this change is merged: create one Global Config store, connect it to the PositiviTV project (Vercel then adds the `GLOBAL_CONFIG` variable), add the two keys with `false` and `[]`, and redeploy once so the variable is picked up. Required by General Counsel before any new story type is turned on (draft ruling of October 19, 2026).

### Private teaching batch (built, off until the key exists)

Purpose: give Alex labeling sessions at any hour, so story types can be tested on fresh days without the one-hour runtime logs. Approved by General Counsel (draft ruling and addendum of October 19, 2026; Project doc `claude/gc-ruling-self-managing-lane-oct19.md`).

Method: the existing daily run, at its usual hour and with the same fetcher, User-Agent, allowlist, robots check and spacing, hands the records it already screened to `server/teaching-batch.ts` after the snapshot is stored. No extra publisher request is made. The code saves one release file a day to an Alex-only private GitHub repository: tag, title and notes `batch-YYYY-MM-DD`, file `batch-YYYY-MM-DD.json`. Each record holds only the source name, link, headline, publication date, decision, reason codes, policy version and a description, never a summary or author name. The description is the publisher's own feed description, kept unchanged as plain text (General Counsel ruling, October 21, 2026): only HTML tags, links and images are removed, entities become their characters, white space is made single spaces, and the feed's own "The post ... appeared first on ..." footer is dropped. A description over 600 characters is cut at a whole sentence and ends with "(shortened)"; if the first sentence alone is longer, none is kept. None is kept either when the wording suggests the text belongs to someone else ("republished from", "originally published by", wire services, "courtesy of", "all rights reserved" and similar). Only sources whose terms record sets `teachingDescription` (the nine enabled sources) have one. Items excluded for a blocked credit or a restrictive rights notice never reach the batch at all, so they keep neither a description nor a headline there. The description lives only in the private batch file and on Alex's owner-only labeling page and is deleted with its batch (14 days at most, and the 30-day labeling-page limit still applies), except for stories Alex labels, which may be copied into the private training archive described below. It is held apart from the screened records, so it cannot reach the run log, the public snapshot, the run report or any committed file, and a test checks each of those. On every run it first deletes any batch more than 14 days old (release, file and tag), then saves the day's batch. A second run on the same day replaces that day's file. Logs print counts and HTTP status codes only. The save is limited to 15 seconds per run, and no failure (including an expired key) can change the snapshot, the listings or the run's result. Batch data is never committed to any repository; the code has no path that writes a commit, a file, a branch or any ref other than deleting its own `batch-*` tags, and a test checks every endpoint it can reach.

Switch: off unless both `TEACHING_BATCH_REPO` (for example `AiWapez/positivitv-teaching`) and `TEACHING_BATCH_TOKEN` are set as production-only Vercel variables (the token as a sensitive variable).

Key: a fine-grained GitHub key limited to that one repository, with Contents read and write only (needed to create and delete releases; it would also allow commits, which this code never makes), and a 90-day expiry with a renewal reminder for Alex. Key scope and expiry date: not yet created. If the key ever leaks: revoke it at once, delete every release, tell General Counsel and Cybersecurity, and record the incident here.

Read sessions: before anything else, any batch older than 14 days is deleted. Nothing may exist past day 16. On day 15 after the first batch, confirm here that it is gone. Stories loaded into the private labeling page are deleted when scoring is done and no later than 30 days after collection.

Deletion log: none yet.

### Private training archive (General Counsel ruling, October 22, 2026; draft pending licensed attorney review)

Purpose: the 14-day limit on the teaching batch was a cautious default, not a legal requirement, and it works against building evidence. For stories Alex has labelled, a long-term private archive replaces that limit. The daily batch files keep their current release-file method and their 14-day deletion. The archive is a separate, deliberate copy of the labelled stories. Project doc: `claude/need2know-idea-and-shelf-oct22.md` records why Alex asked for it (a possible sister product, working name Need2Know). The ruling replaces the 14-day cap in the October 19 addendum and the October 21 description ruling for archived stories only.

What the code does (`server/private-archive.ts`, `scripts/build-archive.mjs`, tests in `tests/app/private-archive.test.mjs`):

1. **Contents.** Each line holds source name, link, headline, the publisher's description (unchanged apart from the existing plain-text and "(shortened)" rules), publication date, Alex's label, reason codes, policy version and label date. Nothing else is copied, so no author names, no images and no summaries. A test checks the field list.
2. **Per-source permission.** Every source's terms record sets `archiveAllowed` to true or false. It is true for Mongabay, Mongabay Upbeat, all four Global Voices feeds, NASA, NSF and NOAA. It is false for Mongabay India and for The Conversation. A new source starts false until General Counsel has checked its terms for a no-database clause. A source name is archived only when every source using that name is switched on and allows it. A test fails if a source leaves the setting out.
3. **Exclusions still apply.** Items with a blocked credit or a restrictive rights notice are dropped before the teaching batch is made, so they never reach the archive. A record that carries a third-party credit code keeps only its link and label.
4. **Private only.** The archive is never shown publicly, never placed in this repository and never logged. The script refuses to write anywhere inside this repository, `archive/` is ignored by git, the module has no network, file, environment or logging access (a test checks the source), and the script prints counts only.
5. **Storage.** A dedicated private archive repository with Alex-only access and its own key limited to that one repository. Commits are allowed there, because the data is kept on purpose. The dedicated repository is a PositiviTV training archive repository , not a Need2Know repository; the Need2Know links-and-labels record lives in its own folder inside it (General Counsel, October 22, 2026). Not yet created. Security Lead review is required before the first write. In this project the Builder holds the Application Security Lead role, so the review is the written checklist below, recorded in the security log and on the pull request, with the cybersecurity directors' standing rules applied and Alex's yes. The script writes a local file and does not push; pushing is a separate step done by Alex or with the scoped key after that review.
6. **Removal.** A publisher's removal request deletes that publisher's items from the archive, history included, within 7 days.
7. **Review.** The archive is reviewed once a year (first review due October 22, 2027). It is deleted if PositiviTV's screening work ends.
8. **Privacy Policy wording.** Before the Privacy Policy is published, section 8 changes to: "We keep the story information we store, which is headlines, links, dates, author names and short descriptions from publishers. Public listings drop off after 30 days. We keep a private archive of past stories to test and improve how we choose stories, and we delete a publisher's stories from it if they ask." This is a legal text change and needs General Counsel's text and Alex's yes when the policy is written.
9. **Terms records.** Each source's terms record has a `retentionNote` saying public listing lasts 30 days (7 for The Conversation) and that private archive retention is set by this ruling. The older "up to 14 days" sentence in `exceptions` now also names the archive.

Temporary exception to condition 5 (General Counsel, October 22, 2026; ends no later than October 29, 2026; draft pending licensed attorney review): at Alex's request the first two archive files may live for up to seven days in the existing private teaching repository, so the labelled stories are saved while the dedicated repository is made. Rules for the week:

- Preferred method: one release named `archive-2026-10-22` with date-only file names (`2026-10-21.jsonl`, `2026-10-22.jsonl`), not committed files. This uses the release permission the key already has and keeps the October 19 no-commit rule. The daily 14-day deletion skips any release whose tag starts with `archive-` (`server/teaching-batch.ts`; a test checks it).
- Only if a release truly cannot be used, committed files in an `archive/` folder are allowed for this week only. After the move the archive must then also be removed from that repository's history (a history rewrite, or deleting and recreating the repository), and the no-commit rule applies again in full.
- The fields are exactly the nine above, from sources with `archiveAllowed` true only.
- Log the save on the day it happens and the move on the day it happens, in the archive log below and as a pointer in the General Counsel log. Each entry gives the date, the file names, the story counts and the location.
- When the move is done, delete the archive from the teaching repository the same day so only one copy exists. Confirm on November 3, 2026 that the teaching repository holds no archive files.
- If the move has not happened by October 29, 2026, stop adding new archive files to the teaching repository and tell Alex and General Counsel. Never delete the existing archive because of a missed deadline. Any extension needs a new General Counsel note.
- If the teaching key leaks during the week, revoke it and treat the archive as exposed. It holds no personal data, so no breach notice is expected, but record the incident.

Security Lead checklist before the first write (the archive repository does not exist yet; every line must be confirmed and logged by date):

- The repository is private, owned by Alex's account, with Alex as the only collaborator, forks off, no Actions, no deploy keys and no installed apps.
- The key is a fine-grained token limited to that one repository with Contents read and write only, a 90-day expiry and a renewal reminder. It is never added to Vercel or any other runtime, and it is not the teaching key.
- Secret scanning and push protection are on if the plan offers them for private repositories. The main branch blocks deletion. Force pushes stay blocked except during a removal request, when they are switched on for that one job and off again the same day, with the minutes logged.
- The first push contains only `archive/YYYY-MM-DD.jsonl` files (and the optional Need2Know folder). The Builder lists the repository contents after the push and confirms nothing else is there.
- Removal request procedure: delete that publisher's lines, rewrite history so they are gone from every commit, confirm by searching the repository, and record the date. All within 7 days of the request.
- If the key leaks: revoke it at once, treat the archive as exposed, tell General Counsel, and record the incident here.

One label per story: the same story can arrive through several feeds and be labelled more than once. If the answers differ, the most cautious one is filed (Reject, then Unsure, then Keep), so a story Alex also rejected is never archived as a Keep, and the number of such stories is reported as a count.

How a day is archived: download the day's batch file from the private teaching repository, export Alex's labels from the labelling page, run `node scripts/build-archive.mjs --batch <batch file> --labels <labels file or folder> --out <folder outside this repository>`, and move the resulting `archive/YYYY-MM-DD.jsonl` into the private archive repository once it exists and has been reviewed. Do this before the batch is deleted on day 14.

Archive log (dates only, no content):
- October 22, 2026 (saved October 23, 2026 UTC): two archive files, `2026-10-21.jsonl` (139 stories) and `2026-10-22.jsonl` (144 stories), saved as the release `archive-2026-10-22` in the private teaching repository under the General Counsel's temporary exception (ends no later than October 29, 2026). Nothing was committed as a file. The move to the dedicated private archive repository is due by October 29, 2026; on the day of the move the archive is deleted from the teaching repository so only one copy exists, and that is logged here.
- October 23, 2026: the move into the dedicated private archive repository was done. The repository was created private with no README, license or description, Actions disabled, one collaborator (the owner), no deploy keys and no webhooks. One commit holds exactly two files: `archive/2026-10-21.jsonl` (139 lines, 59,780 bytes, SHA-256 starts `136519f6`) and `archive/2026-10-22.jsonl` (144 lines, 107,667 bytes, SHA-256 starts `7597212f`). Both were downloaded back from the new repository and matched. No key was created for this manual move, under the General Counsel's October 23 wording for manual moves from Alex's own signed-in computer. Two accepted deviations are recorded privately.
- October 30, 2026: the temporary copy was deleted from the teaching repository, the release `archive-2026-10-22` and its tag, after a check that the release held exactly the two files (59,780 and 107,667 bytes) and that the archive repository still held both files with 139 and 144 lines and the same checksums. This was one day after the October 29, 2026 end date of the temporary exception. The cause was a delay in the sessions that could delete releases, not any change to the archive, and the archive was not deleted because of the missed date. After the deletion the teaching repository holds no `archive-` release or tag, and the `batch-` releases from October 21 to October 30 are untouched. The Security Lead and the General Counsel were told. Only one copy of the archive now exists. Still to do: on November 3, 2026, confirm again that the teaching repository holds no `archive-` releases or tags, and delete the checksummed backup folder on Alex's computer.

### Counts-only run report

`GET /api/run-report` is a small public page of counts from the last automatic run, built from the snapshot the daily run already stores. It lets the daily result be checked at any hour without the one-hour runtime logs or an in-app approval. For each source it gives whether the feed was collected, not reached or switched off, the time of the check, the number of candidates, how many were listed, carried or not listed, how many runs in a row were quiet or not reached (see below), and how often each reason code held a story back (one story can have several reasons). It also gives the screening policy version and anything paused. It never contains headlines, descriptions, links, story ids, collector error text, visitor data or IP addresses. Wording for publishers is neutral ("not listed", "held back", "not reached"), and the page carries this note: "Counts from PositiviTV's automatic story selection. Not listed doesn't mean a story is wrong; it means our rules didn't pick it." Approved by General Counsel (draft ruling of October 19, 2026); no Privacy Policy change is needed.

### Quiet-source counts (Security Lead, October 26, 2026)

Why: on October 26 the base Global Voices feed returned 0 candidates and still showed "collected", because the feed was live but every item was older than the 30-day window. Nothing alerted. The same silent pattern had cost an earlier project days (the Ernds email lesson), and NOAA has been "not reached" for days with no notice.

What it is: two whole-number counts per source, kept in the stored snapshot and shown in the run report. `quietRuns` is how many runs in a row reached the feed and got no usable items. `unreachedRuns` is how many runs in a row could not reach the feed. Each goes back to 0 on the first run that does not match. A switched-off source holds both at 0.

Rules:
- Observation only. Neither count is read by any decision about whether a story is listed, carried or picked. `tests/app/quiet-runs.test.mjs` builds and projects two snapshots that differ only in these counts and checks the story lists are identical.
- The previous count is read from the stored snapshot only as a whole number from 0 to 10,000. Anything else counts as 0. A count never grows past 10,000.
- A policy-version change starts a fresh snapshot, which resets every count to 0 (the previous snapshot is ignored when its policy differs).
- Merge timing for a policy change: before each policy-change merge, tell Alex how many stories (picked ones included) will drop until the feeds show them again. A policy change also resets `quietRuns` and `unreachedRuns`, so a quiet or unreached source starts counting again from 0 after the merge.
- Label-only sources stay out of the public report and out of the log line, so their counts are never shown (#58). They are still kept privately in the snapshot.
- When a source has either count at 2 or more, the daily run writes one counts-only line to the run log: `quiet source: <source id> quietRuns=<n> unreachedRuns=<n>`. No host, error text, headline or story id.
- A run in which every source fails keeps the previous snapshot unchanged, so the counts do not move on such a run.
- Someone has to see it: a weekly scheduled check reads `/api/run-report` only (no secret) and messages Alex only when a source shows `quietRuns` or `unreachedRuns` of 2 or more. It says nothing when all is well. The schedule needs Alex's approval; see the Builder Sessions log.

## Screening sample (temporary)

Why: the headline rules in `server/publisher-screen.ts` have only been tuned on small samples. `docs/goodsignal-spec.md` section 13 asks for roughly 300 real candidates, rejects included, labelled by a person, before anyone claims the screening works. The daily job used to count rejected stories and discard them, so no such set existed.

How it works:

- `config/publisher-feed.json` has `screeningLogUntil`, a UTC date. While a scheduled run happens before midnight (UTC) at the start of that date, the run writes what the headline rules decided into the private run log (`console.log`, lines starting `screening-sample`). Vercel Hobby keeps runtime logs for one hour, so nothing is stored long term. A missing or malformed value means off. The switch expires by itself; extending it needs a new config change and a merge. Set to `2026-10-20` it covers the runs of October 16 through 19. Only the October 16 run was read in time: the October 17 and 18 logs were gone before they were read, because reading the run log needs a person to approve it in the app inside the one-hour window. The extension to October 19 is a deliberate one more morning, to get a fresh set of stories that the rules were not tuned on. It changes nothing else.
- Nothing is written to Blob, no endpoint reads it, and no secret is involved. Records are packed in order onto as few lines as fit under 1,700 bytes each (`SCREENING_LOG_MAX_LINE`), because the tool that reads the run log cuts every message off at about 2,000 characters and a cut line loses its last records for good. A record is never split across lines, and each line says which part of how many it is (`part`, `of`) and how many records the run had in all (`total`). A record has `id` (source id plus a hash of the canonical link), `source`, `url`, `title`, `published`, `summary`, `decision` (`list` or `exclude`), `reasons`, `labels` and `category`. The same story that sits in two feeds of one publisher gets one record per feed, with different source ids and the same link hash.
- Only candidates that reached the headline rules are recorded: they passed the link, date, window, author and rights checks first. A story that is dropped earlier (for example, a missing author at Mongabay or Global Voices) never reaches the rules and is not in the sample, so the sample measures the rules, not those earlier checks.
- `summary` is the shortened plain-text description the lane already stores, and only for sources whose terms allow storing one (NASA, NSF, NOAA). It is `null` for Mongabay and Global Voices, so no description from those sources is logged. The rules still read the real description in memory when deciding, as they always did.
- The observer is a callback (`onScreened`) on the pure snapshot builder. A test checks that the snapshot is identical with and without it, that a throwing observer changes nothing, and that a failing log cannot fail a run.

How the sample is used (General Counsel rulings of October 15, 2026, draft pending licensed attorney review): the Builder reads the lines from the run log within the hour and puts the stories on a private page that only Alex can open, one story at a time, with Keep, Reject and Unsure buttons and the rules' decision hidden until he answers. The source name and link are shown with each story. The report compares his labels with the rules' decisions, with uncertainty ranges, against a plain keyword filter and a newest-first list. The overlap labelled as a second opinion is labelled by an AI, not a second person, and the report must say so. The stories are deleted from the private page when scoring is finished, and no later than 30 days after collection; the actual deletion date is recorded below. The public repository keeps only hashed IDs, Alex's labels and the rules' decisions, never headline text. Any second one-time pull through a fetch service needs a new General Counsel ruling; this log is the route that uses our own fetcher.

What the first run, October 16, 2026 (it ran at 10:54 UTC), taught us. The rules looked at 174 candidates. At that time a line held up to 5 records, which is more than 2,000 characters, so the log reader cut off the last one or two records of every line: 134 complete records came through and about 40 were lost. The loss follows a position, not a topic (it is the fifth and sometimes the fourth record of each group of five), but it was not perfectly neutral. At least three of the lost records are stories the rules listed, which can be seen in the cut-off tails of the lines. Of the 134 recovered records, 11 were the same story seen in more than one feed, and each story was counted once (123 distinct stories). Only 2 of those 123 had been listed by the rules. So that the "listed" side of the check is not close to empty, the 10 other stories that the live site was showing at that point were added to the private page from the site's own saved snapshot, with the rules' decision recorded as "list". Some of those 10 were listed by the October 14 run and carried forward without being re-checked, because stories that have dropped out of a publisher's feed stay for their 30 days. Carrying only happens while the screening policy version is unchanged (`publisher-feed-0.4.1` at the time), so those decisions come from the same policy version, but they were not re-run on October 16. The result is that the listed side is every story the site was showing, while the excluded side is a sample from which about a quarter of that run's candidates are missing. The whole-line packing above was written to stop this from happening again on the runs of October 17 and 18.

Deletion date of the private page: not yet collected.

### October 15, 2026: one-time pull through a fetch service (stopped, nothing obtained)

Alex gave the go for a one-time pull under the General Counsel's conditions. What happened, for the record:

- Service: the Exa web fetch tool. Its requests carry the service's own User-Agent, not a PositiviTV one, and our own fetcher's protections (domain allowlist, size limits, robots.txt check) did not apply, so they were honoured by hand.
- robots.txt, read at about 23:53 UTC: NASA allows all; NSF does not disallow `/rss/rss_www_news.xml`; Mongabay allows all; Global Voices has `Crawl-delay: 10` and does not disallow the feed paths; NOAA's robots.txt could not be read through the service (error `CRAWL_UNEXPECTED_CONTENT_TYPE`), so NOAA was skipped.
- Feeds requested, at about 23:54 UTC, one request each: NASA (`https://www.nasa.gov/feed/`) and NSF (`https://www.nsf.gov/rss/rss_www_news.xml`). Both came back with the service's own error `CRAWL_UNEXPECTED_CONTENT_TYPE` (it refuses feed content types) and returned no content.
- Because the conditions say to stop on any error response, nothing more was requested: no Mongabay, Global Voices or NOAA feed was ever requested, and no retry was made.
- Nothing was stored, so there is nothing to delete. The screening sample above is the route that replaced this pull.

## Reader view: new this week, previous stories and read state (October 15, 2026)

The reader opens on stories PositiviTV first collected in the last 7 days. A "Previous positive stories" button shows everything still inside the 30-day window. Opening a story marks it read in that browser only (`positivitv.read.v1` in local storage, capped and pruned after 120 days); its pin dims at once and stays on the globe (an earlier version removed read pins after the next daily update; that was changed because the globe then looked empty after a few days of testing). Read stories stay in the list, after unread ones, labelled "Read". The Privacy panel explains this and offers "Clear reading history". Nothing about reading is sent to a server, and each device keeps its own history. A screening-policy version change starts a fresh snapshot, so every story then counts as newly collected for 7 days; read state is kept because story IDs do not change.

## Permanent stricter-only check (General Counsel condition, October 23, 2026; draft pending licensed attorney review)

Every screening-policy change must be shown to be stricter only, and not just once. `scripts/check-stricter-only.mjs` runs the screening rules from two checkouts (the old policy and the new one) over every saved labelled story and asserts two things: no story is listed by the new policy unless the old policy listed it, and no story is pickable under the new policy unless it was pickable under the old one (pickable means held back only for the reasons a person's pick may override). It exits with code 1 if either fails.

The labelled sets hold publisher text, so they never enter this repository. The script refuses to read from anywhere inside it, takes the folder as an argument, and prints counts only: stories checked, stories skipped for having no headline, loosened (must be 0), pick-loosened (must be 0), newly held back and newly given a reason by label, and picks lost. It never prints a headline, description, link, story code or reason code, and it has no network, file-writing or logging path. `tests/app/stricter-only-check.test.mjs` proves each of these with synthetic data.

How it is run: a manually triggered workflow in the private teaching repository (not in this one, so no secret or private text sits here) checks out the public repository twice, at the old and the new reference, downloads the saved labelled sets from the private releases, and runs the script. It reads only; it needs no write permission. Because it executes the rules from the reference under test, it is dispatched only for references the Security Lead has already reviewed. The archive files for October 21 and 22 are the first sets; the October 16 set is not saved in the archive. October 16, 21 and 22 remain development data and never count toward approving a story type.

## Label-only mode (General Counsel, October 23, 2026; draft pending licensed attorney review)

A source in label-only mode is collected and screened exactly like any other, and every screened story goes to the private teaching batch with its decision and reason codes. Nothing from it is ever public, whatever the decision. A new source starts in this mode for at least 14 days, so Alex can learn how the rules treat it before it can reach the globe.

How it works:

- The switch is `labelOnly` in the source's `publisherFeed` record in `config/feeds.json`, with `labelOnlySince` (YYYY-MM-DD, a record only). Only an absent value or exactly `false` means public. Any other value, including a typo such as the string "true", keeps the source private (`isLabelOnly` in `src/lib/publisher-feed.ts`), so a mistake can hold a source back but can never make a label-only source public.
- The snapshot builder sends the story to the teaching batch and then stops: a label-only story never enters the stored snapshot, previously stored items from the source are not carried, and a person's pick for it is never looked at. The public projection also drops every row from a label-only source, so an older stored snapshot cannot leak one.
- The public run report does not name a source in label-only mode and gives no per-source numbers for it. It shows one neutral number, `sourcesInTesting`, and the source is named only after it leaves the mode (General Counsel ruling, October 24, 2026; draft pending licensed attorney review). The label-only stories are never added to `listed` or `notListed`, and their reasons are not added to the held-back counts.
- There is no automatic exit and no date that ends the mode. Leaving it is a committed change to the source's record that needs the General Counsel's look and Alex's exact "Merge it".
- No source is label-only yet. `tests/app/label-only.test.mjs` covers the behaviour and checks that every label-only source in `config/feeds.json` records its start date.

## Picked by PositiviTV (person-approved list, policy 0.5.0)

General Counsel ruling, October 21, 2026: a person may choose individual publisher-feed stories that the automatic rules held back only for a mild reason. Such a story is labelled "Picked by PositiviTV · From publisher feeds". It is never labelled "Reviewed", because nobody fact-checks it and its event date is not confirmed.

How it works:

- The list is `pickedStories` in `config/publisher-feed.json`. Each entry has the story's anonymous code (`<source>-<24 hex characters>`), `approvedAt` (`YYYY-MM-DD`) and `approvedBy`. Malformed entries are ignored. The list ships empty. An entry is added only after Alex re-confirms the story by its headline together with the publisher's description, in a separate reviewed change.
- A pick can override only two reasons: `NO_COMPLETED_OUTCOME` and `PLAN_OR_UNCERTAIN` (`PICK_OVERRIDABLE_REASONS`). A story with any other reason (every hard ban) can never be listed this way, even when it is on the list. The test `tests/app/picked-stories.test.mjs` proves this with real headlines and checks that every other reason code in `server/publisher-screen.ts` is outside the overridable set.
- A pick never overrides the checks that happen before screening: a blocked credit, restrictive rights wording, a missing required author, the 30-day window, or an unusable link. A picked story must still pass the same well-formedness and placement checks as any other publisher card.
- Removing the entry takes the story off at the next page load, because the public projection drops any picked row whose entry is gone. The remote switch (`server/remote-control.ts`) can still withdraw any story or pause the whole lane, and it cannot add a pick (a test checks that `pickedStories` is not a remote key).
- The teaching batch still records the rules' own decision for the story (exclude), so the rules' record is not rewritten by a person's choice.
- The label explanation on the card reads: "A person at PositiviTV chose this story from a publisher feed. It isn't fact-checked, and its event date isn't confirmed." The About dialog and the Terms panel carry the General Counsel's wording.

Deploy note: the policy version moved to 0.5.0, so the private snapshot path moved with it. Publisher cards disappear after the deploy until the next scheduled run (about 10:54 UTC) rebuilds the snapshot, unless the refresh is run by hand from the Vercel Cron Jobs page.

### Picks log

- 2026-10-23: PR #51 added 31 picks (57 entries) from the October 22 sorting, approved by Alex, reviewed by GC.
- 2026-10-24: PR #55 added 7 picks (14 entries) from the October 23 sorting, approved by Alex, reviewed by GC.
- 2026-10-24: Pick for the South Sudan giraffe story removed by policy 0.6.0 (CONFLICT hard ban). Not an exception. Kept only if Alex publishes it through the reviewed edition.

## Policy 0.6.0 (stricter only)

Written from the Algorithm Creator's handoff of October 23, 2026 and rebuilt in `server/publisher-screen.ts`. Every change only adds ways to hold a story back. No exclusion was removed or narrowed, and nothing became pickable that was not pickable before. A check over the 176 distinct stories from the October 21 and 22 batches found no story that moved from held back to listed and none that moved from listed to held back.

What changed:

1. More word forms in the harm list (killings, bombings, bombers, massacred, shooters, stabbings, murderers, rampage, execution, torture, abduction, starvation, slain, beheaded, lynched, casualties, wounded, mass graves, corpses).
2. Every exclusion list also runs on a copy of the text with hyphens read as spaces, so "war-torn" is read as "war torn". The positive lists (recovery and completed-outcome words) never use that copy, which keeps the change stricter only.
3. A headline-only list of armed groups and weapons, reported as `CONFLICT_OR_CRISIS`, plus "conflict-hit" and its variants, "was executed" and "executed by". The bare words "conflict", "executed", "arms", "bets", "bodies" and "escort" are left out on purpose.
4. A new code `SENSITIVE_TOPIC` (headline and description lead): hate groups and extremism; child, domestic, sexual, elder and substance abuse and abusers; domestic and sexual violence and exploitation; slavery and sex trafficking; cults; landmines and unexploded ordnance; femicide and honour killings; FGM; child soldiers, child labour and brides; forced labour or marriage; surveillance, facial recognition, spyware, predictive policing, censorship, internet shutdowns, data breaches and hacking. A recovery word can no longer unlock these.
5. A new code `VICE_OR_ADULT` (headline only): casinos, gambling, betting, sportsbooks, tobacco, cigarettes, vaping, nicotine, liquor, strip clubs, adult film and content, pornography, brothels, cannabis and marijuana.
6. More old-event phrases with no year written ("a decade ago", "twenty years on", "last century", "centuries ago", "long ago") and more plan words (readies, "prepares to", poised, "on track", slated, scheduled, forthcoming, "in the works"). "a century" on its own does not count.
7. More natural-hazard words (eruptions, volcanoes, landslides, mudslides, avalanches, sinkholes, blackouts, outages, power cuts). Like floods, a recovery word in the same headline still allows the story.
8. A new code `SUSPICIOUS_CHARACTERS`, checked on the raw text first: a story is held back when the headline or description lead contains a format character (soft hyphen, zero-width characters, direction controls, byte-order mark), a variation selector, or when one headline word mixes Latin letters with Greek or Cyrillic letters. The text is not repaired. Emoji that use a variation selector or joiner are held back by this rule too.
9. Mined minerals added to the extractive list (nickel, lithium, cobalt, copper, bauxite, uranium, iron ore, rare earths, smelters) and "deadly", "lethal", "venomous" and "poisonous" added to the negative words that need a recovery word in the same headline. "Gold" and "plants" are left alone on purpose, because of gold medals and planted trees.

The three new codes are hard bans. They are not in `PICK_OVERRIDABLE_REASONS`, and `tests/app/picked-stories.test.mjs` proves a pick can never lift them. One of the 31 stories on the pick list now carries `CONFLICT_OR_CRISIS`, so its two entries were removed from `config/publisher-feed.json` in the same change (the list holds 30 distinct stories). Labels made under 0.5.0 or earlier stay development data. The private archive and teaching batch record the new policy string from the first run after this merges.

Known limits: the word lists are public, so someone who controls a feed can still write a bad headline using words on no list. The character rule blocks the cheapest evasion tricks, and human picks and the remote switch remain the backstop. No accuracy figure is claimed.

Deploy note: the policy version moved to 0.6.0, so the private snapshot path moved with it and publisher cards disappear after the deploy until the next scheduled run (about 10:54 UTC) rebuilds the snapshot, unless the refresh is run by hand from the Vercel Cron Jobs page.

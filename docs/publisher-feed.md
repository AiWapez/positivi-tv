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

Rules that apply to every source: only the configured feed URL and its robots.txt are fetched; article links are validated against the source's domains and are never fetched or added to the allowlist; headlines are not edited (a headline longer than 300 characters is excluded rather than shortened); descriptions from no-derivatives sources are used only for private screening and are never stored or shown; feed images and third-party media are never imported; no endorsement is implied. Exceptions noted in the records: NASA insignia and third-party material, NSF visual media, CC-excluded photos at Mongabay and Global Voices.

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

The current policy is `publisher-feed-0.4.1` (0.4.1 adds rejection of unresolved trafficked-animal journeys; see coverage and photos), with a 30-day publication window and policy-scoped private snapshot paths. It supplements Mongabay RSS with bounded keyless metadata and real byline records. Public cards may use only the checked local illustration catalog. See [coverage and photos](coverage-and-photos.md) for the exact boundaries and attribution rules. Earlier no-image and fixed snapshot-path descriptions above describe the original candidate.

Stricter-only rule fix, October 19, 2026: several exclusion words matched only their singular form (for example "governor" but not "governors", and likewise mayors, councils, treaties, massacres, famines, pandemics, investigations and prime ministers). Their plural forms are now excluded too. This change can only exclude more stories, never list more, so the policy version stays `publisher-feed-0.4.1` and the stories already on the site are not dropped. Before the change, the 12 cards the site was showing were re-checked against the new rules by headline and all still pass; a carried card is not re-checked against its description until it appears in a feed again. A comparison over the 144 headlines of the October 16 sample found no decision that changed in either direction. Approved by General Counsel (draft ruling of October 19, 2026).

## Screening sample (temporary)

Why: the headline rules in `server/publisher-screen.ts` have only been tuned on small samples. `docs/goodsignal-spec.md` section 13 asks for roughly 300 real candidates, rejects included, labelled by a person, before anyone claims the screening works. The daily job used to count rejected stories and discard them, so no such set existed.

How it works:

- `config/publisher-feed.json` has `screeningLogUntil`, a UTC date. While a scheduled run happens before midnight (UTC) at the start of that date, the run writes what the headline rules decided into the private run log (`console.log`, lines starting `screening-sample`). Vercel Hobby keeps runtime logs for one hour, so nothing is stored long term. A missing or malformed value means off. The switch expires by itself; extending it needs a new config change and a merge. Set to `2026-10-20` it covers the runs of October 16 through 19. Only the October 16 run was read in time: the October 17 and 18 logs were gone before they were read, because reading the run log needs a person to approve it in the app inside the one-hour window. The extension to October 19 is a deliberate one more morning, to get a fresh set of stories that the rules were not tuned on. It changes nothing else.
- Nothing is written to Blob, no endpoint reads it, and no secret is involved. Records are packed in order onto as few lines as fit under 1,700 bytes each (`SCREENING_LOG_MAX_LINE`), because the tool that reads the run log cuts every message off at about 2,000 characters and a cut line loses its last records for good. A record is never split across lines, and each line says which part of how many it is (`part`, `of`) and how many records the run had in all (`total`). A record has `id` (source id plus a hash of the canonical link), `source`, `url`, `title`, `published`, `summary`, `decision` (`list` or `exclude`), `reasons`, `labels` and `category`. The same story that sits in two feeds of one publisher gets one record per feed, with different source ids and the same link hash.
- Only candidates that reached the headline rules are recorded: they passed the link, date, window, author and rights checks first. A story that is dropped earlier (for example, a missing author at Mongabay or Global Voices) never reaches the rules and is not in the sample, so the sample measures the rules, not those earlier checks.
- `summary` is the shortened plain-text description the lane already stores, and only for sources whose terms allow storing one (NASA, NSF, NOAA). It is `null` for Mongabay and Global Voices, so no description from those sources is logged. The rules still read the real description in memory when deciding, as they always did.
- The observer is a callback (`onScreened`) on the pure snapshot builder. A test checks that the snapshot is identical with and without it, that a throwing observer changes nothing, and that a failing log cannot fail a run.

How the sample is used (General Counsel rulings of October 15, 2026, draft pending licensed attorney review): the Builder reads the lines from the run log within the hour and puts the stories on a private page that only Alex can open, one story at a time, with Keep, Reject and Unsure buttons and the rules' decision hidden until he answers. The source name and link are shown with each story. The report compares his labels with the rules' decisions, with uncertainty ranges, against a plain keyword filter and a newest-first list. The overlap labelled as a second opinion is labelled by an AI, not a second person, and the report must say so. The stories are deleted from the private page when scoring is finished, and no later than 30 days after collection; the actual deletion date is recorded below. The public repository keeps only hashed IDs, Alex's labels and the rules' decisions, never headline text. Any second one-time pull through a fetch service needs a new General Counsel ruling; this log is the route that uses our own fetcher.

What the first run, October 16, 2026 (it ran at 10:54 UTC), taught us. The rules looked at 174 candidates. At that time a line held up to 5 records, which is more than 2,000 characters, so the log reader cut off the last one or two records of every line: 134 complete records came through and about 40 were lost. The loss follows a position, not a topic (it is the fifth and sometimes the fourth record of each group of five), but it was not perfectly neutral. At least three of the lost records are stories the rules listed, which can be seen in the cut-off tails of the lines. Of the 134 recovered records, 11 were the same story seen in more than one feed, and each story was counted once (123 distinct stories). Only 2 of those 123 had been listed by the rules. So that the "listed" side of the check is not close to empty, the 10 other stories that the live site was showing at that point were added to the private page from the site's own saved snapshot, with the rules' decision recorded as "list". Some of those 10 were listed by the October 14 run and carried forward without being re-checked, because stories that have dropped out of a publisher's feed stay for their 30 days. Carrying only happens while the screening policy version is unchanged (`publisher-feed-0.4.1`), so those decisions come from the same policy version, but they were not re-run on October 16. The result is that the listed side is every story the site was showing, while the excluded side is a sample from which about a quarter of that run's candidates are missing. The whole-line packing above was written to stop this from happening again on the runs of October 17 and 18.

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

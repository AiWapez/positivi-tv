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

Each automatic card shows the source name, "Published <date>", "From publisher feeds", "Event date not confirmed; this is recently published reporting.", and, where applicable, "Research finding, not yet an outcome in use" or "Pin: approximate country centre from the headline". The headline is unmodified. Images are never imported; the existing category artwork is used. The About dialog and the Terms panel explain both lanes.

## 3. Dates (decision: show as recently published reporting)

Three dates are kept separate:

- `publishedAt`: the feed's publication timestamp (`pubDate` or Atom `published`), parsed and normalised. Items with a missing, invalid or future timestamp, or with only an Atom `updated` timestamp, are dropped individually; the batch continues.
- `fetchedAt`: when PositiviTV first retrieved the item. Later runs keep the original value; it starts the retention clock.
- `eventDate`: always `null` in this lane. Rules cannot establish when an event happened.

Nothing is ever filled with "now". The selected policy is to display these items explicitly as recently published reporting (label `event_date_unconfirmed`, required by validation) rather than omit them. To reduce old events reported as new, headlines containing a year before the current year, retrospective wording (anniversary, years ago, looking back) or a description phrase such as "inaugurated in 2019" are excluded. This is a heuristic: an old event described without a year can still pass, which is why the label is mandatory. Items leave the lane 7 days after publication (`windowDays`) or when the source's retention period ends, whichever is first.

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
| Global Voices | https://globalvoices.org/-/topics/good-news/feed/ | globalvoices.org | https://globalvoices.org/about/global-voices-attribution-policy/ (CC BY 3.0) | title, link, date, author, linked license | Enabled, headline only, low volume |
| The Conversation | https://theconversation.com/articles.atom | theconversation.com | https://theconversation.com/republishing-guidelines | none | Disabled |
| ScienceDaily | not configured | | https://www.sciencedaily.com/terms.htm | none | Disabled: terms forbid altering or omitting feed content and storing it in a database without consent |
| Positive News, Good News Network | not configured | | not verified for this use | none | Disabled: restrictive general reuse terms reported |
| Reasons to be Cheerful, Optimist Daily, Good Good Good, Upworthy, The Better India | not configured | | not verified | none | Disabled until verified |

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

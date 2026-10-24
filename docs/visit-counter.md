# Public visit counter (built, OFF until three people say yes)

Status: built and switched off. `config/visit-counter.json` ships with `enabled: false` and `dailyCeiling: 0`, so no visitor request writes anything and the page shows nothing. Design reviewed by the Security Lead on October 24, 2026 (approved with ten changes, all built in). The finished code still needs the Security Lead's review, the General Counsel's approval of the page wording, and Alex's exact "Merge it". The counter is turned on only by a later one-line change to the config file (also needing "Merge it").

## What it stores
A UTC date and two whole numbers in a small outside key-value store (Upstash, connected through the Vercel Marketplace): that day's count (`positivitv:visits:day:YYYY-MM-DD`) and a running total (`positivitv:visits:total`). Nothing else. It counts browser-days, not people: a browser sends at most one tick per UTC day, remembered by the date in its own local storage (`positivitv.visit.v1`). It is approximate and the page says so.

The code never reads, stores or logs an IP address, Referer, User-Agent or any other request detail. `/api/visit` reads only the `Origin` and `Content-Type` headers. A test fails if the counter files mention those other details. Its log lines print a fixed message or a status code only.

The counter lives outside Vercel Blob and Global Config on purpose: a flood of visits can use up only the counter's own allowance and never the story storage.

## Endpoints (the write surface, next to the old ones)
| File | Method | Who can call it | Can it write? |
| --- | --- | --- | --- |
| `api/collect.ts` | GET | Vercel cron only (`Authorization: Bearer CRON_SECRET`, constant-time compare, denied if the secret is missing) | Yes: private review queue in Blob |
| `api/refresh-feeds.ts` | GET | Vercel cron only (same check) | Yes: publisher snapshot in Blob, private teaching batch in GitHub |
| `api/run-report.ts` | GET | Public | No (counts from the stored snapshot) |
| `api/stories.ts` | GET | Public | No |
| `api/visits.ts` (new) | GET | Public | No. Read-only store token only. Exactly two numbers out |
| `api/visit.ts` (new) | POST | Public | **Yes: the first visitor-triggered write.** Counter store only, write token only |

`/api/visit` answers every outcome with the same empty `204` (accepted, rejected, paused, over the ceiling, store down), so it cannot be used to probe its rules. It accepts only: POST; no query string; `Content-Type` exactly `application/json`; an `Origin` that is exactly one of `allowedOrigins` (production only; preview deployments are not counted); and a body of exactly `{"v":1}` (64 bytes at most).

## Limits and fail-closed rules
- Off unless `enabled` is true AND `dailyCeiling` is a positive number. An unreadable or malformed config means off.
- Pause switch: Global Config key `visitCounterOff` (true pauses both endpoints at once, no redeploy). It can only pause. If it cannot be read, or holds anything other than true/false, the counter is paused; an unreachable store keeps the last good answer, like the publisher-lane reader. It shares the existing `GLOBAL_CONFIG` store and its 3-minute per-copy cache, so it adds about one read per 3 minutes per running copy.
- Write on each accepted tick, before answering, as one pipeline: `INCR` the day key, then `INCR` the total. Nothing waits in memory (Vercel can freeze a copy right after it answers).
- Hard daily ceiling: the day key's new value is returned by the write. Once it passes `dailyCeiling`, that copy stops writing for the rest of the UTC day. Every running copy learns this from its own write, so the total can pass the ceiling by at most one tick per running copy that day. The page never shows a "today" number above the ceiling.
- Per-copy cap: `perCopyPerMinute` accepted writes per minute (default 60), as a first brake only.
- Browser side: if local storage throws, is blocked, or does not keep the value, no tick is sent. The page asks `/api/visits` first; when it answers null (off, paused, unavailable) nothing is sent or shown.
- `/api/visits`: GET only, no query string (a query string would miss the edge cache and reach the store, so it gets an empty 400), `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, never any error text. If the store fails it serves the last numbers this copy saw, or nulls.

Honest limits: a script can fake the `Origin` header, so the public number can be inflated on purpose; the ceiling bounds how far. The platform may read a request body (up to its own size limit) before the code sees it, so the 64-byte limit is enforced on what the code accepts, not on what the platform receives. The count includes bots that run scripts.

## Environment (names only, never values)
`KV_REST_API_URL`, `KV_REST_API_TOKEN` (write; used only by `/api/visit`), `KV_REST_API_READ_ONLY_TOKEN` (read; used only by `/api/visits`). The store address must be an `https://*.upstash.io` host. After connecting Upstash in the Vercel Marketplace: limit the integration to the `positivi-tv` project only; keep these three variables as Sensitive and Production only; remove the other variables the integration adds (for example a `REDIS_URL` that contains a password, and `KV_URL`) from every environment, and make sure no code reads them (nothing in this repository does). Preview shares production settings in this project, so Preview must not get the write token.

## Setting the ceiling (needed before it can be turned on)
Read the free plan's monthly command allowance on the Upstash connection page. Each accepted tick uses 2 commands. Set `dailyCeiling` to no more than half of (monthly free commands ÷ 31 ÷ 2), and record the number and the date here:

- Ceiling: not set yet (0 = off).

Reads by `/api/visits` also use commands (2 per cached answer, about one answer per minute per edge region), so check that total too.

## Turning it on (later, three yeses first)
1. Security Lead has reviewed the finished code.
2. General Counsel has approved the privacy wording. The draft paragraph in `src/components/ReaderInfo.tsx` begins "[Draft wording, pending General Counsel]" and shows only while the counter is on; replace it before switching on. Tell the General Counsel that Vercel's own runtime logs briefly hold request details, IP address included, for about an hour on the free plan. The page may truthfully say the counter stores only a date and a number, but it must not say PositiviTV never sees an IP address.
3. Alex says "Merge it" on a one-line change setting `enabled` to true and `dailyCeiling` to the recorded number. The Reddit post wording ("no analytics tools") changes with it.

## Tests
`tests/app/visit-counter.test.mjs`: the shipped config is off; strict config parsing; every rejection path is the same empty 204 with no store call; the pipeline is written before the answer; the ceiling, the per-copy cap and the pause switch (including failing closed); the store address rules; a missing write token on `/api/visits`; only Origin and Content-Type are read; the code never mentions IP, Referer or User-Agent details; the browser sends one tick per day and nothing when storage fails.

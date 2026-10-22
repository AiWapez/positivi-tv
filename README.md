# PositiviTV

**A world of good.** A free constructive-news globe built with React, TypeScript, Vite and Three.js. Explore a realistic Earth, search by place or topic, filter stories, and save favorites on your device.

## Run

Use Node.js 24.x.

```sh
npm ci
npm run dev
npm run build
npm run test:app
npm run test:goodsignal
```

`npm run dev` serves the same reviewed-edition contract as the Vercel function. `vite preview` serves static build output only; use Vercel to test the deployed API. Images, font and globe texture are bundled locally. No paid map account, runtime CDN, account creation or browser API key is required.

## Two explicit content modes

- `/` shows the reviewed edition and, when the switch is on, automatic cards from permitted publisher feeds. Each card is labelled "Reviewed by PositiviTV", "From publisher feeds", or "Picked by PositiviTV · From publisher feeds" (a publisher-feed story that a person chose individually; the list of picks starts empty). The checked-in edition is intentionally empty until real reporting is reviewed, and the publisher-feed lane is enabled in this release.
- `/?demo=1` shows labelled fictional design samples with fixed example dates. You can also choose **Try sample edition** in About. Samples never enter the reviewed API.

The approved design includes desktop sidebar browsing, a purpose-built mobile layout, Globe/List views, category/search/date filters, mobile date controls, local saves, discovery, zoom/reset/expansion, and accessible story controls. It includes no ticker, video corner, or television graphics.

## GoodSignal

GoodSignal checks constructive outcome type, evidence spans, separate event/publication/origin dates, source permission, retention, and human review. It composes a shared edition while avoiding duplicate events. Every story in the reviewed edition requires human approval; no AI model can authorize publication. A separate, explicitly labelled publisher-feed lane lists headlines automatically under its own policy; it never claims review. See [the publisher-feed contract](docs/publisher-feed.md). The engine's math is inspectable, and the tests are regression cases, not measured fact-checking accuracy.

The first integration uses a maintainer-operated private editorial workspace and a versioned public edition in Git. There is no public editor endpoint. See [the editor guide](docs/editor-workflow.md), [integration boundaries](docs/goodsignal-integration.md), and [the algorithm specification](docs/goodsignal-spec.md).

The API rechecks delivery eligibility and sends an uncached status manifest. Browsers revalidate every 25 seconds while visible and stop displaying live cards when status exceeds 30 seconds or connectivity fails. Updates, including withdrawals, take effect after a new edition is deployed. This is **not** a cross-deployment instant-revocation service.

## Content and launch status

Fabricated fallback stories and the old country lookup with 0/0 defaults remain removed. A daily NASA RSS collector writes pending candidates to a private queue; it never publishes them automatically. Separately, a scheduled job (`/api/refresh-feeds`) can store a bounded snapshot of permitted publisher-feed headlines that pass conservative, documented word rules; `/api/stories` serves that snapshot and never crawls. Those rules are not the GoodSignal evidence system and can make mistakes; see [the publisher-feed contract](docs/publisher-feed.md). See [daily collection](docs/daily-collection.md). The cron schedule becomes active only after this code is deployed to production. A real launch needs a verified eligible publisher snapshot (or an approved reviewed edition), occasional source/correction oversight and browser/device QA. `npm run release:check -- --publisher-snapshot /private/path/snapshot.json` supports publisher-only content without inventing human approvals. This release enables the labelled publisher-feed lane. Required author/CC attribution is displayed; automatic pins require a supported physical-outcome location and disclose approximate areas. Publisher photographs are not automatically republished. Live cards use locally bundled, credited place or subject photos, explicitly distinguished from event photographs. See [coverage and photos](docs/coverage-and-photos.md).

There are no accounts, behavioral tracking, community submissions or per-visitor AI calls. The only automated publication is the labelled publisher-feed lane, which is enabled by the committed policy and can be switched off. Reading is open without an age or sign-up gate. Favorites stay on the device and can be cleared from Privacy. Email/password accounts, with optional GitHub sign-in, are deferred. See [launch scope and free-only operation](docs/launch-scope.md).

## Assets and verification

See [asset credits](public/ASSETS.md), [verification](docs/verification.md), and [the editor guide](docs/editor-workflow.md). Inter is local under the SIL OFL; Three.js is pinned to 0.180.0 under MIT. Dependencies are locked with `package-lock.json`.

## Run on your own hardware

Use Node 24, then run:

```sh
npm ci
npm run feeds:local
npm run dev
```

`feeds:local` uses the same permitted feeds, safe fetcher, automatic selection and location rules, and saves a git-ignored local snapshot. It needs no API key, AI model or Vercel Blob account. The Vite development server reads that file without crawling on visitor requests. Run the command again when you want fresh stories, or schedule it with your operating system. A failed collection preserves the prior snapshot. If an interrupted process leaves a local lock, first confirm no refresh is running before removing the lock named in its error message.

This is a localhost development/self-hosting path, not a hardened public production server. Keep it bound to localhost. `npm run build` produces frontend assets; a public host also needs the API/snapshot adapter. Vercel's production adapter uses the project's own private Blob store and secret. Never reuse someone else's credentials or publish a private editorial workspace.

## License and attribution

Original project code is available under the [MIT License](LICENSE), so you can fork, modify and self-host it. Publisher reporting is not covered by that license. Earth imagery, photographs, Inter, Three.js and other dependencies retain their own terms; see [asset credits](public/ASSETS.md). Source author and license credits must remain with publisher-feed cards.

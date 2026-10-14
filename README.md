# PositiviTV

**A world of good.** A free constructive-news globe built with React, TypeScript, Vite and Three.js. Explore a realistic Earth, search by place or topic, filter stories, and save favorites on your device.

## Run

Use Node.js 24 or later.

```sh
npm ci
npm run dev
npm run build
npm run test:app
npm run test:goodsignal
```

`npm run dev` serves the same reviewed-edition contract as the Vercel function. `vite preview` serves static build output only; use Vercel to test the deployed API. Images, font and globe texture are bundled locally. No paid map account, runtime CDN, account creation or browser API key is required.

## Two explicit content modes

- `/` shows only the reviewed edition. The checked-in edition is intentionally empty until real reporting is reviewed with documented source permissions.
- `/?demo=1` shows labelled fictional design samples with fixed example dates. You can also choose **Try sample edition** in About. Samples never enter the reviewed API.

The approved design includes desktop sidebar browsing, a purpose-built mobile layout, Globe/List views, category/search/date filters, mobile date controls, local saves, discovery, zoom/reset/expansion, and accessible story controls. It includes no ticker, video corner, or television graphics.

## GoodSignal

GoodSignal checks constructive outcome type, evidence spans, separate event/publication/origin dates, source permission, retention, and human review. It composes a shared edition while avoiding duplicate events. Every launch story requires human approval; no AI model can authorize publication. The engine's math is inspectable, and the tests are regression cases, not measured fact-checking accuracy.

The first integration uses a maintainer-operated private editorial workspace and a versioned public edition in Git. There is no public editor endpoint. See [the editor guide](docs/editor-workflow.md), [integration boundaries](docs/goodsignal-integration.md), and [the algorithm specification](docs/goodsignal-spec.md).

The API rechecks delivery eligibility and sends an uncached status manifest. Browsers revalidate every 25 seconds while visible and stop displaying live cards when status exceeds 30 seconds or connectivity fails. Updates, including withdrawals, take effect after a new edition is deployed. This is **not** a cross-deployment instant-revocation service.

## Content and launch status

The old keyword classifier, fabricated fallback stories and inferred country coordinates have been removed from the active application. There is no automatic ingestion job or daily news service connected yet. A real launch needs configured permitted sources, approved initial stories, ongoing editorial ownership, and browser/device QA. Source photographs are not automatically republished; live cards currently use category artwork until image rights support is implemented.

There are no accounts, behavioral tracking, community submissions, per-visitor AI calls, or automated publication. Those features are outside this version.

## Assets and verification

See [asset credits](public/ASSETS.md), [verification](docs/verification.md), and [the editor guide](docs/editor-workflow.md). Inter is local under the SIL OFL; Three.js is pinned to 0.180.0 under MIT. Dependencies are locked with `package-lock.json`.

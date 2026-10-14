# GoodSignal integration status

The globe redesign integrates the standalone engine into a maintainer-operated publication workflow. It preserves the existing React/Vite framework and Vercel `/api/stories` route.

1. Maintainer imports a candidate into ignored `.editor/` storage.
2. GoodSignal prepares findings and a human records the current-version decision.
3. `server/publish.ts` applies the engine's eligibility, edition composition and public projection.
4. `content/edition.json` records a public edition and statuses together.
5. `api/stories.ts` rechecks expiry, policy, dates and current status/version on every request, returning an uncached feed and manifest.
6. The frontend filters the same dataset for list and globe, checks fresh status before selection, refreshes while visible, and clears stale live data.

See [the editor guide](editor-workflow.md) for trust, permissions, retention and release details. The checked-in production collection is empty, and synthetic samples are an explicit frontend mode only.

## Implemented boundaries

No article body, evidence quotation, review note, API credential, or private workspace enters the browser feed. There is no public approval endpoint. GitHub repository writes and deployment permissions authorize publication; the CLI does not authenticate a remote editor. Live cards use category artwork rather than assuming rights to publisher images. Unknown/multiple/global locations stay in lists without invented points.

The API is a bounded collection endpoint, not a paginated search service. Filtering is local over the same edition; `nextCursor` is null. Refresh checks the deployed collection and does not consume a third-party news quota or create a new edition.

## Remaining adapters

An official NASA RSS adapter, a private Vercel Blob candidate queue and a protected once-daily collection job are now implemented. Human review still runs locally. Structured extraction, a hosted authenticated review interface, real labelled evaluation and unattended publication of the reviewed edition are not connected. A separate publisher-feed lane, labelled and switchable, lists headlines automatically without entering the reviewed edition; see [publisher-feed.md](publisher-feed.md). See [daily collection](daily-collection.md). The Promise Ledger and broadcast helpers remain engine capabilities; the selected UI deliberately has no broadcast/ticker features.

Status is authoritative for one deployed snapshot. A withdrawal requires redeployment and does not invalidate immutable older deployment URLs. A shared external status store is needed before claiming cross-deployment removal. Source revocation likewise requires rebuilding the edition. A versioned public Git collection is inappropriate for licenses that prohibit the resulting retention history.

## Verification

Engine regression fixtures are synthetic; passing them is not a news-quality benchmark. Feed delivery and editorial flow have integration tests. Browser/WebGL/touch verification remains a separate acceptance step; see [verification](verification.md).

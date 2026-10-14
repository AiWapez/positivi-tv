# Daily private candidate collection

The NASA RSS adapter and Vercel collector add real intake without model calls or publisher API keys. They do not authorize news publication.

## Connected infrastructure

- Dedicated private Vercel Blob store: `positivitv-editorial-queue`, linked only to this project.
- Server-only storage authentication injected by Vercel. No storage token enters the frontend.
- `/api/collect` requires the server's `CRON_SECRET` Bearer header. Public requests receive 401, not queue data.
- `vercel.json` schedules one run per day at 11:00 UTC. Vercel activates cron jobs for production deployments; previews do not create an active recurring job. On Hobby the run can occur within that hour.

## What is collected

`config/feeds.json` records the official NASA feed, exact permitted domains, the RSS reference and NASA's usage policy. That policy is a baseline for review, not blanket permission for third-party material appearing on NASA pages. Every story still requires the editor's rights check. Images are not imported.

The collector checks robots rules, uses the existing DNS-pinned HTTPS fetcher, rejects DTD/entity declarations, limits response and queue size, canonicalizes URLs, and drops off-domain links or invalid/future/old publication timestamps. It retains at most 10 candidates per daily batch. Publication dates come from the feed; they never become inferred event dates. Event date, outcome quote, constructive stage, evidence and coordinates remain unset until review. No candidate is automatically classified as good news or approved.

Queue files use fixed daily paths and cannot overwrite an existing batch. Retrying a completed day reuses its batch. Old remote batches are pruned after 30 days when the collector runs. If the scheduled service stops, pruning also stops; the maintainer must perform deletion before any stricter retention obligation expires. Failures never generate fallback stories.

## Review collected candidates

From a linked checkout with your own authorized Vercel development environment:

```sh
vercel env run -- npm run editor -- sync
npm run editor -- inspect story-id
```

Alternatively load your local ignored `.env.local` explicitly with Node 24 before invoking the editor. Keep production secrets out of local files; use the Development connection/OIDC credentials. The source policy is copied to `.editor/sources.json` only when absent, preserving your local policy edits. Existing candidates and decisions are not overwritten during sync.

Fill in the actual article's outcome/date/evidence and honest location, then re-import the edited candidate. A new version requires a new human decision. Review and publish through [the editor workflow](editor-workflow.md); public output remains the committed reviewed edition. The web Refresh button reads the current deployed edition and the last stored publisher-feed snapshot, not the pending queue. Only feeds with the `review_queue` lane (currently NASA) enter this queue; the separate publisher-feed lane is described in [publisher-feed.md](publisher-feed.md).

## Cost and coverage boundary

The implementation makes no paid AI calls and needs no news API subscription. Blob and Functions remain subject to the account's free-plan quotas; no plan upgrade is requested. Batch storage is bounded, not priced per website visitor. NASA is the first intake adapter, so this source alone does not provide a geographically or topically balanced news service. Add other permitted feeds through reviewed source configuration, never by broad arbitrary URL input.

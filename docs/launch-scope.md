# Reader-first release

Decision: 14 October 2026. This release is a free, accountless constructive-news reader. It does not launch a social network.

## What ships

- The approved navy/yellow Earth interface, list view, shared filters, discovery and device-local favorites.
- Reader information, privacy notice, source/correction guidance and a control to clear local favorites. No required age or terms popup for reading; no age, email, identity or exact location is requested.
- A daily, bounded, server-only permitted RSS intake and private pending queue. Human review is mandatory for the reviewed edition.
- An automatic publisher-feed lane (enabled by the committed release policy) that lists headlines from sources with checked terms, labelled "From publisher feeds", plus a person-approved list labelled "Picked by PositiviTV · From publisher feeds" that starts empty. See [publisher-feed.md](publisher-feed.md).
- No paid news API, model provider, per-visitor AI call, analytics SDK, tracking pixel or external runtime asset CDN. No GNews dependency or key is used by the running code.
- Explicitly labelled fictional samples, available only in sample mode. They never become fallback reporting.

## What waits

Email/password is the preferred future login. GitHub may be an additional option, never a requirement for reading or saving locally. GitHub repository distribution is independent of website accounts. Email verification, password reset/delivery, abuse limits and a separate privacy review must exist before accounts are enabled.

Public profiles, submissions, uploads, comments, direct messages, follower graphs, PostHog and other behavioral analytics remain disabled. No dormant submission endpoint accepts content. A future community feature needs contributor authentication, moderation capacity, privacy protections, rate limits, reporting, withdrawal, appeals and deletion. Do not add an unchecked form as a shortcut.

## Free-only operation

The current content input is permitted public RSS, not a news API subscription. Acquisition and publication are separate: free access does not establish redistribution rights. Record source policy, retention, actual dates and article-specific evidence before publishing. Images are not copied from feeds.

Collection is capped at ten candidates per daily batch, with bounded fetching and 30-day queue retention. The reviewed feed is generated from committed data and does no AI or third-party news call per page load. Hosting, private storage and GitHub still have provider quotas; free-only does not mean unlimited capacity. Do not upgrade a plan, attach a paid API, enable overage billing or provision a paid integration to work around a limit. Stop collection or reduce frequency if the existing free allowance is exhausted; preserve the last still-eligible reviewed edition or show the honest empty/error state.

PostHog is deliberately absent from this release. A later analytics proposal must specify actual data collected, consent/age handling, retention and provider-side spending controls before activation.

## Latest supplied specifications

Inputs reviewed: `GoodSignal-Algorithm-Design-v3_1.pdf` and `GoodSignal-Community-Gate-v1_1.pdf` (14 October 2026). The executable types and `goodsignal-spec.md` document the existing implementation; a design proposal is not proof that an adapter or moderation service exists.

Adopted now: v3.1's two-sided 95% Wilson lower endpoint for advisory automation proposals, a minimum of 100 independent event groups and lower bound >= 0.95 by default. Edited approvals count as failures; cohorts remain separated by source, topic, model and policy; sensitive or flagged classes remain excluded. A proposal never enables publication. GoodSignal's engine has no automatic publishing path; the separate publisher-feed lane is a documented, labelled exception with its own switch, not an engine approval.

Retained amendments: keyword ambiguity remains a review signal, temporary network failures remain operational errors, primary-domain membership/path depth is not evidence by itself, and quote presence is not proof of entailment or truth. v3.1 contains older shortcuts in these areas; they do not override the stricter implementation. World coverage depends on qualified supply; never invent regional stories to fill quotas.

Community Gate v1.1 is a future design reference. Its 18+ contributor rule does not impose an age restriction on this accountless reader. Its model calls and optional safety providers are not configured or funded; future implementation must satisfy the free-only constraint or remain human-operated. Its revised Unicode handling, survivor/recovery review, named-person privacy and anti-brigading provisions need dedicated tests before public submissions exist.

## Remaining release checks

1. Validate a real publisher-feed snapshot for automatic, explicitly labelled listing. The reviewed edition remains optional and requires human approval; no approval is fabricated for publisher cards.
2. Run `npm run release:check -- --publisher-snapshot /private/path/snapshot.json` for a publisher-only release, or omit the argument for reviewed content. It refuses empty or stale content and never writes an approval.
3. Complete real browser/device checks at the four documented viewports, including touch/WebGL, keyboard focus and reduced motion. The current authoring environment cannot perform those checks.
4. Re-run CI and verify the exact Vercel candidate. Release the matching policy/configuration and verify the stored publisher snapshot; inspect the live API after release.
5. Before Reddit promotion, make the repository public if desired and retain the included MIT code license and separate asset/publisher credits. Third-party assets and publisher material retain their own terms.

The supported-feed map resolver now uses explicit physical-outcome relations and sourced named-feature reference points. It remains deliberately limited and labels approximate areas; unknown places are never filled with a publisher headquarters or 0/0.

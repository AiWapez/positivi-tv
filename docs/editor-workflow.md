# Maintainer editorial workflow

The first implementation keeps editing off the public website. Only a trusted repository maintainer runs these commands on their own machine. GitHub write permissions and the eventual deployment control publication; an actor name in JSON is an audit label, not authentication. Do not expose this CLI as an unauthenticated HTTP endpoint.

## Private workspace

`.editor/` is ignored by Git. Keep candidates, article text, source agreements, decision files and history private, with source-specific body-retention limits. Back up this directory privately; the public edition is not enough to reconstruct its review evidence. Do not upload it to a public repository or publish it as a CI artifact.

Create `.editor/sources.json` as a map of source IDs to GoodSignal `SourcePolicy` plus a `displayName`. Each source requires exact domains, enabled status, type/tier, permitted title/summary use, a documented permission reference and retention days. There are deliberately no pre-approved sources. Do not infer permission from a free tier, a robots file, or the existence of an RSS feed. Fetch/storage permission and display permission are distinct.

## Prepare and inspect

Prepare a candidate JSON file matching `src/goodsignal/types.ts` → `Story`. Article body and literal outcome/date/quantity spans support review; uncertain fields remain uncertain. Do not fabricate evidence, quotations, places, dates or source URLs.

```sh
npm run editor -- import /private/path/candidate.json
npm run editor -- inspect story-id
```

Import always strips supplied approval. A new ID starts pending at version 1. Re-importing an existing ID increments the version, preserves first retrieval, and clears prior review. Inspection shows outcome text with surrounding context, dates, quantities, classification, evidence, geography, permission policy, and all GoodSignal findings. Read the actual article and evidence; quote presence alone cannot verify meaning.

## Human decision

Write a private decision JSON containing the current actor, timestamp, storyVersion, policyVersion, action (`approve`, `archive`, `reject`), edited boolean, note, and explicit checks for claim/date/evidence/rights/context/safety. Use the actual policy constant from the engine. Resolve blocking findings before approval; old outcomes need archive approval. Do not stamp every check true without performing it.

```sh
npm run editor -- review story-id /private/path/decision.json
npm run editor -- publish
```

The CLI records local private history and generates `content/edition.json`. Only public cards, versions, expiry and status information go into that file. The current adapter intentionally omits article images until per-image permissions are supported. Inspect the diff, commit the edition, run checks, and deploy. Every edition is a repository/deployment snapshot, not a mutable server filesystem.

Publishing requires the complete local candidate workspace for already published IDs, preventing a partial restore from silently deleting the rest of the collection. Source-policy changes require recompiling and deploying the edition; shorter retention removes stories at delivery time after expiry. Source agreements may impose stricter deletion obligations, including on Git history; do not use this adapter where durable Git history violates those terms.

## Corrections and withdrawals

For a correction, first withdraw the old public story if its claim is in doubt, commit/deploy the withdrawal, then re-import the corrected candidate. It will need a new recorded approval and version. A local revision alone does not change an already deployed edition.

```sh
npm run editor -- withdraw story-id
```

Commit and deploy `content/edition.json` promptly. A deployed withdrawal removes that story from the API and from connected clients on their next status check. An old private workspace cannot republish a withdrawn version. Older deployment URLs still contain their own snapshots: no global deletion guarantee is claimed. Use an external authoritative store before promising immediate revocation across retained deployments.

## Consistent supply

This release supports reviewed publication without paid model calls. [The daily NASA collector](daily-collection.md) writes pending candidates to a private queue. Import them with `npm run editor -- sync` under an authorized Vercel development environment. Additional permitted RSS/API sources and structured extraction can be added later. Keep quotas, licensing, source bias, duplication and editorial capacity explicit; let a smaller honest edition be valid.

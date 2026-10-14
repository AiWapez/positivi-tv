# Integrating the standalone engine later

This branch is safe to review independently of the website. Nothing imports the engine from `src/App.tsx` or `api/stories.ts`, and no ingestion schedule is installed.

## Run locally

Use Node.js 24. From the repository root:

```sh
npm run test:goodsignal
npm run demo:goodsignal
```

These commands need no npm installation, API key, or network connection. Node strips the erasable TypeScript syntax for execution. This is distinct from static type checking. With TypeScript installed, run `npm run typecheck:goodsignal`; CI obtains the existing project's TypeScript version explicitly for this check.

## Core usage

```ts
import {
  assessCandidate, applyHumanDecision, composeEdition,
  scheduleChannel, publicCard, makeManifest, checkBeforeDisplay,
} from './src/goodsignal/index.ts';

// candidates and source policies come from trusted host storage/adapters.
const assessment = assessCandidate(candidate, context);
// Present every finding and source context to an authenticated editor.
// The host authenticates/authorizes and records this decision before calling:
const approved = applyHumanDecision(candidate, editorDecision, context);
const edition = composeEdition([approved], context);
const cards = edition.stories.map(s => publicCard(s, context));
const schedule = scheduleChannel(edition.stories, context);
const manifest = makeManifest(edition.stories, context, collectionVersion);
// Publish the matching cards/schedule/status generation atomically.
// At playback, obtain a sufficiently fresh authoritative manifest first:
const guard = checkBeforeDisplay(schedule[0], freshlyFetchedManifest, currentUtcTime);
if (guard.allowed) {
  // Render the permitted card as safe text, with source and true date.
}
```

This illustrates the order of operations, not a runnable backend. Definitions, durable storage, review UI, authentication, live data, and manifest transport must be supplied by integration. `makeManifest` is for trusted server use; a browser cannot authorize content by generating its own manifest.

## Node fetching

Import `safeFetch` separately from `src/goodsignal/safe-fetch.node.mjs`. Supply permitted domains and reviewed fetch/robots policy callbacks. Do not pass callbacks or DNS/request adapters from untrusted requests. The default transport checks and pins public DNS answers; the callbacks must themselves fetch/cache policy data safely. It returns article/feed text, not parsed stories.

No model provider is bundled. A future extraction adapter should have no tools, return constrained structured fields, cache by content/model/policy version, retain uncertainty, and stop at a configured spend cap. Convert extraction into a candidate only after runtime validation, and show supporting context to a reviewer. String/span presence is not semantic verification.

## Corrections and live playback

Persist versioned story history with optimistic concurrency. An edit invalidates the previous approval immediately; approval of the revised version is a new decision. Rebuild the collection and manifest together, revalidate status before every new card, and clear any withdrawn card already visible when its update arrives. Enforce a measured cache/refresh budget. Define offline behavior and a “Rejoin channel” control explicitly.

`buildTour` handles one full bounded cycle. `scheduleChannel` produces a finite offline snapshot. A future live scheduler must carry cycle and passed-over state across incremental block updates and avoid rescheduling already-played events as new. That service is not installed here.

## Before replacing the legacy API

1. Establish source-specific fetch/display/storage permissions and remove the existing hardcoded fallback array and single-word classifier from the replacement path.
2. Implement authenticated editorial review and durable auditable storage.
3. Produce an approved collection without fabricated fallbacks; use a dated archive when current supply is thin.
4. Connect authoritative manifests and test withdrawal propagation through real CDN/browser behavior.
5. Evaluate actual labelled feed candidates with event-grouped/time-separated holdouts.
6. Integrate the globe, ticker, and player in a separately reviewed website change.

All current test fixtures are synthetic. Do not copy their “approved” fields, example domains, evidence notes, or claimed permissions into a public source collection.

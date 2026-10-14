# Verification

The implemented story flows from the React controls → `/api/stories` → the committed reviewed edition → the current manifest → the same list/globe dataset. Editing flows through a private maintainer CLI → GoodSignal → public projection → a versioned edition and deployment.

## Automated checks

- Full frontend and API TypeScript checking plus Vite production compilation.
- The GoodSignal regression tests and synthetic demo, including the v3.1 Wilson-bound advisory proposal amendment.
- Publication integration tests: mandatory review, private-field exclusion, actual dates, archives, expiry, version changes, withdrawals, absent geography, safe links, and prevention of withdrawal resurrection.
- Full private editor flow in an isolated temporary workspace: import, inspect, approve, publish, revise, stale-review rejection, and withdraw.
- Shared filtering/discovery tests, including fixed sample dates and production clock behavior.
- API handler tests for method, uncached responses, and empty reviewed collection.
- Emitted JavaScript API loading under Node 24, including JSON import attributes and rewritten dependency extensions.

- Publisher-feed lane tests cover the three screening regressions, plan/research/outcome separation, invalid dates, old events, unsafe and off-domain links, unknown and incidental locations, duplicate and syndicated reports, per-source failure carry-over, all-source failure preservation, overlapping runs, refresh isolation, withdrawals, switches, retention and the public contract for both provenances.
- Collector regressions cover pending-only intake, stable IDs, canonical deduplication, date/domain checks, parser bounds, robots policy, batch limits and endpoint authentication.

## Verification limit

No supported browser-control capability is available in this authoring environment. Browser rendering, screenshots, actual WebGL execution, touch and keyboard interaction testing have not been performed or claimed. The approved static concept is the reference; this React port still needs the viewport checks below.

Review 1440 × 1000, 1024 × 768, 390 × 844 and 320 × 740. Check spherical Earth and imagery orientation; pin alignment and far-side occlusion; drag/pinch/zoom/reset/expand; card selection and camera flight; filtering across views; save persistence; focus and dialog dismissal; mobile safe areas and overflow; reduced motion; network loss and WebGL failure fallback.

## Launch boundary

Production edition is intentionally empty until real sources and stories are reviewed. NASA RSS intake and a private daily queue are implemented. Model extraction, unattended publication of the reviewed edition, accounts and community submissions are not provisioned. The publisher-feed lane is enabled on the integration branch for preview verification; tests use synthetic feeds and make no live publisher requests. The production cron becomes active only after the branch is released. The code is ready for review and preview; it is not evidence that an unattended daily newsroom is operational.

## Reader-first release additions

Privacy and terms/source information are reachable in the footer on desktop and mobile. Privacy includes clearing device-local favorites. No analytics or auth dependency is included. Production security headers restrict scripts, assets and browser connections to this origin, disable embedded framing and browser camera/microphone/geolocation/payment access, and suppress outgoing referrers. The application does not ask for those permissions. Live header delivery is verified on the preview separately from static configuration tests.

## Publisher-feed integration checks

Local baseline: 76 engine tests and 86 app tests passed unchanged under Node 24.19.0, plus TypeScript/Vite build. Integration amendments add required author and linked-license attribution for licensed sources, skip missing/recognized third-party credits and restrictive rights notices, turn automatic country pins off, and support a read-only publisher-only content release check. Final local checks: 76 engine tests plus 93 app tests (169 total), TypeScript/Vite build, scoped engine typecheck and synthetic demo all pass. An initial cache miss now retries after 60 seconds rather than the 30-minute successful-read interval.

Real preview verification at commit `2702a1d` on 14 October 2026: authenticated `/api/refresh-feeds` returned HTTP 200, all four enabled sources fetched successfully, and the private snapshot contained 7 listed stories (NASA 4, Mongabay 3; NSF and Global Voices had no qualifying current items). An unauthenticated call returned 401. `/api/stories` and its timestamp-query variant both returned HTTP 200, the same snapshot revision and 7 publisher-feed cards, with no-store headers. All three Mongabay cards carried author/license attribution; every automatically selected story had null coordinates under the conservative map policy. This tests actual deployed collection, private Blob writes and reads, and the public API contract—not browser rendering or the recurring production schedule. Production remains unchanged.

## Geography and distribution pass

Local checks on 14 October 2026: 76 engine + 99 app tests (175 total) pass with TypeScript/Vite build. Geography regressions cover physical outcome relations, feed scene-setting, off-Earth/origin/incidental/multiple-place abstention, conservative country fallback, coordinate/reference tampering and the map-off switch. No browser-control capability is available, so WebGL/touch/screenshots remain unverified here. Prior user visual approval is not a substitute for claiming automated browser tests.

MIT licensing is added for original code, with publisher and asset rights kept separate. `npm run feeds:local` provides a keyless, cloud-storage-free localhost workflow; the source fetcher cannot contact public feeds from this local authoring network, so live transport verification uses Vercel. Local files are git-ignored. The command preserves prior data on all-source failure and refuses overlapping jobs.

# Verification

The implemented story flows from the React controls → `/api/stories` → the committed reviewed edition → the current manifest → the same list/globe dataset. Editing flows through a private maintainer CLI → GoodSignal → public projection → a versioned edition and deployment.

## Automated checks

- Full frontend and API TypeScript checking plus Vite production compilation.
- The existing 74 GoodSignal regression tests and synthetic demo.
- Publication integration tests: mandatory review, private-field exclusion, actual dates, archives, expiry, version changes, withdrawals, absent geography, safe links, and prevention of withdrawal resurrection.
- Full private editor flow in an isolated temporary workspace: import, inspect, approve, publish, revise, stale-review rejection, and withdraw.
- Shared filtering/discovery tests, including fixed sample dates and production clock behavior.
- API handler tests for method, uncached responses, and empty reviewed collection.
- Emitted JavaScript API loading under Node 24, including JSON import attributes and rewritten dependency extensions.

## Verification limit

No supported browser-control capability is available in this authoring environment. Browser rendering, screenshots, actual WebGL execution, touch and keyboard interaction testing have not been performed or claimed. The approved static concept is the reference; this React port still needs the viewport checks below.

Review 1440 × 1000, 1024 × 768, 390 × 844 and 320 × 740. Check spherical Earth and imagery orientation; pin alignment and far-side occlusion; drag/pinch/zoom/reset/expand; card selection and camera flight; filtering across views; save persistence; focus and dialog dismissal; mobile safe areas and overflow; reduced motion; network loss and WebGL failure fallback.

## Launch boundary

Production edition is intentionally empty until real sources and stories are reviewed. No live ingestion, model extraction, daily scheduling, external database, accounts or social network is provisioned. The code is ready for review and preview; it is not evidence that an unattended daily newsroom is operational.

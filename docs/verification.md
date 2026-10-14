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

- Collector regressions cover pending-only intake, stable IDs, canonical deduplication, date/domain checks, parser bounds, robots policy, batch limits and endpoint authentication.

## Verification limit

No supported browser-control capability is available in this authoring environment. Browser rendering, screenshots, actual WebGL execution, touch and keyboard interaction testing have not been performed or claimed. The approved static concept is the reference; this React port still needs the viewport checks below.

Review 1440 × 1000, 1024 × 768, 390 × 844 and 320 × 740. Check spherical Earth and imagery orientation; pin alignment and far-side occlusion; drag/pinch/zoom/reset/expand; card selection and camera flight; filtering across views; save persistence; focus and dialog dismissal; mobile safe areas and overflow; reduced motion; network loss and WebGL failure fallback.

## Launch boundary

Production edition is intentionally empty until real sources and stories are reviewed. NASA RSS intake and a private daily queue are implemented. Model extraction, unattended publication, accounts and community submissions are not provisioned. The production cron becomes active only after the branch is released. The code is ready for review and preview; it is not evidence that an unattended daily newsroom is operational.

## Reader-first release additions

Privacy and terms/source information are reachable in the footer on desktop and mobile. Privacy includes clearing device-local favorites. No analytics or auth dependency is included. Production security headers restrict scripts, assets and browser connections to this origin, disable embedded framing and browser camera/microphone/geolocation/payment access, and suppress outgoing referrers. The application does not ask for those permissions. Live header delivery is verified on the preview separately from static configuration tests.

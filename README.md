# PositiviTV

An interactive window onto constructive stories around the world.

## GoodSignal engine

GoodSignal is a standalone TypeScript foundation for story qualification, a shared daily edition, optional explicit preferences, and a broadcast schedule. This branch implements the first deterministic core of the combined v3 design with the review amendments incorporated. It does not connect the existing website to this engine.

**Node.js 24 is required for the engine tests and demo.** The engine adds no runtime dependencies, paid services, or API keys.

```sh
npm run test:goodsignal
npm run demo:goodsignal
```

The demo uses invented, clearly labelled fixtures. It does not fetch or publish news. Tests are authored regression cases, not a real-world accuracy benchmark.

After installing the project's development dependencies, check engine types with:

```sh
npm run typecheck:goodsignal
```

The GoodSignal GitHub Actions workflow also runs its tests, synthetic demo, and scoped TypeScript check.

### Implemented

- Structured candidate validation, all-reason triage, source permission and retention checks.
- Separate event/publication/origin dates and conservative handling of imprecise dates.
- Quote-presence checks as review assistance; human approval remains mandatory.
- Edition membership with conditional geographic and human-story allocations, shared constraints, and recorded cap relaxation.
- Explicit preferences, hard exclusions, unseen-first selection, and opt-in discovery.
- Rank-bounded globe tours, shared UTC schedules, global/unlocated segments, and ticker selection.
- Versioned review records, correction/withdrawal helpers, fresh-manifest checks before display, and public-data projection.
- Private Promise Ledger proposals and conservative advisory automation statistics.
- A separate Node HTTPS fetch helper with pinned checked DNS, redirect checks, explicit policy/robots callbacks, and response limits.

### Read before integration

[The canonical specification](docs/goodsignal-spec.md) defines the rules, formulas, trust boundaries, evaluation plan, and remaining adapters. [Integration notes](docs/goodsignal-integration.md) show how to use the modules without treating a browser-supplied approval as authority.

The old `api/stories.ts` remains the legacy API, including its keyword rules and hardcoded fallback content. This algorithm branch does not replace or deploy it. The later integration must remove those fallbacks, connect permitted sources, implement authenticated review and durable storage, publish authoritative status snapshots, and evaluate real labelled candidates before launch.

There is no claim of proprietary mathematics, automatic fact verification, or measured screening accuracy. The rules are inspectable, and the tests make their intended behavior reproducible.

## Existing website

```sh
npm install
npm run dev
npm run build
```

The existing React/Vite website and deployment behavior are otherwise unchanged by the standalone engine.

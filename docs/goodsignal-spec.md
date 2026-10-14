# GoodSignal canonical specification

Version 0.1.0 • Policy `goodsignal-0.1.0` • 14 October 2026

This consolidates the combined Claude/ChatGPT v3 proposal and the subsequent amendments. It is the normative implementation contract for the standalone engine, not a claim of measured news-screening quality. When a design aspiration is not yet implemented, it is identified below. The reader integration is documented separately in `goodsignal-integration.md`; see `launch-scope.md` for current product decisions.

## 1. Product and launch boundary

PositiviTV is a free constructive-news globe with a shared daily edition and an automated television-style story program. Watch is scheduled presentation, not live reporting. Launch requires human approval of every story. AI can prepare a review, but cannot authorize publication. Community submissions, learned behavioral profiles, and automated publication are deferred.

The distinguishing product combines a credible constructive-news collection, honest world placement, a shared channel, and eventually follow-through on recorded plans. The underlying techniques are established engineering methods. Reproducibility and measured behavior are the credibility story.

## 2. Ownership and trust

Source policies, evidence assessments, cluster IDs, review decisions, story versions, and status manifests are owned by the trusted publishing service. TypeScript types and an actor string are not authentication. Never expose `applyHumanDecision`, source-policy mutation, or manifest generation as unauthenticated client operations. A host adapter must authenticate editors, authorize each action, persist immutable versions and audit history, and reject stale writes.

Browser preferences can reorder or hide approved stories. They cannot promote a pending candidate. Every publication surface uses `displayEligible`; rank, geographic balance, and popularity cannot override it. The source registry is supplied by the caller and has no live default sources or assumed permissions.

## 3. Input record

`Story` in `src/goodsignal/types.ts` is the executable field contract. It includes stable identity/version, a reviewed event-cluster ID, publisher and URL, title/summary/body, publication and first-retrieval timestamps, event date plus precision/basis/quote, optional origin date, article frame and outcome/research stage, quantities with subjects and quotations, claim-specific evidence, honest geometry, editorial features, status, and review history for the current version.

Date values preserve day/month/year precision. They are not silently converted into exact days for display. The first possible instant in an uncertain date interval is used for conservative freshness. Relative date resolution is left to a reviewed extraction adapter; the core does not guess from recency keywords. A new development on an old project has its own event date and an independently supported origin date.

`impact` and `humanStory` are bounded editorial annotations, not model confidence or objective measures of human worth. A host review process owns them. A missing or invalid location suppresses camera placement without disqualifying a supported story.

## 4. Source policy and URL rules

Every source needs an enabled policy, exact allowed domains, publisher type, explicit title/summary permission, a recorded policy reference, and positive retention days. Unknown sources/rights require review. Blocked sources and press wires cannot publish through this policy. These are editorial rules, not a general claim about all material from those sources.

URLs must use HTTPS, contain no credentials, and avoid local/IP-literal targets. Known tracking parameters are removed while article-identifying parameters are preserved. A root URL with a meaningful query can identify an article; slash count is not evidence quality. A bare homepage requires a specific article citation.

Retention is measured from immutable first retrieval under the source's supplied contract. The host must honor any stricter publisher-specific expiry or deletion obligation before calling the engine. Permission to fetch, store body text, display a title, and display a summary are separate decisions; the host enforces body-retention/fetch terms too.

## 5. Qualification and review

`assessCandidate` collects every applicable reason. It returns a rejection recommendation for configured blocked sources, press wires, or unsafe main URLs; otherwise it returns `needs_attention` or `ready_for_review`. **None of these publishes the story.**

Review findings include malformed metadata, missing outcome/date/quantity spans, unknown date basis, future or conflicting dates, insufficient text, unsupported origin dates, missing checked evidence, unsafe evidence links, unpermitted summaries, plan-only/unsupported article frames, and suspected instructions embedded in article text. Hype, sensitive topics, ambiguous enforcement words, archive dates, and uncertain locations remain visible as observations.

A sentence mentioning criticism does not make an achieved constructive outcome ineligible. “Bust” in an art story or “arrest” in a recovery story is not a deterministic rejection. A plan is stored privately if useful, rather than presented as completed progress.

### Quote presence is not faithful meaning or truth

`hasSpan` verifies that normalized quoted text exists. It cannot establish entailment, negation, causality, the relationship between a quantity and its subject, or which event a date describes. Number presence elsewhere in an article is not evidence for a summary's number. Critical contradictions must be repaired by the reviewer before approval; an LLM confidence score cannot substitute.

The review UI, implemented later, must highlight source spans with surrounding context, show the three dates, article/research stage, proposed summary, evidence material, location, rights, and every finding. The editor explicitly confirms claim, date, evidence, rights, context, and safety checks. Approval after edits is separately recorded. Corrections must produce a new version, clear its old approval, and receive a new review.

### Evidence categories

Evidence levels are ordinal reviewer annotations:

- 0: usable claim support has not been established.
- 1: traceable reporting or appropriately labelled account, with limited support.
- 2: inspected relevant reporting or established independent reporting origins support the specific claim, with limitations recorded.
- 3: inspected relevant primary material supports the specific claim and its outcome/research stage.

A deep university/DOI link, a prestigious outlet, or several copied press releases do not automatically establish a level. `checkedBy` and a supporting note are required. The core does not automatically fetch or independently verify citations. Sensitive secondary topics count as sensitive; they cannot hide under a harmless primary topic.

## 6. Publication, archive, corrections

`applyHumanDecision` accepts a recorded current-policy/current-version review only after the host authenticates the editor. All six checks are mandatory, all blocking findings must be resolved, and the date must be real. It returns a copied record with approved, archived, or rejected state. It does not write a database or deploy anything.

Recent stories require an approved event development within 30 days, counted from the earliest plausible event time. Unknown dates are not recent. Old events need explicit archive approval; they do not backfill the current edition. A meaningful recent result on a project begun in 2019 can qualify as current. First retrieval does not rewrite publication or event time.

`reviseStory` increments the version, marks it pending, and removes its review. `withdrawStory` increments the version and marks it withdrawn. Host persistence must publish an authoritative status manifest and matching collection/schedule version atomically. All surfaces must remove a withdrawn visible card when the update is observed.

`checkBeforeDisplay` denies missing, future, or older-than-30-second manifests, missing/non-public stories, and version mismatches. The helper's “allowed” result means current at that manifest's time, not instantaneous worldwide truth. Host clients must fetch/revalidate sufficiently fresh status before a new display and pause when they cannot. A 30-second online propagation target must be measured across caches; offline clients cannot receive instantaneous withdrawal guarantees.

`publicCard` exports only permitted display fields and excludes article bodies, review notes, and evidence quotations. Public rendering must still use safe text/DOM APIs. Status checking is separate and must precede display in the host.

## 7. Deduplication

Exact ID, canonical URL, and confirmed event-cluster identities are checked during collection selection. Conflicting duplicate IDs are excluded rather than choosing a version by input order. Human-story and geographic allocation use the same checks as general fill.

The engine consumes trusted reviewed cluster IDs. A feed adapter must propose clusters using actor/action/outcome/event-date context and route ambiguous near-matches to review. Entity overlap plus a shared week is not authority to merge. Simhash and origin detection are deferred adapters. New corroborating reports must be inspected before counting independent origins; syndications remain one origin. A new substantive development can be a separate event cluster with a link to its history.

## 8. Shared edition

For an eligible story:

`F = 2^(-event_age_days / 10)`

`E = 0.40 * max(impact, humanStory ? 0.5 : 0) + 0.40 * F + 0.20 * evidence_level/3`

These are starting hypotheses. E expresses editorial priority within an approved collection. It is neither a truth probability nor moral importance.

Default membership: up to 40 stories, a target of two per continent when supply permits, and a target 15% human stories. All insertions enforce current eligibility and one ID/URL/event per slate. Initial source/topic caps are ceil(15%/25% of requested size), minimum one. General fill uses `0.70 E - 0.30 max_similarity_to_selected` with similarity `0.5 same-primary-topic + 0.3 same-known-country + 0.2 same-source`.

If supply cannot fill the slate, cap relaxation is recorded in region/topic/source order. Approval, rights, exclusions, and event uniqueness never relax. Coverage shortfalls include fewer than target, not only zero stories. A smaller edition is valid. Selection determines membership; selected members are then sorted by E, reviewed date, and stable ID for actual presentation. Geographic floors do not dictate a permanent regional opening order.

## 9. Personal feed

Personalization is optional. Explicit topic affinity defaults to 0.5; “more” sets 1, “less” sets 0.2, and hide excludes. Topic filters, hidden topics (including secondary topics), blocked sources, and hidden IDs are hard constraints before discovery/ranking. Saves are bookmarks only. Host preferences and limited seen-cluster history can stay on the device.

Unseen event clusters form the candidate pool first. Previously seen events are omitted unless the caller explicitly enables replay, and replay is considered only after eligible unseen supply has been exhausted with allowed cap relaxation. A different publisher does not make a seen event new. This partition provides the guarantee; a multiplier alone would not.

With explicit preferences, use `B = 0.45 A + 0.55 E`, where A is mean topic affinity. After selecting each item, recompute `D = 0.45/(1+n_topic) + 0.30/(1+n_source) + 0.25/(1+n_region)`, substituting a neutral 0.125 geographic term for unknown geography. Rank by `0.80 B + 0.20 D`. Replay has an additional age multiplier, subordinate to unseen-first eligibility. Cold start preserves incoming shared-edition order subject to constraints. Chronological mode orders by reviewed event date.

Defaults per ten-item selection window: two per source, three per primary topic, three per known region; relax region/topic/source if required and log. One event per whole feed remains mandatory. Opt-in discovery every fifth slot chooses a high-E unseen eligible story outside explicit preferred topics; it never bypasses exclusions. Why strings are derived from the actual selection path.

The host marks an event seen only after an explicit open or five seconds of visible card exposure in an active tab. This is repetition control, not a behavioral optimization signal. Save, skip, scroll speed, and watch time do not update affinity.

## 10. Broadcast and ticker

`buildTour` selects only from the first three remaining ranked entries, including the opening choice. Within that window, a story passed over twice is forced next, ahead of pacing and geography. Otherwise score `0.80 rank + 0.12 camera_comfort + 0.08 westward_preference`. Opening morning preference also stays inside the window. Pacing can prefer a human/uplift topic after two other topics only when it cannot bypass a forced entry.

The morning-longitude formula approximates 7am solar time. It is not actual sunrise, and westward travel is a preference rather than a one-direction guarantee. A global or unlocated story gets a pulled-back view; invalid coordinates never become a pin. All eligible stories remain in the cycle. Multi-location rendering requires a host camera that frames the grounded points.

Dwell seconds: clamp(20,45,8+word_count/3), multiplied by 1.25 for multi-location cards. The initial schedule allocates two additional travel seconds for located cards; the host can animate within that budget or cut under reduced motion. UTC slot boundaries make joining viewers resolve the same item. Repeats start only after a full cycle and only when continuous playback is explicitly enabled.

`scheduleChannel` generates a finite horizon (default 24 hours). The host regenerates future blocks when the edition changes; it must preserve the current cycle/played state at block boundaries when applying updates. The core's returned cycle field makes boundaries inspectable but it is not a live clock or media player. Pause/skip move the viewer to a personal position; “Rejoin channel” returns to the authoritative UTC slot. Pause rendering in a hidden tab. Personal exclusions apply to personal tours; explain the shared nature of the public channel or provide local filtered substitutions.

The ticker uses the same approved slate, deduplicates events, and omits current/next channel events. Rendering, pause controls, and status refresh are integration work.

## 11. Promise Ledger and automation

`recordPromise` stores a private traceable plan with a supported quoted quantity/deadline and trusted editor identity. `proposePromiseMatches` returns proposals using reviewed topic/entities and quantity; it never asserts “Promise kept.” Human confirmation of beneficiary group, geography, quantity/unit, deadline, and full scope remains required. Public matching/UI are deferred. Store only within source retention terms and operational budget.

`evaluateAutomation` is advisory only. It groups samples by event, keeps source/topic/model/policy cohorts separate, excludes old/future labels, treats edited approvals as unassisted failures, and refuses sensitive/flagged classes including sensitive secondary topics. Defaults, amended to v3.1: at least 100 independent events and the lower endpoint of the two-sided 95% Wilson score interval at least 0.95. Even 50/50 does not meet that bound. `exactLowerBound` remains available for comparison; proposal decisions use `wilsonLowerBound`.

The statistical calculation assumes independent fixed-sample trials. Correlated events, selective review, repeated tuning, distribution shifts, and multiple classes can invalidate a naive interpretation. A later automation service needs independent holdout evidence, source-policy checks, human approval of each class, random audits with minimum cadence, revocation, immediate suspension after severe failures, and a global kill switch. **This engine enables no automatic publication path.** All publication still requires recorded human approval.

## 12. Fetch boundary

`safe-fetch.node.mjs` is server-only and separate from browser exports. It requires explicit allowed domains, a fetch-permission callback, and a robots-policy callback. It validates HTTPS URLs, checks every DNS answer against a conservative public-address policy, pins the checked address at the TLS connection while retaining hostname validation, and repeats checks after each allowed redirect. Defaults: at most five redirects, ten seconds total, two MiB, approved HTML/XML types, and identity encoding only. Unsupported compressed responses are rejected rather than decompressed without bounds. Temporary 429/5xx failures are operational retry/defer events, not editorial rejection labels.

Policy callbacks, DNS, and request adapters are trusted host code, never client input. RSS parsing, article extraction, robots retrieval/caching, and publisher-specific authorization are not implemented. Transport tests use mocked DNS/request adapters; live network behavior and host egress controls need validation before integration. No production sources are contacted by tests or demo.

## 13. Evaluation and regression contract

The authored tests validate invariants and known failure patterns. They do not establish screening accuracy, real-world safety, reviewer throughput, geographic fairness, or optimal ranking weights.

Before launch: write a labelling guide; collect roughly 300 actual feed candidates including rejects, ambiguity, regional sources, and research stages; independently double-label an overlapping subset and adjudicate disagreements. Keep every event cluster in one partition. Reserve later-time and unseen-publisher holdouts where feasible. Freeze thresholds before final evaluation; report uncertainty and supply bias.

Qualification baselines: keyword screen, rules only, extraction without span checks. Ranking baseline: newest-first over the same approved pool. Measure these tasks separately. Track false acceptance and rejection, recommendation precision, abstention, date honesty, edited approval rate, reviewer minutes per published story, stale output/correction propagation, duplicates, coverage conditional on supply, explanations, maximum scheduling delay, and operating cost. Compare at matched coverage/review budgets. No accuracy percentage is claimed from synthetic tests.

The test suite includes missing/false authority, old wind-farm-style dates, a new milestone on an old origin, impossible/future dates, unrelated primary links, negated-summary limits, contextual keyword ambiguity, injected instructions, permissions/retention, duplicate allocations, hard exclusions, unseen/replay, top-three opening and forced-next, global-only tours, withdrawal/version/manifest freshness, statistical uncertainty, and safe-fetch redirects/DNS policy.

## 14. Implemented versus remaining

Implemented: deterministic typed core, runtime candidate checks, human-review transitions, shared edition and personal selection, finite channel schedule and ticker membership, public projection and lifecycle helpers, private plan proposals, advisory automation analysis, constrained Node fetch helper, synthetic demo, tests, scoped typecheck configuration, and a CI workflow.

Remaining integration: permitted source inventory; RSS/readability and model extraction adapters; semantic evidence review; robust reviewed event clustering/origin tracking; authenticated review UI; durable transactional storage/audits; actual robots/source-retention enforcement; atomic versioned publication and cache invalidation; browser globe/media/ticker controls; scheduler updates across live block boundaries; real labelled evaluation; and any automated-publication service.

The existing API's fallbacks and keyword classifier are verified legacy debt. They must be replaced in a later integration change; this branch deliberately does not alter the running website API. No API keys, production permissions, live ingest jobs, database changes, or deployments are required to inspect and test this engine.

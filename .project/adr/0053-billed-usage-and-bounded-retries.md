# ADR 0053: Exact billed usage and bounded transient retries

Accepted, 2026-11-16. Completes the accounting follow-up to ADRs 0051–0052.

Read usage.cost_in_usd_ticks as a non-negative exact integer. Safe JSON numbers and canonical decimal strings are accepted; unsafe numbers, fractions and invalid values are unknown. Sum with BigInt internally and serialize ticks/USD as decimal strings. Never store BigInt in sessions and never reinterpret estimates as billed amounts. One dollar is 10^10 ticks. No rate card is needed for an amount actually reported by the provider.

A billed cost reports either a complete total or a known subtotal with missing requests. An explicit zero is known; absence is not zero. Token completeness and billed-cost completeness are independent. usage.steps counts actual attempted provider requests; reportedSteps counts usable usage reports. Aggregate session cost from run costs once, not from lastStep again. Invalid historical cost objects degrade to unknown. Existing usage fields are open host records in the pinned session schema; no vendored schema changes are required. A portable-session round-trip test protects this boundary.

New defaults page.ask/page.build v2 pin provider manifest v2 and page-loop@2. They send max_completion_tokens. Explicit v1 references retain manifest v1/max_tokens and zero transient retries; their fingerprints are regression-pinned. The upstream parameter limits visible output, not reasoning or function-call tokens, and is not a monetary ceiling. Host deadlines and request/tool/write ceilings remain enforced.

page-loop@2 permits one transient retry across the whole turn, only on explicit retryable 429/500/502/503/504 responses. Every attempt consumes the normal request budget and retains any usage reported on the error response. Backoff starts at 250 ms with a 2000 ms wait ceiling; valid Retry-After is a minimum wait, never shortened. If it cannot fit the ceiling/deadline, decline the retry. Cancellation interrupts the wait. Count a retry only when dispatched. Authentication, forbidden access, bad requests, malformed replies, validation failures and thrown transport errors are not retried. No model fallback is introduced.

The nudge checks the effective scenario step ceiling; no unused nudge is appended when a next step cannot run. Unexpected execution/diagnostic failures cannot erase already reported usage. Run responses expose providerRetries; portable records retain actual request counts and billed usage.

POLICY_VERSION and related agent version strings now live in chat-agent, not builder-core; budgets already live there. Current policy is page-agent/11. Existing hidden usage details display complete billed cost, partial subtotal or unknown cost; the Workbench remains deferred.

Verification uses scripted provider responses, exact integer/aggregation cases, cancellation/deadline and counter tests, legacy profile fingerprints, runtime bundle replays and portable-session round trips. No paid live benchmark is required.

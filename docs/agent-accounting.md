# Agent accounting and retries

Cost comes from the provider's usage.cost_in_usd_ticks, not from a tariff estimate. ticks and usd are exact decimal strings; kind is billed. completeness is complete only when every request has a reported cost. Partial cost is a known subtotal, not an estimate of the missing charge. Zero is accepted only when explicitly reported. Missing or unsafe numeric data stays unknown.

usage.steps is the total attempted request count; reportedSteps is the number of usable usage objects. A token-incomplete response can still report complete billed cost. Known tokens and cost survive errors, cancellation and timeout. Sessions retain the data through existing open usage records, without a schema rewrite. Old estimates and unknown costs do not become billed amounts.

The current defaults are page.ask@2 and page.build@2. Both select provider manifest v2 (max_completion_tokens) and execution policy page-loop@2. Explicit v1 references remain supported for replay/compatibility and have no transient retries. Never edit a shipped profile in place.

Retries are implemented by shared execution, not hidden in the HTTP adapter. page-loop@2 permits one retry in the whole turn for explicitly retryable 429/500/502/503/504. It consumes the same request/deadline ceilings as normal steps. Retry-After must fit a maximum 2000 ms wait; otherwise the error is returned. Cancellation releases the timer/listener. Thrown network errors, 401/403, other persistent statuses, malformed responses and gate errors are not automatically retried. A failed provider request may have incurred an unknown charge; do not assume it was free.

max_completion_tokens limits visible output according to the upstream API; it is not a cap on all reasoning/function-call tokens or on billed dollars. There is no pre-charge monetary ceiling in this delivery. The actual amount is recorded after a provider report.

Source contracts: [xAI cost tracking](https://docs.x.ai/developers/cost-tracking), [Chat Completions reference](https://docs.x.ai/developers/rest-api-reference/inference/chat-completions.md). Implementation: chat-agent/cost.ts, usage.ts, agent/execution-policy.ts and execution.ts; xAI status/header decoding in provider-xai/errors.ts. Agent version strings are in chat-agent/policy.ts.

The browser execution map, discussion-only scenarios, search/context work and paid model experiments are separate follow-ups.

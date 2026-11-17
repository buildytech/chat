# ADR 0057: Build completion, configurable ceilings and cache routing

Accepted, 2026-11-17. Evidence: owner birthday session exported at 11:36 UTC, browser dc1d624: two catalog searches and six block reads consumed the eight logical steps. The shared final-answer branch then sent tool_choice none. The model printed a page, no writer/gate ran, and the host reported a completed answer.

Build must never use the Ask no-tools summary branch. A Build result without an accepted write is a typed build_no_proposal failure, never successful raw JSON/prose. An accepted unchanged write remains a valid no-op. No prose parsing, implicit writes or invented tools are introduced. Ask/discussion behavior remains separate.

New default page.build@3 uses page-loop@3. Its configurable safety ceilings are 24 logical steps, 32 actual requests, 64 tool calls, eight write attempts and the existing per-request output limit. Registered profiles can raise these defaults up to the separate safety ceilings (64 steps, 80 requests, 256 tool calls). It stops immediately on acceptance, not after a target number of calls. The host retains its deadline and repeated-identical-error stop. Complex pages are not assigned an arbitrary allowance by block count; replay covers twelve blocks and repair.

Completion reserves four logical steps, five actual request slots, four tool calls and 60 seconds of remaining host runtime. Approaching any boundary forces write_page; a large read batch cannot consume the reserved tool capacity. Named-tool rejection may fall back to required within the same global request ceiling, but read handlers remain disabled during forced completion. A single host notice announces completion; it is not appended repeatedly. Trace records phase and completionReason.

Legacy profile limits and fingerprints remain unchanged. The safety fix disabling successful text-only Build completion applies to all versions. Policy version is page-agent/12. The expanded ceilings apply only to new execution profiles and do not silently raise old profile budgets.

Caching complements these controls. New execution policy passes one stable run routing key; provider-xai maps it to x-grok-conv-id. Diagnostics record promptCacheKeySent only, not transport headers or credentials. Tool definitions remain unchanged across requests. Cache hit rate and billing are observed, not promised. Context compaction/object-only repair remains the next independent stage; increasing limits is not claimed to reduce tokens.

Limits cannot guarantee completion after provider errors, cancellation, invalid registry data or an exhausted runtime. In those cases retain usage, trace and rejected-write diagnostics, expose the failure and leave the page untouched. Unlimited loops are not justified by cache discounts.

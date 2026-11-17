# Session completeness, answer quality and tool-step tracing: improvement plan

Status: planned. Author: BuildY audit (Grok Bot). Date: 2026-11-17. Code not changed.
Inputs: two exported sessions (Build run on 2d9ef9e, Ask run on 7bc924d), the xAI API audit
(grokapi-report-2026-11-16.md) and the catalog search audit (constructor-search-audit-2026-11-16.md).

## 1. Evidence

### 1.1 Build run (commit 2d9ef9e, page-agent/10, grok-4.20-0309-non-reasoning, chat-completions)
- 5 requests, prompt 45398, completion 5940, cached 31488 (69%); last step prompt 13809, cached 12416 (90%).
- Tools: search_catalog, get_block x7, write_page x3. Build stops on the first accepted write, so two writes were rejected.
- Likely cause (inferred, not proven): the model used the Stock spec or label (`block.sitemap`, `sitemap`)
  instead of the registry id (`sitemap-footer`) -> `unknown_item` / `schema_invalid`; it then dropped the block
  (answer lists 7 blocks, page has 6).
- Each retry resent the whole page JSON (~5.2 KB). Accepted page still had placeholders (`Label`, `Shortcut`)
  reported as `empty_required_text` after the turn had ended.

### 1.2 Ask run (commit 7bc924d, page-agent/11, grok-4.20-0309-non-reasoning, chat-completions)
- 9 requests for 8 tool calls (search_catalog x2, get_block x6), prompt 61753, completion 617, cached 44544 (72%).
- Billed cost 319625500 ticks = 0.03196 USD, completeness complete, 9/9 requests reported.
  Recomputed from docs.x.ai pricing (checked 2026-11-16: 1.25 / 0.20 cached / 2.50 per 1M):
  17209 x 1.25 + 44544 x 0.20 + 617 x 2.50 = 0.03196 USD. Matches billed.
- Last step: prompt 8727, cached 128, 118243500 ticks (0.0118 USD, 37% of the run). Cache miss on the final step.
- Reads ran one per request (no parallel reads).

### 1.3 Session object gaps (Ask export)
1. The user message appears twice (20:44 and 20:46 UTC+3); the first has no assistant message and no run record,
   while `incompleteRuns` is 0. Failed or aborted attempts are lost.
2. No per-step trace in the export: no tool arguments, tool results, per-step usage/cached/ticks
   (only `lastStep`), no tool_choice per step. ADR 0054 says run-trace/1 is persisted in `ext["agent-trace"]`,
   but this export has only `ext.chat`. Verify whether the trace is written for Ask runs and whether export includes it.
3. `answer.blocks` holds Stock specs (`block.dishshowcase`), not registry ids.
4. Screens returned by search are not recorded, so the answer cannot be checked against evidence.

### 1.4 Answer quality (Ask)
- Asked "how will you search and pick blocks", the agent made 8 real calls but answered with a generic recipe:
  no screen ids, scores or variants from the actual results.
- It offered `write_page` "with the full page JSON in one call": not available in Ask and contrary to patch repair.
- It exposed internals (`itemIndex`, `get_block`, filter parameters) to the end user.
- It did not use `industry=food` and missed the most relevant catalog blocks (`grillbuilder`, `menuboard`,
  `quickorder`, `combobuilder`); it read six generic blocks instead.
- Good: Russian copy and locale=ru were proposed correctly.

## 2. Plan (priority order)

### P0. Tool-step tracing and session completeness
- run-trace/1 for every run (Ask, Build, discuss), persisted server-side and exported:
  - header: runId, scenario {id, version}, fingerprint, modelId, providerVersion, catalogDigest, budget, deadlineMs, stopReason;
  - stable prefix once: hashes and sizes of system prompt and tools; user context broken down by key
    (request, page, propsOfBlocksOnPage, itemIndex) with size and stable/volatile flag; bodies only with includeBodies;
  - steps[] per provider request: toolChoice, parallelToolCalls, max tokens field, appended messages (role, size, hash),
    nudge flag; response finish_reason, content (text or null), tool_calls (id, name, arguments), refusal,
    latencyMs, HTTP status and error code; usage prompt/completion/cached/reasoning, cost_in_usd_ticks or "unknown", hit %;
  - toolResults[] per call: callId, name, args, ok, result size, result or hash, durationMs;
    for write_page also gate codes (with `similar`), accepted, pageRevision, diff;
  - budgetLeft after each step (steps, requests, tools, writes, tokens, time).
- Record every attempt with status aborted / error / superseded, even without an answer; count them in incompleteRuns.
- Per-step usage and ticks in the session, not only lastStep.
- Record search results (screenId, score, matched, via) per search_catalog call.
- Never include keys, headers or endpoints.
- Verify: Ask and Build exports both contain the trace; replay tests can load a trace as a fixture.

### P0. Cache stability across steps
- Keep the tools array byte-identical for the whole run; change only tool_choice on the final step
  (hypothesis: the final step currently changes tools or prompt prefix; confirm with the trace).
- Send a stable cache key per run (`x-grok-conv-id` on Chat Completions, `prompt_cache_key` on Responses).
- Move itemIndex into a stable message before volatile page/props content.
- Show cached tokens and hit % in the run, last-step and session usage lines
  (ComposerDetails.svelte, ChatMessage.svelte); missing value shows "unknown", never 0.
- Verify: last step hit rate > 80% on the same scenario; cost per Ask run drops accordingly.

### P1. Fewer requests
- Allow parallel read tool calls (search_catalog, get_block, get_page) in one response; keep the host-side
  single-write check (multiple_writes).
- Compact get_block for Ask/discuss: title, role, variants; no sample, props outline or repeated icons hint.
  Full detail only in Build.
- Do not return the full vocabulary on noFit when itemIndex is already in the prompt.
- Target: Ask of this shape in 3-4 requests instead of 9.

### P1. One block-name vocabulary
- Registry id everywhere the model reads or writes: itemIndex, get_block, search results, answer.blocks.
- write_page normalizes spec or label to registry id (reuse resolveItem) or returns an exact fix
  (`use "sitemap-footer"`).

### P1. Patch-only repair for failed validation
- Validate each block's props with the shared schema (Zod or Ajv, one source for UI and agent) before acceptance.
- On failure return compact errors: JSON Pointer path, code, expected value, and the instruction to send an
  RFC 6902 patch for those paths only.
- Treat empty required text and sample placeholders as errors before acceptance, so the model can fix them in the same run.
- Target: first write accepted or fixed with one small patch; no full-page resend.

### P2. Ask answer contract
- Answer shape: what was found (screen ids, blocks, variants), why it fits, what to do next.
- No internal names (itemIndex, tool names, parameters) in user-facing text.
- Ask never offers write_page; it suggests switching to Build.
- Verify with golden prompts (en, ru, es) in replay/eval.

### P2. Search relevance (links to the catalog search audit)
- ru/en synonyms for niches derived from the catalog (e.g. mangal -> grill, bbq -> grillbuilder).
- Use the industry facet in the first query when the brief names a niche.
- One normalized index and matcher for UI and agent; index hash in contractFingerprint.

### Later
- Responses API with previous_response_id for repair loops; OpenAI SDK as the common client
  (maxRetries 0, AbortSignal deadline, xAI fields read through a narrow adapter type).
- Streaming; grok-4.7 reasoning_effort low re-measure.

## 3. Acceptance checks
- Exported session contains run-trace for each attempt, including failed ones.
- Per-step usage and ticks sum to the run totals; missing values are "unknown".
- Ask scenario "promo for new-year mangal delivery": <= 4 requests, last-step hit > 80%,
  answer names real screens and includes grillbuilder or menuboard when relevant.
- Build scenario from 1.1: zero full-page resends; a rejected block is fixed by patch or normalized id.

## Implementation follow-up (Codex, 2026-11-17)

ADR 0055 implements the session-data portion of P0: an attempt ledger before async work, failure/abort/supersession/interruption records, deduplicated usage, retry links, observed provider metadata, typed steps/tool records, browser scenario forwarding and compact search evidence in default exports. The server trace remains distinct from the host attempt and is not fabricated after disconnect. Registry IDs in answer.blocks are also implemented. The original audit evidence above is preserved.

Not implemented in this pass: server-side persistence (incompatible with the current stateless scope), cache key/prefix experiments, paid cache-hit/request-count acceptance, parallel reads, compact get_block, patch-only repair, answer-contract and relevance changes. Existing Ask proposal defaults remain unchanged. No >80% cache-hit or <=4-request result is claimed without a live measurement.

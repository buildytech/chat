# ADR 0022: Collection intake draft (host pre-placement, compact intake turn)

Status: accepted (2026-11-11). Follow-up of ADR 0019 (Stock collection intake); keeps ADR 0018 (self-correction).
Owner decision t126u (Build improvement 1 of 6).

## Context

A Build turn of a chat opened from a Stock collection cost about 135k prompt tokens. Staging, 2026-11-11 10:49-10:50 (UTC+3),
before this change, `grok-4.20-0309-non-reasoning`, one author message per collection:

| Collection | Steps | Prompt | Completion | Total | Result |
| --- | --- | --- | --- | --- | --- |
| `screen.site/home` + hero/split, features/grid2, cta/banner, about/split | 8 | 135,224 | 1,868 | 137,092 | page on another screen (`theme-marketing-landing/home`), host pruned 7 blocks |
| `grill-delivery` fixture (`screen.theme-food-grill/home` + 4 blocks) | 8 | 101,440 | 2,815 | 104,255 | 422 `propose_layout_rejected`, no page |

(Earlier run 2026-11-11 01:24 (UTC+3): 8 steps, 133,236 prompt, 135,210 total.) Every step re-sent the full Build
prompt (all 117 catalog sources, the search vocabulary, seven tool schemas, about 10k tokens) and the model spent the
budget on `search_catalog`, `get_block_details` and repeated `propose_layout` calls that the collection check rejected
(`outside_collection`, `collection_item_unused`, `unknown_variant`) until the host repair ran on the last step. The
collection's own screen may not render in this BuildY version yet (`screen_not_renderable`), and then the model had no
way out.

## Decision

1. **Draft before the model** (`collectionIntakeDraft`, builder-core `tools.ts`). For the first Build turn of a
   collection chat (no current page) the host assembles the page deterministically: the collection's first screen
   (else the chat screen; when none renders, the suggested screens and the renderable screens that carry the required
   blocks, scored by required items placed, then collection blocks), the required items on the blocks of their kind
   with their variants, the kinds whose every block is outside the collection in `remove`, then the prune bound. Each
   draft block carries `kind`, `catalogBlock`, `variant`, `defaultVariant`, `variants` (every allowed variant) and
   `required`. A screen switch is said in the draft notes and in the proposal warnings. No draft (nothing renders):
   the ordinary ADR 0019 loop runs.
2. **Compact intake turn** (`apps/xai-runtime/src/chat-tools.ts`): its own short system prompt, a user payload with the
   brief, the collection title and notes, the draft and `catalogSources` of the draft's catalog blocks only, no search
   vocabulary, no scenario seed; one tool (`propose_layout`), `tool_choice: auto` (a text answer still creates no
   proposal); budget 3 steps (`INTAKE_BUDGET`). Later turns of a collection chat (current page) keep the ordinary edit
   loop, with `catalogSources` limited to the collection's allowed blocks.
3. **Pre-placement of the model's call** (`placeCollectionDraft`): the draft screen when the model names none or one
   outside the collection's screens, the draft catalog block and variant on every entry of a draft kind that names
   none, the draft's `remove`. A catalog block outside the collection on a draft kind is put back to the draft block
   (copy kept, said in warnings). The model's own allowed variants are kept.
4. **Repair rounds capped.** In an intake turn a collection rejection is repaired by the host at once (the model had
   the allowed set up front): unused items placed, outside blocks pruned. An invalid variant still comes back once as
   `unknown_variant` with `fix.allowedVariants` and `defaultVariant` (now also for a named `catalogBlock`, not only for
   the screen's block); the same error again uses the catalog default (said in warnings). A repaired block that loses a
   required item's variant goes through the collection repair. If nothing assembled after the model tried, the host's
   draft is the page (said). The turn is never stuck.

## Consequences

- The page still holds only collection blocks; items without a renderer or without a slot are said, never replaced.
- Offline (scripted provider): the intake request (messages + tools) is about 14k characters vs about 40k for the
  ordinary Build request, and a bare `propose_layout` call is accepted in one step.
- Tests: `scripts/m4-api-tests/collection-intake.test.ts` (draft, pre-placement, one-step turn, prompt size, host repair
  at once, variant fix then default, required variant, text-only answer, current-page turn, unrenderable screen).

## Live measurement after the change

Filled in after the staging deploy (see below).

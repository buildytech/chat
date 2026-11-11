# ADR 0020: Ask page plans, Apply in Build, shared page context and honest reply text

Status: accepted (2026-11-11). Extends ADR 0011 (Ask / Build modes), ADR 0014 (inspector edits), ADR 0018 (partial
acceptance). Session schema 1.4.0 (ui8kit/contract `70d358a`).

## Context

The owner's session of 2026-11-10 (restaurant delivery promo landing, `screen.theme-marketing-landing/home`, 6 model
turns, about 158k prompt tokens):

1. Build created the page. Build "update only How it works" patched `block-steps`, but the reply said "Kept 4 blocks:
   nav, hero, cta, footer" (kinds, not blocks; the edited block was not named) inside fixed boilerplate ("Proposal
   ready ... Apply it ... Nothing is published. Edited the applied page.").
2. Build "now the Logo cloud block": the model called `propose_layout` on the current page with a `features` entry.
   The assembler matches blocks by kind; the page has six `features` blocks (logos, features, steps, stats,
   testimonials, faq), so it rewrote `block-features`, not `block-logos`, and the warnings said "Demo data removed at
   the author's request" (the model had sent `demoData: false`; the author asked for nothing of the kind). The owner
   then edited logos, features, stats and testimonials by hand (51 revisions).
3. Ask audited the page and, asked to rework it, listed variant swaps per block (navbar inline to inverse, hero
   screenshot to split, features cells4 to tilesMuted, steps to centered, stats image to cards, testimonials plain to
   grid3, faq list to twoColumns, cta band to split, footer to newsletter). Build "accepted, do as you proposed" never
   saw that text: it called `propose_layout` again, changed no variant (10,094 tokens).

So: Ask recommendations were prose Build never received; Build did not know about hand edits; the reply text did not
say what changed; blocks of one kind could not be told apart.

## Decision

**Build stays a pure assembler.** It does not read Ask prose and does not recognise acceptance phrases. The only path
from an Ask recommendation to the page is the author's explicit Apply in Build on the plan card. No Build to Ask
handoff in this change.

- **Ask page plan.** Ask gets a read-only tool `propose_plan` (agent-tools.v1.json, Ask mode only): page-patch/v1 ops
  (`set_variant`, `set`, `set_items`, `add`, `replace`, `remove`, `move`) on current page block ids, each with a short
  reason. The host checks every op alone through the same `editPage` gates as Build edits (page-spec slots, catalog
  variants, props schema) on the page the author has now (`checkPagePlan`, builder-core `page-plan.ts`): valid ops
  can be ticked; invalid ops stay as notes with the code and the allowed values (`unknown_variant`: the block's
  catalog variants). The tool reply gives the model the valid ids and the invalid ops once to fix. The plan rides on
  the Ask text reply; the browser checks it again against its own page (never trusted from the wire) and stores it on
  the message (session 1.4.0 `message.plan`). When an Ask answer names a current page block id but the model did not
  call `propose_plan` (seen live with the non-reasoning model), the loop sends one follow-up step with `tool_choice`
  forced to `propose_plan`; the first answer stays the reply and no further step runs when every op is valid. The
  host looks only at the model's own answer for block ids, never at the author's words. The Ask directory lists each
  block's `copyKeys`: when they include `headline`, that is the visible heading and `title` only names the block in
  the section list (a live plan set the hero `title` and the heading did not change).
- **Apply in Build** (plan card button, registry Checkbox per op): the chat switches to Build and the ticked valid ops
  run in order on the current edit base (`executePagePlan`), with no model call. An op that no longer applies (the
  author changed the page by hand since; `no_change`, a variant gate) is rejected with its reason and the others still
  apply (partial acceptance as in ADR 0018). The applied ops make one ordinary pending page-patch proposal
  (`origin: "ask-plan"`) the author applies or discards; the plan keeps each op's result and its status (`executed`,
  `partial`, `failed`). A swap of one catalog block for another (hero to `block.storehero`) is not a page-patch op and
  stays in the Ask text.
- **Shared page context.** Both modes get a compact page directory (`pageDirectory`: id, kind, title, catalog block,
  its catalog title when it differs, variant, heading, row count) and `manualEdits`: blocks the author edited by hand
  since the last model turn, counted from the chat's revision history (`manualEditsSince`, cause `edit`). Ask audits
  the page as it is; Build is told to leave those blocks alone unless the author names them.
- **Block references.** Authors and models name blocks by title, catalog block or catalog title (`Logo cloud` is
  `block.logos`). `resolveBlockRef` maps those to the page block id for plan ops and `edit_page` ops; the Build prompt
  carries `blockTitle` and says never to target by kind alone.
- **No re-assembly of the current page.** In the live Build loop, `propose_layout` on a current page without
  `newPage` and without another Stock screen is answered with `use_edit_page` and the block directory (one step, no
  page change), so the model edits the named block with `edit_page` instead of rewriting blocks by kind.
- **Honest reply text.** The proposal message text is generated from the proposal page against its base
  (`describePageChanges` + `changeReportText`): changed blocks by title and catalog block with what changed (variant
  from and to, copy, rows, title, catalog block), added, removed, moved, page fields, the count of unchanged blocks,
  and for plans the ops not applied with code and reason. The boilerplate ("Proposal ready ... Nothing is
  published", "Edited the applied page", "Kept N blocks" by kind) is gone; the status line and Apply / Discard show
  the state. The assembler's follow-up summary lists block ids (`Unchanged: ...`, `Edited ...`). "Demo data removed
  at the author's request" is replaced by `Demo rows removed from <ids> (propose_layout demoData=false)`, said only
  when rows or badges were actually removed.

## Consequences

- Session schema 1.4.0 (additive): `message.plan` (`plan`, `planOp`, `planItem`), `proposal.origin` `ask-plan`,
  `proposal.changes` lists block ids. Every 1.0.0 to 1.3.0 file validates unchanged.
- The accept step costs no tokens (before: 10,094 tokens for a turn that changed nothing asked for).
- Ask turns may spend one more step on `propose_plan` (forced when the answer recommends page changes without it); Ask prompts carry headings and row counts (a few hundred tokens).
- Tests: `scripts/m4-api-tests/ask-build-plan.test.ts` replays the owner's session (`fixtures-askbuild.ts`, structure
  only): plan check, Apply in Build without network, Logo cloud targeting, manual edits, reply text, demo warning.

## Addendum (2026-11-11): ops that change nothing

An op that would not change the page (`set_variant` to the variant the block has, `set` of the value it has, any op
whose result equals the page) is a no-op, not an error (owner decision t126u, Build improvement 2). `checkPagePlan`
gives it `valid: false` and `issue.code: "no_change"` (`PLAN_NOOP`, `isPlanNoop`); the plan card shows it as a muted
"Keep: already on the page." row (unticked, disabled, `data-noop`), never the red "Cannot apply", and the summary counts
it apart ("N changes, V can be applied, K already on the page"). Apply in Build gives no-ops (and ticked ops that became
no-ops since: a hand edit, an earlier op of the same plan) the result `skipped` with code `no_change`; they are not
counted as selected or rejected, so a plan whose other ops all applied is `executed`, and the reply text lists them on
one "Already on the page, kept" line. `compactPlanPayload` lists them as `unchanged`, not `invalid`, and
`planHasInvalid` ignores them, so the forced plan step does not ask the model to fix them. Session 1.4.0 already
allows this (`issue.code` and `result.code` are free strings, `skipped` is a result status): no schema change.

## Addendum (ADR 0023): replace by another catalog block

A plan op `replace {blockId, catalogBlock, variant?}` swaps a block for another Stock catalog block of the same kind in
the same place (hero -> storehero). It is checked like the other ops, carries the text the new block renders, names
the dropped fields on the card and in the reply, and runs in Apply in Build without a model call (session 1.5.0).

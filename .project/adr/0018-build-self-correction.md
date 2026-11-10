# ADR 0018: Build self-correction: no dead-end search, per-block rejections, partial acceptance, step budget

Status: accepted (2026-11-11). Build mode only. Supersedes nothing; extends ADR 0011 (agent tools) and ADR 0012
(catalog snapshot).

## Context

Session `session-6c405b10` (2026-11-10, landing, screen `screen.theme-marketing-landing/events`, skin sky,
`grok-4.20-0309-non-reasoning`): "landing for the New Year promo of the restaurant Shashlyk Mashlyk, grill dishes
delivered". 3 `search_catalog` + 5 `propose_layout`, all rejected `unknown_variant` at `layout.blocks[2].variant`;
98,602 tokens, 8 steps, no page.

Root cause (reproduced offline with the same screen):

1. A `propose_layout` block names a `kind` and optionally `catalogBlock` and `variant`. Without `catalogBlock` the
   host binds the kind to the screen's catalog block of that kind (`attachCatalogSources`). On the events screen kind
   `features` is `block.stats` (variants plain4, panel, stack, image, cards, icons, muted2, cardsCompact), but the model
   read the variants of `block.features` in `catalogSources` and sent `variant: "grid"` (a `block.features` /
   `block.pricing` variant). The check ran only after assembly, so the rejection said `block.stats has no variant grid`
   at `layout.blocks[2]` (the assembled index): a block the model never named, at an index that is not its input.
   The model retried other `block.features` variants until the budget was spent.
2. `search_catalog` facets are hard filters. The model searched `site=landing, industry=food` (+ q); the pinned
   catalog has no renderable landing screen with industry food, so every call returned `noFit` plus the whole
   vocabulary, and a fresh live run spent all 8 steps re-searching (`propose_layout_missing`, ~95k tokens).
3. The chat's Stock screens search box matched one lowercased substring against screen id, English title, subtitle,
   block labels and jobs, inside the scenario's filter: no Russian, no industry or facet labels, no multi-word
   queries ("новый год"), and a scenario hid every match outside it without saying so.

## Decision

All of it is program logic over catalog data (snapshot, search index, props schemas); no word lists.

- **search_catalog never dead-ends.** When no renderable screen matches every facet, the host drops the fewest
  facets (order industry, section, job, blocks, site), keeps `q`, returns those screens and `relaxed: {dropped, note}`.
  Zero or weak hits (≤ 1) and `browse: true` add `facets`: renderable screen counts per site, section, job, industry
  and block label, each counted with that facet left out (`facetTree`), so the model can drill down with another
  call. An unknown facet value returns its error with the facet tree of the valid rest of the filter.
- **Rejections name the caller's block and the allowed values.** `ModelBlockContent.at` keeps the index of the
  model's `propose_layout.blocks[i]`; rejection paths use it. A variant rejected after assembly is mapped back
  (`checkContentVariants`): `code unknown_variant`, `path blocks[i].variant`, message and `fix` = {blockIndex, kind,
  catalogBlock it renders as, rejected variant, allowedVariants, defaultVariant, catalogBlocksWithVariant (blocks of
  the same kind that have it)}. The runtime forwards `fix` to the model. Post-assembly messages also name the block id.
- **Repeated error on one block: default for that block, the rest accepted.** The same code on the same caller
  block twice runs the same call again without that block's choice (`repairProposeArgs`): variant omitted (the tool
  contract: no variant = the screen's own variant of that catalog block), catalogBlock omitted (the screen's block of
  that kind), or row icons outside the contract's Lucide enum removed. A warning names the block, the rejected value
  and what is used (`Used: block.stats/cards`). No extra provider step.
- **Partial acceptance at the end of the budget.** When the run ends with a rejected `propose_layout`, the host repairs
  up to 3 blocks the same way; a page is only accepted if it then passes every gate (page-spec, catalog provenance,
  props schema). Nothing is invented: every block still comes from the pinned screen.
- **Step budget, honest summary.** Every Build tool reply carries `budget {step, maxSteps, left}`; with ≤ 2 steps left
  it says the next call must be `propose_layout`. A run that still ends without a page says the budget was used up,
  lists the nearest renderable screens from the last search and the allowed variants of the last rejected block
  (catalog tokens only, no author text).
- **Stock search box in the chat** uses the catalog text index (`searchCatalog` with `q`: titles, labels, facet
  values in the catalog locales and synonyms, prefix match, word by word) plus the old substring hits; with an
  attached scenario and no hit it shows how many screens match outside the scenario and a Clear scenario action.

Not done: guessing a variant from another block, adding blocks the screen does not render, hard-coded synonyms.

## Next (not in this change)

Ask handoff: when the budget is spent or there is a real fork (e.g. no renderable screen for the industry), switch to
Ask with the gathered context and 2-3 options; the author's choice returns to Build.

## Consequences

- Live (same prompt, local runtime against xAI, 2026-11-11): before 0/2 pages (8 search_catalog each, ~95k tokens);
  after 3/3 pages, 2 `propose_layout` calls, 3 steps, 33-35k tokens (an intermediate build without the icon repair:
  2/3, the third spent 8 steps on row icons outside the Lucide enum).
- Catalog gaps stay visible in `unrenderable` / `relaxed`: they are fixed in CodeGen-X Stock, not here.

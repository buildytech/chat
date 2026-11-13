# ADR 0036: Inspector coverage manifest and the `buildy` label of Stock

Status: accepted, 2026-11-13. Owner approval: t166u (the label in codegen-x/ui8kit apps/stock).

## Context

The manual builder (Blocks, Sections, Inspector) should offer first the blocks it can author end to end, so an author never
meets a prop the Inspector shows read-only or rejects. The registry publishes the props schemas; what the Inspector can
edit is BuildY's own fact, so BuildY computes it and Stock only carries the result as a label.

## Decision

- `scripts/inspector-coverage.mjs` (`npm run inspector:coverage`, `inspector:coverage:check`) writes
  `catalog/inspector-coverage.json`, keyed `item/variant`. Method: add the block as the Blocks "+" adds it (sample props of
  the variant), give every list two rows and write every field of `inspectorModel`, all through `applyOp` (`list_row add`,
  `set`: the operations of the Inspector, so the same gate and props schema), render with the compiled registry blocks
  (`api/runtime/_render/blocks.mjs`) and require visible content. `covered` = no unsupported field, no rejected operation,
  filled render shows content.
- The file is stable (sorted keys, no dates) and pinned by digest to the props schemas, the registry pin and the Inspector
  sources (`inputs`). It lists per combination the counts (`leaves`, `editable`, `locked`) and `unsupported[{path, reason,
  fixable}]`. `fixable` marks gaps a small Inspector change closes (non-string enum values, an absent optional object, an
  absent optional list); the summary reports how many combinations that would add (`coveredAfterFixes`).
- Coverage is what the Inspector does now: the script never fixes the Inspector, and a later Inspector change is a new run
  of the script (the check fails while the committed file is stale).
- Stock receives only the list of covered combinations (label `buildy`), generated from this manifest.

## Consequences

Closing a gap in the Inspector raises coverage by regeneration, not by editing a list. The label says "fully authorable in
the BuildY Inspector", nothing about design quality.

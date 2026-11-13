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
  fixable}]`. `fixable` marks gaps a small Inspector change closes (report only; none is open after the addendum below).
- Coverage is what the Inspector does now: the script never fixes the Inspector, and a later Inspector change is a new run
  of the script (the check fails while the committed file is stale).
- Stock receives only the list of covered combinations (label `buildy`), generated from this manifest.

## Consequences

Closing a gap in the Inspector raises coverage by regeneration, not by editing a list. The label says "fully authorable in
the BuildY Inspector", nothing about design quality.

## Addendum: the four Inspector widgets (2026-11-14)

The gaps the first run found are closed, one commit each, and the manifest was regenerated after each:

| Step | Change | Covered combinations |
|---|---|---|
| start | (manual Inspector as of `b41d866`) | 287 / 532 |
| 1 | typed enum values: `level` is 1 \| 2; the select carries the schema's type (`inspectorValue`), `set` coerces text to an enum member (`coerceEnumValue`) | 357 |
| 2 | absent optional object / list: `set` creates the objects above the path, `list_row add` creates the list; an emptied optional list or object goes away; trusted markup (`{ __html }`) is read-only | 426 |
| 3 | `values` widget: list of plain values (add, edit, move, remove, 24 entries at most); `list_row` works on them | 495 |
| 4 | `map` widget: free-form map of plain values (add, rename, remove, edit); the new `map_entry` operation; keys checked | 526 |

What stays out: `rich-text` (6 variants). Its `content` and `aside.content` are trusted markup (`{ __html }`); the page
contract does not let a page carry markup, so no widget can write it. That is the contract's boundary, not an Inspector gap.

Contract limits the widgets respect (they do not change them): a map key is a letter then letters, digits or `_`, 48 at most
(`propertyNames` of the page schema, `PAGE_KEY_PATTERN`, test-pinned to the schema file), and a list holds 24 entries at most.
The props the export emits are unchanged; one behaviour differs: taking away the last row of an optional list now leaves the
list absent instead of `[]`.

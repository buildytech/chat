# ADR 0014: Build inspector: canvas identity, schema fields, validated write-back, local history

- Status: Accepted
- Date: 2026-11-10
- Extends: [0008](0008-registry-single-source-of-ui.md) (registry is the only UI), [0010](0010-props-schemas-program-gate.md) (props gate), [0011](0011-ask-build-modes-shared-agent-tools.md) (Ask / Build)
- Owner: delegated 2026-11-10 (full control over schemas, entities, contracts and fields in Build mode)

## Context

Build changed a page only through chat proposals. The block tree existed but was not mounted, the selected block was
outlined inside the page (so the outline stayed in clean mode), and there was no way to see or edit the fields of a
block. WP FastY Builder has the mechanics worth keeping (block wrapper id, editor chrome drawn over the frame, a
widget per field type, override-only writes, coalesced undo, re-render of the changed block), but its fields come
from TypeScript strings in `catalog.json` and it validates only on save, in PHP, against the variant sample.

## Decision

1. **Canvas identity, chrome outside the page.** Every page block in the preview is wrapped with
   `data-block-id` = `PageBlock.id`. Hover and selection outlines and the block label are drawn by the chat in the
   parent document (`CanvasOverlay`) over the iframe: rects come from `getBoundingClientRect` in the frame, mapped by
   the frame scale, and are remeasured on frame scroll, resize and every render. The page DOM stays the registry
   output. Clean mode (Settings "Hide service labels") mounts no overlay; `/preview` has none. The block tree is
   mounted next to the canvas in Build and is synced with it (hover, select, bring into view).
2. **Fields come from the pinned schema only.** The inspector lists the props of the selected block's registry item
   from `registry/props.v0.json` (`propsFieldTree`); values are the merged render props of `organismFor(block)`.
   Widgets are registry components: Input, Textarea, Select, Checkbox, an icon field checked against the contract's
   Lucide enum, an object group and a list repeater. `id`, `class`, events and slots are hidden. A field is editable
   only when it maps back to a page-spec field (`origins` of `organismFor`, plus the copy slots the page kind
   renders); every other field shows its value read-only with where it comes from (the variant). A block without a
   registry item or schema shows an honest stub, no invented fields.
3. **Validated write-back, no proposal.** A field write goes to its page-spec origin (override only: the variant and
   the schema defaults are never copied into the page), then the page is gated by `parsePageSpec` and the props gate
   of that block (Ajv 2020, fail closed). A rejected value keeps the page as it was and the field shows the pointer
   and the allowed values. Unchanged blocks keep their object identity, so only the changed block re-renders.
   Typing in one field is one history step, sealed on blur; Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z and Ctrl+Y redo.
   Writes persist like any page edit (the pending proposal when there is one, else the applied page with the next
   revision); the chat sees them on its next turn.
4. **Block operations through page-patch.** Variant (`set_variant`), reset to the Stock sample of the variant
   (`replace`), move and remove run through `editPage` (page-patch/v1 and the catalog provenance gate); duplicate
   and row duplicate / remove are local tree operations under the same gates. All are undoable steps.

Out of scope: field-level highlight inside a block (`data-slot`), WP-style data bindings, adding new blocks from the
inspector (the chat does that).

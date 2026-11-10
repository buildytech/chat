# ADR 0021: Field-level selection through the registry viewMap and generated `data-slot`

Status: accepted (2026-11-11). Issue: alexy-os/chaosbun#149.

## Context

The Build inspector (ADR 0014) selects a whole block. To edit one field the user had to find its input in the
inspector by hand, and a focused input did not show which part of the preview it changes. Marking fields in the
exported code (`data-prop="/title"`) was rejected: the ZIP must stay 1:1 with `npx ui8kit add`, and prop pointers are
an authoring concern, not part of the markup a project owns.

## Decision

- codegen-x generates `data-slot` (never `data-testid`) on every block root and on every list row, and turns every
  former `data-testid` into a `data-slot` of the same name. Elements whose component already owns a styling slot
  (`button`, `badge`, `card`, `alert`, `icon`) keep it. The names come from the specs; nothing in a block is written
  by hand.
- Each item in the registry's `props/v0.json` carries a generated `viewMap`, derived statically from the view IR:
  `rows` (list pointer -> the slot path of its rows) and `fields` (prop pointer -> places: the slots the place is
  inside, its own slot, and whether the value shows as text, HTML, an attribute or an icon). Pointers write `[]` for a
  list index (`/features/[]/title`).
- The chat pins `viewMap` into `catalog/props.json` with the rest of the props index. builder-core's `view-map.ts`
  resolves a pointer to an element of a rendered block (scope by rows, candidates by slots, confirmed by the rendered
  value) and an element back to a pointer. It works on any `{children, textContent, getAttribute}` tree, so it is
  unit-tested without a DOM.
- In Build mode a click in the preview selects the block, highlights the field it hit and focuses that field's
  inspector input; focusing an inspector input highlights its field in the preview and scrolls it into view. The
  highlight is a canvas overlay box (`data-slot="canvas-field"`), drawn outside the block.
- With the inspector collapsed or its sheet closed (ADR 0017) a preview click selects the block and outlines the
  field; the input is focused once the inspector shows it. The field outline is a 2px dashed `outline-primary` box with
  no label, to keep the compact IDE canvas quiet.
- Preview-only attributes stay in the `PreviewBlock` wrapper. The exported code and the ZIP do not change.

## Consequences

- A block with no `viewMap` (an older registry pin) still selects as a whole block; field selection is additive.
- Field selection required adopting the codegen-x `ce2a9b90` registry into the chat (the unified catalog snapshot,
  ADR 0012): `data-slot` on every block root and row in `registry/svelte`, and the `viewMap` in the props index.
- A field rendered only through a computed value or a branch the current props do not take has no element; the
  inspector input still works, the preview just shows no field highlight.
- Blocks rooted in a shared frame (`SectionFrame`, `PanelSection`) carry the frame's root slot (`section-frame`,
  `panel-section`), not the registry item name; naming them would need a new frame prop.

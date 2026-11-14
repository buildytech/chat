# ADR 0037: Free page composition: no position or count rule for header and footer

Status: accepted, 2026-11-14. Owner decision: t178u, t179u. Amends ADR 0024 (slot rules, `addSlotCheck` / `moveSlotCheck`
refusals), ADR 0027 (hard rules list) and ADR 0034 (hard rules list, host checks `header_not_first`, `footer_not_last`).

## Context

Until now the host kept header-like items (registry role `nav`, `sidenav`) in the leading run of a page and footer-like items
(`footer`, `bottomnav`) in the trailing run, one of each: the gate answered `header_not_first` / `footer_not_last`, the add and
move operations refused `above_header`, `below_footer`, `header_top`, `footer_end`, `edge_item`, and a screen dropped on a page
skipped its second header or footer. Real pages need more: an announcement banner above the header, a header per language or
audience, a footer in the middle of a long page. The role of a block is registry metadata, not a layout law.

## Decision

- No position or count rule for header-like and footer-like items, anywhere: not in the gate, not in the operations, not in
  drag and drop, not in the agent prompt. A page holds any number of them at any slot.
- The only structural check left on a slot is that it exists (`index_out_of_range`).
- The role stays as information: `itemInfo(item).role` (`"header" | "footer" | null`, was `edge: "top" | "bottom"`), the `; header`
  / `; footer` marks of the agent's item index and the Blocks feed role label. Nothing is refused because of it.
- `addScreen` adds every renderable section of the screen at the slot, in the screen's order (header and footer included);
  `skipped` lists only the sections this version cannot render.
- `naturalIndex` is a default for an add without a slot, never a rule: a header-like item at the start, a footer-like one at the
  end, any other section before the footers that close the page. An explicit slot (`at`, a drop, a move, a patch) is always honoured.
- `duplicate` works on every block.
- Contract: ui8kit/contract page-spec 2.0.2 removes `header_not_first` and `footer_not_last` from `x-host-checks`
  (`PAGE_HOST_CHECKS_V2`); the vendored `packages/page-contract/schema/page-spec-v2.schema.json` follows. Every 2.0.x document
  validates unchanged, the page document itself did not change, and the export emits exactly the props as before.

## Consequences

- i18n: the four refusal strings `dnd.why.above_header|below_footer|header_top|footer_end` are removed (en and ru);
  `dnd.why.index_out_of_range` stays.
- The agent may write a page with a banner above the header or a footer in the middle; the host no longer pushes headers and
  footers back to the edges. A page with two headers is the author's decision.
- Risk: the preview / export render what is written, so a footer in the middle is a footer in the middle. Nothing here changes
  how a single block renders.
- Tests: `page-ops.test.ts` (slots, free composition, screen drop), `page-doc.test.ts` (the gate raises neither code),
  `catalog-snapshot.test.ts`, `catalog-search.test.ts` (a screen twice is valid).

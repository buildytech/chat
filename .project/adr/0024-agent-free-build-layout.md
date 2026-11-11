# ADR 0024: Agent-free Build layout: left panel tabs, Blocks feed, one shared Stock search

Status: accepted (2026-11-11), step A shipped. Owner approval: t137u with the layout widget. Supersedes the column
part of ADR 0017 (nav | chat | preview | inspector) for Build; ADR 0017's splitters, rails, shortcuts and prefs stay.

## Context

Build was three columns (chat | preview | inspector) and every page change except inspector edits went through a
model turn. The owner wants to assemble a page without the agent: browse the Stock catalog, add a block, reorder,
edit, undo, with the chat as one tool among others, in a window 1024px wide. The home Stock screens field and any new
catalog browser must not drift apart: one search function and one response format, reusable by a later REST, MCP or
CLI endpoint.

## Decision

The plan has four steps: A feed and filters, B sortable Sections, C drag into the preview, D inspector slide-over.
Step A is this change.

- **Two areas.** Left panel (the former chat column: same id, width range 264-520px with default 320px, splitter,
  rail, Ctrl+B) | preview. The panel has three tabs (WAI-ARIA tablist): **Blocks** (the feed), **Sections** (the
  existing page outline, `BlockTree`; step B makes it sortable), **Chat** (the unchanged thread and composer). Inactive
  panels stay mounted with the native `hidden` attribute, so a chat draft, scroll position and running turn survive
  a tab switch. Below 1024px the panel is the existing Chat surface tab of the shell.
- **Inspector.** No longer a column at any width (`creatorLayout.inspectorColumn` is false): the existing registry
  `Sheet` opens over the preview only (absolute inside the workspace section, so the left panel stays usable), from
  the head button and Ctrl+I. Step D replaces it with the designed slide-over.
- **One Stock search: `stockSearch` (builder-core `catalog/stock-search.ts`), format `stock-search/v1`.** Pure, JSON
  in and out, data = the pinned catalog snapshot only. Query: `q`, `type` (block | screen), `role` (page kind a block
  renders as, or the kinds a screen contains), `spec` (block spec or screen family), `site`, `variant` (of `spec`),
  `scope` (an owner filter that narrows screens, e.g. the picked scenario), `page`, `pageSize` (1-48). Result: the
  normalized query, page / pageSize / pageCount / total, items (`type, id, spec, variant, title, subtitle, role, roles,
  sites, isDefault, thumb` = absolute WebP URL or null, `url` = codegen-x asset page) and facet counts per filter, each
  counted with the other filters applied and its own left out. Screens keep the catalog text index (synonyms,
  locales) plus substring hits, as the home field did; blocks match every query word in spec, title, variant, role,
  jobs and sites, and blocks with a page section renderer come first. The home Stock field calls it with
  `type: "screen"` and the scenario as `scope`; the feed calls it with its filters. A server endpoint can wrap it
  unchanged (`stockSearch(JSON.parse(body))`).
- **Feed view.** 8 results per page in both views: 8 rows in one column, 4 rows in two. The view and the open tab
  persist in `buildy:v1:feed` = `{ tab, columns }` (unknown values fall back to Chat and one column). Cards: Stock
  thumbnail (`StockThumb`), title, `spec/variant`, a link to the asset page, and "+" on block cards.
- **"+" is an inspector operation, not a chat turn.** `InspectorOp` gains `add {blockId, catalogBlock, variant?}`:
  the Stock sample of the block variant for the page's Stock screen family (the assembler's `stockBlockFor`, then the
  ADR 0023 catalog swap for another catalog block of the same kind), fresh unique ids, inserted after the selected
  section (a selected row counts as its section) or at the end, then the inspector gate (page-spec schema and program
  checks, props gate on the new block, catalog provenance gate). One undo step, the new section is selected and
  scrolled into view, zero model calls. `canAddCatalogBlock` gives the reason a card's "+" is disabled: no page yet,
  no Stock screen, no page renderer for that block, the screen family has no such section, unknown variant.
- **No contract change.** The page already allows several sections of a kind (duplicate does it); `add` is a host
  operation of the inspector like duplicate and reset, so page-patch/v1 (the model's op language, whose `add` keeps
  one section per kind) and the page-spec, session and collection schemas are unchanged.

## Consequences

- The chat column's horizontal space now serves three tools; the preview keeps the rest (no inspector column).
- Editing fields needs one click more (open the inspector) until step D.
- Only 34 of 112 Stock block specs have a page section renderer today; the other cards link to Stock but cannot be
  added, and say so. Adding needs a page with a recorded Stock screen: an empty chat still starts with a Build turn
  (a screen card "start a page from this screen" without the model is a candidate for step B).
- Added sections carry the Stock sample copy; on a non-English page that copy stays in the catalog language until
  edited.

## Addendum: step B (Sections tab, start a page from a screen)

- **Sections tab = the page's sortable section list.** `SectionsList` replaces the read-only outline in the left
  panel: one row per top-level section in page order with its Stock WebP thumbnail, title and `spec/variant`.
  Reorder three ways, all one `move` inspector operation: drag the grip handle (pointer capture; the row border shows
  where it lands; `dropIndex` in `lib/feed/sections.ts`), the up / down buttons, or Alt+Arrow Up / Down on a focused
  row (plain arrows / Home / End move the focus). Each move is announced in an assertive live region ("Hero moved to
  position 3 of 8") and the focus stays on the moved row. Remove is the `remove` op; the selected row shows a variant
  select that runs `set_variant` (the same catalog swap and gates as the inspector). Undo / redo buttons sit in the
  tab header (Ctrl+Z / Ctrl+Shift+Z still work). Every action is an inspector operation: page-spec and props gates,
  one undo step, zero model calls; a rejected one shows its reason under the header.
- **Selection is shared.** A row click selects the section in the page store and reveals it in the preview; a pick
  in the preview (a section or one of its rows) highlights its section row and scrolls it into view
  (`topLevelBlockId`). Rows (children) are edited in the inspector, not reordered here.
- **"Start page from this screen".** Screen cards in the Blocks feed get a start button. `stockScreenDraft`
  (builder-core, next to `collectionIntakeDraft`) runs the same program `propose_layout` assembly as the collection
  intake draft, with no copy and no model step, so every block keeps its Stock sample. The browser takes the result
  as an ordinary proposal (client catalog gate, change report, no `origin`; see the step D correction) and applies it at once as
  the next revision; a chat that already has messages or a page gets a new chat, so nothing is overwritten.
- **`supported` in stock-search/v1.** Each item says whether this BuildY renders it: a block variant with a page
  renderer, or a screen the draft path accepts (`screenStartable`, the screen check of `propose_layout` with the
  screen's own scenario). The flag is additive (old readers ignore it); a test keeps it equal to the draft result for
  every Stock screen. Today 15 of 80 screens can start a page; the others stay listed with the reason.
- **No contract change.** The page, session and collection schemas are unchanged.

## Addendum: step C (drag feed cards into the preview and the Sections list)

- **Native drag from block cards, a host drop layer over the preview.** Block cards in the Blocks feed are
  draggable (HTML drag and drop, `application/x-buildy-block`); the dragged card and its add check live in a small
  store (`lib/feed/drag.svelte.ts`), because DataTransfer data is unreadable during dragover. Drag events never
  cross into the preview iframe document, so while a card is dragged `DropOverlay` (in the chat document, the same
  stage as the canvas overlay, same top-left corner and scale) covers the frame and takes the drag. It measures the
  page's top-level sections in the frame, draws the insertion line in the gap between two sections (or at the top
  of the first / bottom of the last; `insertionSlot`) with "Insert at position N", and scrolls the frame while the
  pointer rests near its top or bottom edge. Nothing is inserted into the page DOM.
- **A drop is the "+" operation at a slot.** The inspector `add` op gains `at` (top-level slot 0..sections): the
  same Stock sample, fresh ids and gates as "+", one undo step, the new section selected and revealed, zero model
  calls. `addSlotCheck` (builder-core, pure) says which slots a kind may take: content between the leading header
  run (nav, sidenav) and the trailing footer run (footer, bottomnav); a header only in the leading run, a footer only
  in the trailing one.
- **Refusals are visible.** A card the page cannot take (same reasons as a disabled "+") or a slot it may not take
  turns the line and label red with the reason; the drop is still received and answered in the feed status line
  ("Not dropped: Sections go below the header."), so the page never changes silently or by accident.
- **Sections list as a drop target.** Resting a drag on the Sections tab opens it (400 ms); the list then shows the
  insertion line on the row border and drops through the same op, announced in its live region. "+" remains the
  keyboard and assistive-technology path; drag is an extra, never the only way.
- **No contract change.** `at` is a host inspector operation field; page-spec, page-patch, session and collection
  schemas are unchanged.

## Addendum: step D (inspector slide-over, position rules for moves)

- **The inspector is a slide-over, not a column or a sheet.** `InspectorSlideOver` sits on the right edge of the
  preview (absolute in the Build editor, fixed 320px, `max-w-full`), so at 1024px about 330px of the preview stays
  visible beside it; there is no backdrop and no dimming. It is a complementary landmark (`aside`, labelled by its
  heading "Inspector: <section>"), non-modal: the left panel (Blocks, Sections, Chat) stays fully usable while it is
  open. The old column (`InspectorColumn`) and its Layers tree (`BlockTree`) are removed: Sections is the outline.
- **Opens where you pick, no extra click.** A click on a section in the preview selects it and opens the panel on
  it; a click on a field also focuses that field's control (retried for a few frames while a newly opened panel
  renders). A Sections row click opens it on that section and keeps focus on the row. Adds and drops do not open it.
  Escape (unless something else handled the key) and the close button close it; focus goes back to where it was if
  focus was in the panel. Ctrl+I and the head button toggle it. The open state is remembered in the Build panel prefs
  (`buildy:v1:feed` gains `inspector`). Field editing, row duplicate / remove, validation and undo are unchanged
  (`InspectorPanel`).
- **Moves follow the same position rules as adds.** `moveSlotCheck` (builder-core) checks a section's final index
  as a slot among the other sections with `addSlotCheck`, and the inspector `move` op refuses with its code: the
  header stays in the leading run, the footer in the trailing one, content between them. The Sections buttons,
  Alt+Arrow, the pointer drag (red indicator and the reason while dragging) and the inspector's up / down all run it,
  and every refusal reads the same localized reason as a refused drop. The model's page-patch `move` (chat
  proposals) is not changed by this step.
- **Sections drops show where.** A feed card over the Sections list shows "Insert at position N" (or the reason, in
  red) on the row border where it lands, like the preview drop line.

### Step D correction: screen-start chats survived a reload only in the same tab

Step B tagged the started proposal `origin: "feed-screen"`, but the session schema allows only `ask-card` and
`ask-plan`. The value lived in the tab; on the next load the chat failed `session.schema.json` and went to
quarantine (the live step D check at 1024 showed "Some saved data did not pass the session schema"). The proposal now
carries no `origin` (it is an ordinary program proposal: local catalog assembler, no run record), and
`loadSessionsJson` repairs chats saved during the window (`repairSession` drops that one value before validation and
writes the list back), so they load instead of being quarantined. Chats already moved to quarantine on staging stay
there (`buildy:v1:quarantine`, raw kept). Tests: a screen-start session validates and survives a reload; a chat with
the retired origin is repaired, other origins are left alone.

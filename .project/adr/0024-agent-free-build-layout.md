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
  as an ordinary proposal (client catalog gate, change report, `origin: "feed-screen"`) and applies it at once as
  the next revision; a chat that already has messages or a page gets a new chat, so nothing is overwritten.
- **`supported` in stock-search/v1.** Each item says whether this BuildY renders it: a block variant with a page
  renderer, or a screen the draft path accepts (`screenStartable`, the screen check of `propose_layout` with the
  screen's own scenario). The flag is additive (old readers ignore it); a test keeps it equal to the draft result for
  every Stock screen. Today 15 of 80 screens can start a page; the others stay listed with the reason.
- **No contract change.** The page, session and collection schemas are unchanged; the proposal `origin` is a chat
  app field.

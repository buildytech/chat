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

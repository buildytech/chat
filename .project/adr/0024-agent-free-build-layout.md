# ADR 0024: Agent-free Build layout: left panel tabs, Blocks feed, one shared Stock search

Status: accepted (2026-11-11), step A shipped. Owner approval: t137u with the layout widget. Supersedes the column
part of ADR 0017 (nav | chat | preview | inspector) for Build; ADR 0017's splitters, rails, shortcuts and prefs stay.
Amended 2026-11-14: the slot / position rules of this ADR (`addSlotCheck` / `moveSlotCheck` refusals, header first, footer last, one each) are removed by ADR 0037.

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

## Addendum: empty start, optional header and footer, Stock cards (owner feedback 2026-11-11)

The owner hit "No page yet: start one from a screen card, or build it in the Chat tab." on his first drop: Build
should start on Blocks, and header and footer must be optional (many promos have no navbar and start with Hero).

- **Build opens on Blocks.** The default left tab is Blocks (`defaultFeedPrefs`). A chat that opens lands on
  `landingTab(remembered, { hasPage, hasMessages })`: an empty chat always on Blocks, a remembered Sections without a
  page on Blocks, else the remembered tab. Landing is a view state (`feed.land`) and never overwrites the author's
  remembered choice; a chat created in this tab (first message, first block) keeps the tab the author works in.
- **Empty start, no contract change.** page-spec already allows `layout.blocks: []`, the provenance `screenId` is
  nullable, and `validateCatalogProvenance` passes an empty page on any screen; the session schema needs nothing new.
  What an empty page lacks is its renderer context: blocks are Stock samples of the page's screen family, and the
  catalog gate checks every later block against it. So the first block picks the screen: `emptyPageScreenFor(kind)`
  takes the first of `EMPTY_PAGE_SCREENS` (marketing landing, food grill, restaurant house, dashboard console) whose
  family has the kind; `emptyPageStart` makes the empty page (title "New page", slug `home`, page locale, provenance
  `assembler: "empty-page"`, scenario landing or dashboard). The skin stays the chat's (default theme when none), as
  for any page. `canAddCatalogBlock` with no page (or an empty page without a screen) returns `ok` with
  `startScreenId` instead of the old `no_page` refusal; a kind no start family has is `no_start_screen`.
- **One undo step, no model call.** `inspector.add` starts the page first (`startEmptyPageInChat`: the selected chat,
  or a new one, gets the empty page as the applied page at revision 0 with no history entry, no chat message), then
  runs the ordinary add op on it; the add is revision 1 and the one undo step, so undo goes back to the empty page
  (the preview shows the drop zone again), redo forward. The page persists like any page (reload keeps it).
- **Empty preview is a drop zone.** An empty page (or none yet) shows "Drag a block here or press +" with a note that
  no header or footer is required; while a card is dragged the zone lights up (`drop-empty`) and the label says
  "Insert at position 1". The drop layer now also works with service labels hidden.
- **Header and footer optional everywhere.** Nothing in the program required them: the add / move rules already
  counted the leading header run and the trailing footer run from zero, so with neither present any order is
  valid; a header that is added must go first and a footer last (with the same refusal reasons). Tests pin it: a
  page of hero, features, CTA passes page-spec, props and catalog gates; a Chat follow-up and an Ask plan op on it
  put no header back; a new page from a screen may drop header and footer (`content.remove`) and starts with Hero;
  the ZIP and the `npx ui8kit add` list of a headerless page carry only its sections and the unzipped project
  builds with vite; an empty page packs to a compiling project.
- **Copy.** `feed.why.no_page` is removed; new en / ru keys `preview.emptyDrop`, `preview.emptyHint`,
  `page.untitled`, `feed.why.no_start_screen`; `sections.empty` points to "+" and drag.
- **Stock cards (owner, same day).** `StockMediaCard` is the one card frame of the Blocks feed and the home Stock
  screens: the WebP thumbnail is full-bleed (no padding around it; the card's radius and `overflow-hidden` clip it,
  a 1px divider separates it from the body), on top in the stacked layout or on the left edge in the feed's one-column
  layout; only the body is padded (8px). `StockThumb` gets `bleed` for that; the Ask block cards use it too. The home
  Stock screens drop the 3-column cards with wrapping titles and long ids for the feed card in the same 2-column grid
  (`gap-2`): title row with actions (open in Stock, attach), the screen id on one truncated line, the subtitle, the
  missing-renderer note. Row thumbnails in lists (Sections rows, collection chips, catalog refs) are not card media
  and keep their small framed thumbnail.
- **Open.** The start screens are a fixed list: a kind outside them (e.g. `hours`) cannot start a page; Ask "apply
  variant" with no page still asks for a page first.

## Addendum: inspector P0, honest locks (diagnosis t140u, 2026-11-11)

The owner's Hero (hero-split / miniCards) showed fields that were greyed out and others that looked live but took
no typing. Not a regression from steps A-D (the model is the same before 09d1031, since ADR 0014 step 2): the page
kind `hero` holds only title, summary and a few copy keys, so most props of the registry block have no page field;
variant axes were always disabled; read-only text inputs had the live style. P0 fixes what the chat can fix alone,
without a contract change (the props override map and history op / path are a separate step).

- **Locked looks locked.** A field without a page origin renders muted (`bg-muted text-muted-foreground`),
  `cursor-not-allowed`, `aria-readonly="true"`, with a lock icon and "Locked" above it and the reason as its hint
  and title. `data-locked` names the reason for tests.
- **Three real reasons.** `InspectorField.lock` (builder-core): `variant` (a variant axis or a value the variant
  preset sets, e.g. `actions.mode`), `sample` (a placeholder the props schema fills in: the miniCards card "Title" /
  "Text" / `circle-dot`, `content.proof`), `no_page_field` (the page has no field for it yet: secondary action,
  `landmarkLabel`, `level`, row links). en + ru hints; the old "Set by the variant" text no longer covers schema
  placeholders.
- **Axis selects switch variants.** Each top-level enum the variant presets set gets `choices`: per value, the named
  catalog variant whose preset equals the current one with only that axis changed (`hero-classic` scale display ->
  `display`). The select is live when another value has a named variant; it runs the ordinary `set_variant` op
  (every gate, one undo step); values with no named variant are disabled options. With none it stays disabled with
  "Choose in Variant above".
- **Mapped but empty fields unlock.** `writableOrigin` now mirrors the read mapping for empty values: the block's
  title / lead (`copy.lede` where the kind renders it, else summary), the empty state while there are no rows, the
  label and link of the action object (`/action/label` -> `copy.action`, `/action/href` -> `copy.href`), labels
  brand / empty, copy-key objects, and row title / text / icon / link where the row kind renders that field.
- **Links say why.** A `copy.href` value outside the page-spec pattern fails before the gate with `link_invalid`; the
  field shows "\"...\" is not a link. Start it with #, /, http://, https:// or mailto:" (en / ru).
- **Eyebrow.** No registry block has an `eyebrow` / `kicker` / `overline` prop today, so the hero eyebrow is not
  mapped; the inspector lists copy keys of the page kind that the block does not show (`InspectorModel.unshown`)
  as locked "Not shown by this block" rows instead of dropping them silently.
- **Open.** Free edits of the other props (content lists, the card, the secondary action) need the page-spec
  `props` override map; history entries still carry only the block id (op / path come with the contract bump).

### Addendum: inspector P1, block props overrides and history op / path (2026-11-11)

The owner chose (widget, 2026-11-11) to make every field of a registry block editable and to record what each history
step did. Contract first: ui8kit/contract fa09858 (page-spec 1.3.0, session 1.6.0), vendored here (schema:check).

- **`block.props` (page-spec 1.3.0).** An optional map on top-level blocks: JSON Pointer into the item's
  `props/v0.json` -> value (string / number / boolean / null / list / object, limits in `PAGE_PROPS_LIMITS`). The
  schema checks the shape; the program checks values against the item's props schema (`props_invalid`, unknown
  pointers included). Old pages stay valid.
- **Copy slots still win.** `inspectorSetField` writes the page-spec copy slot when one maps the field (and drops an
  override at the same pointer); otherwise it writes `block.props[pointer]`, coerced to the schema type, links
  checked like `copy.href`, enum values listed on rejection. Overrides never overlap: a list is overridden whole at
  its pointer, a write under an overridden list or object updates that entry.
- **Render = export.** `organismFor` merges preset + page content and then applies the overrides, so the preview,
  the code pane and the ZIP sections pass exactly the same props.
- **Lists.** `list_row` (add / remove / up / down) works on page rows (children, row overrides follow their row,
  removed rows take theirs along) and on props lists (the new row is the schema's sample row, the list is written
  whole). The UI has add, move up / down and remove per row.
- **Variant axes.** A select value with a named variant still switches to it (set_variant); any other value is an
  override. `set_variant` (inspector or model patch) drops axis overrides and pointers the new variant has not, and
  names them (`dropped`, patch warning). Replace with another catalog block keeps compatible overrides and lists the
  rest as `props /pointer` among the dropped fields. A Chat / Ask proposal that rebuilds the current page carries
  the overrides by block id (`carryPropsOverrides`), naming what it could not carry.
- **History (session 1.6.0).** Inspector results carry `op` (set_field, set_variant, add, move, remove, insert,
  replace) and `path` (the pointer; no values). `replaceVisiblePage(..., meta)` -> revision event -> session file
  entry. Typing coalesced into one step records the first keystroke's op / path.
- **UI.** Fields written to props show where their value comes from until overridden (variant preset, schema
  placeholder, unset) and "Your value, saved in the section's props" after; en + ru.
- **Stable groups.** Live verify found that the first character typed into an empty field under "More" moved the
  field to the main group, remounted the control and dropped the rest of the typing. A field now keeps the group it
  was first shown in while its block stays selected.

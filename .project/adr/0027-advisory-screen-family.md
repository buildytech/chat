# ADR 0027: The screen family is advisory; feed availability is a property of the card

Status: accepted (2026-11-11). Owner bug t147u, design t149u, bug t150u.

## Context

ADR 0024 empty start put the first section of a page on a default Stock screen picked by the block's kind (Activity:
the dashboard console). Every later add, replace and the catalog provenance gate then checked the kind against that
screen's family: on a page started with Activity, CTA was refused ("Not dropped: The page's Stock screen family has no
cta section"). The owner's rules: blocks are universal by role, header and footer are optional, and a screen family must
never forbid a registry block that has a renderer.

In the Blocks feed Screens view only the first result page could be started: after Next, Start page was disabled, and
screen cards could not be dragged into the preview at all.

## Decision

1. The family never rejects a block. The hard rules are the only ones: a header goes at the top and a footer at the end
   when present (addSlotCheck / moveSlotCheck), the catalog block has a page renderer for its variant, page-spec and
   the props schema pass. A kind the page's screen has no block for takes its Stock sample from the first family that
   has it (`kindSourceFor`: the home screens of landing, food grill, restaurant, dashboard, then every screen). A
   section outside the recorded screen's family must name its `catalogBlock` (inspector and edit ops always do): a
   bare kind there is what a tampered block looks like, so the provenance gate still refuses it. Invented kinds stay
   refused (`catalog_block_unknown`).
2. The family is derived from the composition after every operation (`deriveFamily`): kinds that every family has
   (header, footer) say nothing; when more than half of the telling top-level sections belong to one family (dashboard,
   landing, food grill, restaurant) that is the family, otherwise `generic`. The recorded Stock screen stays; only the
   advisory fields change.
3. Advisory uses: the Blocks feed ranks the family's kinds first (`stockSearch` `boostRoles`, stable, nothing filtered
   out); Ask sees `currentPage.screenFamily`; the page's recorded screen keeps feeding samples.
4. Sections has a Family select: Auto (shows the derived one) or a pinned family. A pin stops the automatic update until
   Auto is picked again.
5. A family change is its own undo step (session revision op `set_family`, session 1.7.0): an edit that changes the
   family records the edit and then the family; one undo reverts the family, the next the edit. Undo / redo restore
   the family with the page (the history snapshot is page + provenance). A small non-modal label "Family: A -> B" in
   the Build tab row says it at the moment it happens (role=status, gone after a few seconds).
6. page-spec 1.4.0 (ui8kit/contract, minor): `provenance.family` (enum) and `provenance.familyPinned` (boolean), both
   optional, so every older page stays valid; session 1.7.0 adds `set_family` to the revision ops.
7. Feed availability (t150u) is a pure function of the card's item and the page, computed per rendered card:
   - a block card: `inspector.canAdd(spec, variant)` in FeedCard itself (the "+" state, the drag and the reason);
   - a screen card: `stockSearch`'s `supported`, now "the screen has at least one section this version renders"
     (`screenSections`), the same on every result page. Start page uses the full program draft when it assembles, else
     the screen's renderable sections (`addScreenSections`, sections it cannot render are skipped and listed); a screen
     card drags into the preview or onto Sections and drops its sections at the slot (header to the top, footer to the
     end, one the page already has skipped), one undo step.
   - a drop checks the dragged item against the page at drop time; the drag store keeps the item only.

## Root cause (t150u) and removed state

`supported` for a screen meant "the whole screen assembles as one propose_layout draft" (every block renderable), and
the catalog lists fully renderable screens first, so with 8 per page they all sat on page 1 (10 of 80 screens), and
every card from page 2 on showed a disabled Start page; screen cards were never draggable. On top of that the feed kept
availability outside the card: a `checks` map keyed by the current result page's items in BlocksFeed (with `pageNote`
read from its first entry) and the check captured at drag start in the drag store. Removed: the `checks` map and the
`check` prop of FeedCard, `feedDrag.check` and its argument to `feedDrag.start`; the page note now reads the page.

## Consequences

- Mixed pages (Activity + CTA + Hero, Hero + Metrics + Menu) build, validate and export (tests compile every exported
  Svelte file).
- `screenStartable` still describes the full program draft; the feed no longer uses it.
- The family does not move the page to another Stock screen; a later version may suggest a preset or Start-from-screen
  list per family (familyScreenId is exported for it).

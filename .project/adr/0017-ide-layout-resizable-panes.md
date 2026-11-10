# ADR 0017: Compact IDE layout: resizable, collapsible panes; one inspector column

Status: accepted (2026-11-10). Issues: alexy-os/chaosbun#132 (Build inspector), alexy-os/chaosbun#150 (registry
resizable primitive for XGenBot). Review: `/workspace/block-drift/acceptance/layout-review.md`.

## Context

The owner asked for flexible control of the inspector and of the column left of the main area (nav and chat), with
the ability to hide them, and later for an IDE density (VS Code / Cursor) that fits a Wails3 window 1024px wide. The
review measured the old layout: in Build with a block selected the preview stage was 250px wide at 1440x900, 90px at
1280x800 and 0px tall on a 400px phone. The 248px nav, the chat, the BlockTree and the fields all took fixed widths;
Layers sat left of the canvas and Properties right of it; every pane was a padded card inside a padded card.

## Decision

Layout (from left to right): nav | chat | preview | inspector.

- **One inspector column, Layers over Properties.** The block tree (Layers) and the fields (Properties) share one
  right-hand column with a horizontal splitter between them. Not two columns: two flanking columns cost a second
  256px+ and split the eye between the far left and far right. Not tabs: choosing a block in Layers and editing it in
  Properties is one loop, and tabs would hide one half on every step. The canvas overlay also selects blocks, so Layers
  can collapse to its header (`aria-expanded`) and give its height to Properties.
- **Every side pane resizes and collapses.** `PaneSplitter.svelte` (app layer, built from the registry `Block`,
  because the registry has no resizable primitive yet: chaosbun#150) is a WAI-ARIA window splitter: `role=separator`,
  `aria-orientation`, `aria-valuenow/min/max`, `aria-controls` = the pane id; pointer drag with capture; Arrow keys
  step 8px (Shift 32px); Home / End = min / max; Enter or double click = default. Ranges (px, min / max / default):
  nav 200 / 360 / 240, chat 264 / 520 / 320, inspector 256 / 480 / 304, Layers height 96 / 480 / 200.
  A collapsed pane is a 48px rail with icon buttons (expand, and a direct action: new chat, focus composer, Layers,
  Properties).
- **The preview gets the space.** The nav starts as a rail. `fitWidths()` keeps the preview at least 360px: when the
  viewport is short, the chat and then the inspector are drawn narrower down to their minimum (stored sizes are kept).
  Focus mode shows every shell pane as a rail without losing their stored states; expanding any pane ends it.
- **Shortcuts** (Ctrl or Cmd; not with Alt / Shift; not inside the code editor, which binds Mod-i): Ctrl+B chat
  column, Ctrl+I inspector, Ctrl+\ focus (preview only). Matched by `event.code`, so they work in any keyboard layout.
  Head buttons do the same and carry the shortcut in their title.
- **Breakpoints.** Columns from 1024px (`lg`): below that the chat is a tab (Preview | Chat) and the nav a drawer. The
  inspector is a column from 768px; below 768px it is a right-hand `Sheet` (registry) opened from the head.
- **Prefs.** Sizes and collapsed states are one per-user value `buildy:v1:prefs` = `{ layout }` (read and written only
  through `lib/layout/prefs-store.ts`; unreadable text goes to `buildy:v1:quarantine`; the old `buildy:v1:layout`
  booleans are moved once). The portable session file carries the same object as optional `prefs.layout`
  (session.schema.json 1.2.0 in ui8kit/contract: closed object, integer sizes 0..4096, boolean flags; additive, so
  1.0 and 1.1 files stay valid). Import applies it; export writes it.

Density (IDE, VS Code / Cursor), on the ui8px 8+4 grid with tokens and size variants only:

- Bars (top bar, workspace head, preview head, inspector head, chat head) are `h-10` (40px) with `px-2`, holding `sm`
  controls (`size-8` icon buttons, `h-8 px-3 text-sm` buttons, kit `Icon size="sm"`).
- Lists and labels use `text-xs`; section labels `text-xs uppercase`; tree rows are one line, `h-8`, title and kind
  side by side, depth by `pl-2 / pl-4 / pl-6 / pl-8`.
- Layout gaps and paddings are 8px steps (`gap-2`, `p-2`, `px-2`); 4px only inside controls (`py-1`). No half steps
  (`py-1.5`, `px-1.5`), no arbitrary values (`text-[10px]`, `w-[var(--x)]`, `h-dvh`). Pane sizes are runtime values,
  so they are an inline `style` width / height, never an arbitrary class.
- Panes are edge to edge, separated by a border and the splitter, not nested padded cards.
- ui8px: 0 blocking findings on the changed files (49 blocking before in the shell files, 31 in the chat thread).

## Consequences

- At 1024x768 with nav and chat as rails the preview is about 616px and the inspector 304px: preview plus one panel
  work in a Wails3 window. At 1440x900 Build the preview went from 250px to 752px; at 1280x800 from 90px to 592px; on
  a 400px phone from 0 to the full width with the inspector in a sheet.
- The chat's dependency-free schema checker learned `maximum`.
- When the registry ships the primitive from chaosbun#150, `PaneSplitter.svelte` is replaced by it (same ARIA and
  keys), with no change to prefs or layout.

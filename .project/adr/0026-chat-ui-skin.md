# ADR 0026: Chat UI skin, a tonal dark and light theme for the chat shell

Status: accepted (2026-11-11). Owner request t145u, clarified by t146u (the owner's mockups show approaches to theming,
not widgets or layout).

## Context

The chat shell (sidebar, top bar, Build panel tabs Blocks / Sections / Chat, feed cards, composer, inspector
slide-over, Settings, popovers, preview frame chrome) used the registry's shadcn neutral theme as is: flat white or
near-black surfaces separated by 1px outlines, one corner radius (0.625rem) for every element, 2px icon strokes and the
browser's own scrollbars. The owner asked for a skin of the chat's own UI in dark and light, built on these principles
(owner's words, translated): consistent radii that depend on an element's size and nesting; less visual noise through
one spacing rhythm, monochrome icons and restrained decoration; progressive disclosure, so extra tools appear when
needed and the state of work reads at a glance; surface tones make the main separation and shadows mark floating
elements. Inputs read: x.ai "Designing Grok Bot" (take things away; status at a glance, detail on hover), OpenAI
plugin UI guidelines (system colours for text, icons and dividers; monochrome outlined icons; consistent corner rounds;
WCAG AA), YouTube's redesign (radii scaled by an element's placement, size and relation to others; light as tone, not
glow). Concept palettes from the mockup prompts (dark media #0f0f0f / #141414 / #202020, dark chat #212121 / #171717 /
#2c2c2c, dark agents #101214 / #191c20 / #202429 / #2b3036) were starting points, not tokens.

## Decision

Theme layer only. `apps/chat-web/src/styles/chat-skin.css`, imported by `app.css` after the registry theme and kit
CSS, sets `--ui-*` tokens and maps them onto the kit's shadcn names (`--background`, `--card`, `--accent`, `--border`,
...), so every registry component of the shell follows without a class change. No widget, layout or structure changes;
the registry tree is untouched.

**Boundary with the preview.** The preview iframe gets `preview-frame.css` (registry `styles/index.css` only) and the
standalone `/preview` route imports the same; neither loads `app.css` or `chat-skin.css`, the registry theme has no
`--ui-*` name, and `pack.ts` never carries the skin. Preview skins and the Custom Skin (ADR 0016, 0025) stay
independent; the frame only follows the chat's light / dark mode as before (ADR 0025 Custom Skin fixes its own).
Tests check the imports; a live probe reads the frame root (`--ui-canvas` absent, registry `--background`, `--radius`
0.625rem).

### Tonal ladder

Neutral graphite (dark) and neutral zinc (light), no hue, no gradient. Each step is about 1.08 to 1.2 in contrast from
the next: enough to read as a plane, never as a line.

| role | token | dark | light | used by (kit name) |
| --- | --- | --- | --- | --- |
| sidebar | `--ui-sidebar` | #0f1012 | #f4f4f5 | `--sidebar` (nav rail, one step below the canvas) |
| canvas | `--ui-canvas` | #18191c | #ffffff | `--background` (columns, preview stage) |
| surface | `--ui-surface` | #1e2023 | #f6f6f7 | `--card`, `--muted` (feed cards, rows, Settings region, fields) |
| raised | `--ui-raised` | #25272b | #ffffff | hovered card |
| hover | `--ui-hover` | #2b2d32 | #ededef | `--secondary` (charcoal secondary button) |
| active | `--ui-active` | #33363b | #e4e4e7 | `--accent`, `--sidebar-accent` (selected row, tab, toggle; hover = accent/70) |
| popover | `--ui-popover` | #25272b | #ffffff | `--popover` (model list, dialogs; with the float shadow) |
| text | `--ui-text` | #ececee | #18181b | `--foreground`, `--primary` (off-white primary action in dark, near-black in light) |
| muted text | `--ui-text-muted` | #a0a2a8 | #5d5e66 | `--muted-foreground` |
| icon (inactive) | `--ui-icon` | #9a9ca3 | #6b6c74 | rail icons until hovered, focused, pressed or selected |
| label on primary | `--ui-on-primary` | #18191c | #fafafa | `--primary-foreground` |
| hairline | `--ui-hairline` | #26282c | #ebebed | `--border`, `--sidebar-border` (1.19:1, reads as tone) |
| field edge | `--ui-edge` | #72757c | #8a8b93 | `--input` (text fields keep a 3:1 edge) |
| focus | `--ui-focus` | #8e9199 | #71727a | `--ring`, 2px focus outline |
| danger | `--ui-danger` | #f05a5f | #c4262c | `--destructive` (text and fill) |
| danger hover | `--ui-danger-hover` | #f47a7e | #a91f24 | `--destructive-hover` |
| label on danger | `--ui-on-danger` | #18191c | #ffffff | `--destructive-foreground` |
| success | `--ui-success` | #3fb27f | #1a6b48 | state colour (green, far from danger in hue and lightness) |
| warning | `--ui-warning` | #e2a336 | #865700 | state colour |

Contrast (WCAG 2.x ratio, computed from the tokens; `scripts/m4-api-tests/ui-skin.test.ts` enforces the floors:
text 7, muted / danger / success / warning text 4.5 on sidebar..raised, edges, focus and icons 3):

## light
| fg \ bg | sidebar #f4f4f5 | canvas #ffffff | surface #f6f6f7 | raised #ffffff | hover #ededef | active #e4e4e7 |
| text #18181b | 16.12 | 17.72 | 16.40 | 17.72 | 15.15 | 13.96 |
| text-muted #5d5e66 | 5.86 | 6.44 | 5.97 | 6.44 | 5.51 | 5.08 |
| icon #6b6c74 | 4.75 | 5.22 | 4.83 | 5.22 | 4.47 | 4.11 |
| danger #c4262c | 5.22 | 5.74 | 5.31 | 5.74 | 4.91 | 4.52 |
| success #1a6b48 | 5.90 | 6.48 | 6.00 | 6.48 | 5.54 | 5.11 |
| warning #865700 | 5.66 | 6.22 | 5.76 | 6.22 | 5.32 | 4.90 |
| edge #8a8b93 | 3.08 | 3.39 | 3.14 | 3.39 | 2.90 | 2.67 |
| focus #71727a | 4.35 | 4.78 | 4.43 | 4.78 | 4.09 | 3.77 |
primary label 16.97, destructive label 5.74, hairline/canvas 1.19, steps sidebar>canvas 1.10 canvas>surface 1.08 surface>hover 1.08 hover>active 1.09
## dark
| fg \ bg | sidebar #0f1012 | canvas #18191c | surface #1e2023 | raised #25272b | hover #2b2d32 | active #33363b |
| text #ececee | 16.13 | 14.90 | 13.84 | 12.68 | 11.68 | 10.28 |
| text-muted #a0a2a8 | 7.46 | 6.89 | 6.40 | 5.86 | 5.40 | 4.75 |
| icon #9a9ca3 | 6.94 | 6.41 | 5.95 | 5.46 | 5.02 | 4.42 |
| danger #f05a5f | 5.74 | 5.30 | 4.92 | 4.51 | 4.16 | 3.66 |
| success #3fb27f | 7.15 | 6.60 | 6.13 | 5.62 | 5.17 | 4.55 |
| warning #e2a336 | 8.64 | 7.97 | 7.41 | 6.79 | 6.25 | 5.50 |
| edge #72757c | 4.13 | 3.81 | 3.54 | 3.24 | 2.99 | 2.63 |
| focus #8e9199 | 6.04 | 5.58 | 5.18 | 4.74 | 4.37 | 3.85 |
primary label 14.90, destructive label 5.30, hairline/canvas 1.19, steps sidebar>canvas 1.08 canvas>surface 1.08 surface>hover 1.19 hover>active 1.14

Known below-floor pairs, all non-text or not used together: danger on active (dark 3.66) is the delete icon on a
hovered row (icon, 3:1); field edges on hover / active (2.6 to 3.0) do not occur (fields sit on canvas, surface or
raised); light icon on active 4.11 is above 3:1.

### Edges

Outlines give way to tone: `--border` is a hairline one step off its plane, and inside feed / Stock cards, Sections rows
and the Settings region `--border` is scoped to transparent (the card's surface tone separates it; the thumbnail divider
goes too). Selected and drop states keep their primary / destructive edge (those utilities read `--primary` /
`--destructive`, not `--border`). Kept for accessibility: text field edges (`--input`, 3:1), focus rings, the
selected-section outline. The inspector slide-over loses its left rule and floats on a shadow instead.

### Radii (concentric, 8+4 grid, compact IDE density)

A container's radius is its children's radius plus its padding; controls are 8 at the shell's 24 to 32px sizes (the
mockups' 44px controls and 20 to 28px radii are not copied).

| element | radius | why |
| --- | --- | --- |
| controls: buttons, tabs, inputs, selects, list rows (`rounded`) | 8 | `--radius: 8px` in the app `@theme` |
| inside an 8px-padded card (thumbnail corner, row actions) | 4 | 12 - 8 |
| feed / Stock cards, composer model list (p-2) | 12 | 4 + 8 |
| Sections rows, Settings region (p-1 rows, 8 inside) | 12 | 8 + 4 |
| composer field | 12 | floating input, text inset 12 |
| dialogs (8 inside) | 16 | floating layer |
| docked panels (sidebar, slide-over, bars) | 0 | follow the window edge |
| pills: theme choice, Night Mode switch, badges | full | |

The kit's scale is restated for the app: `rounded-sm` 4, `rounded-md` 8, `rounded-lg` = `--radius`, `rounded-xl` 12,
`rounded-2xl` 16 (it was `--radius` x 0.6 / 0.8 / 1.4 / 1.8, off the grid). Scopes set `--radius`, never override a
utility.

### Shadows, icons, scrollbars, focus

- Shadows only on floating layers: inspector slide-over, composer model list and open dialogs (`--ui-shadow-float`,
  soft, 8/24 blur), the composer field and a hovered feed card (`--ui-shadow-contact`). No glow, glass, blur or
  neumorphism.
- Icons: monochrome, 1.5 stroke everywhere; in the sidebar, tab bar and browser bar they are `--ui-icon` until the
  control is hovered, focused, pressed, selected or current, then the text colour.
- Scrollbars: 4px rounded thumb on an 8px transparent track (WebKit / Blink); Firefox `scrollbar-width: thin`.
- Focus: a 2px `--ui-focus` outline (3:1 or more on every plane) on buttons, links, tabs and other focusables; text
  fields keep their own ring and caret.

### Progressive disclosure (light touch)

Secondary row actions (a recent chat's delete, a feed card's "open in Stock") are transparent until their row is
hovered or holds focus, and on their own focus; they stay in the tab order and stay visible on touch (`hover: hover`
and `pointer: fine` only). Nothing is removed or moved.

### Theme choice

Settings > Theme: System / Dark / Light (a pill group, `aria-pressed`), stored in `buildy:v1:themePref`, default
System (follows `prefers-color-scheme` live). `buildy:v1:theme` keeps the resolved mode (session file
`settings.theme`, the standalone preview), so the session schema is unchanged; importing a session file sets an
explicit choice. The Night Mode switch stays and sets an explicit Dark / Light.

## Consequences

- One stylesheet for the chat's look; the registry stays the literal CLI output. This narrows the earlier rule "the
  chat declares no colour tokens of its own" (catalog-sources test): `styles/chat-skin.css` (and the app `@theme` radius)
  is the one exception, every other chat CSS file still may not redeclare a registry token.
- An existing browser whose stored mode was written automatically now follows the system until a choice is made.
- The same ladder could later be offered as a magazine-theme v2 preview preset (palette and radius fields), but it is a
  tool UI palette (neutral, low contrast steps), not a site theme; not built.

## Open

- Native `<select>` popups and the browser's date / colour pickers follow `color-scheme`, not these tones.
- The Night Mode switch keeps its own look (kit `Switch`); its thumb reads as a dark dot in light mode.
- Code view syntax colours (editor.css) were not retuned to the new canvases.

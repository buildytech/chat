# ADR 0028: Chat UI refinement through UI8Kit composition and one shell theme

Status: accepted (2026-11-12). Owner approved the screenshot/code review, the UI8Kit-aligned refactoring sequence,
and recording this ADR, its SLO and implementation plan. Initial implementation and browser checks are recorded in
[the acceptance report](../../docs/acceptance/chat-ui-refinement.md); owner design review remains separate.

Extends [ADR 0026](0026-chat-ui-skin.md): replaces its **theme-layer-only implementation scope** for this work.
Its preview isolation, token ownership and accessibility requirements remain. Keeps the compact density of
[ADR 0017](0017-ide-layout-resizable-panes.md) and the later Build layout of
[ADR 0024](0024-agent-free-build-layout.md): Blocks / Sections / Chat in the left panel, preview and a non-modal
inspector slide-over. This decision does not restore the older inspector column.

## Context

The owner supplied three dark UI concepts and their prompts, then screenshots of the current shell. The first
screenshot intentionally used a narrow window with expanded navigation; the second showed the full desktop
workspace. The priority is visual consistency and finish, not increasing whitespace or reducing IDE density.

The review found competing nested borders, inconsistent selection treatments, disconnected composer controls,
duplicate scenario and model labels, exposed technical identifiers, and uneven alignment. Source inspection also
found an unlayered `font: inherit` rule for form controls that can override layered typography utilities. Computed
styles and interactive states must be checked in the browser before treating source-level findings as verified fixes.

Design inputs (owner-local files, not repository dependencies):

- `C:/Users/alexe/OneDrive/Документы/ChatGPT/DesignUXUI/output/dark-ui-2026-11-11/`: `01-graphite-chat.png`,
  `02-near-black-media.png`, `03-charcoal-workspace.png`, `prompts.md`.
- `C:/Users/alexe/Downloads/Screenshot_114.png` and `Screenshot_116.png`.

The graphite concept guides conversation and the composer; the media concept guides catalog hierarchy; the charcoal
concept guides workspace surfaces. Their palettes and dimensions are illustrative, not production tokens. The
prompts' gray content bars represent omitted text, not loading states. No concept feature implies a new product tool.

## Decision

### 1. Two implementation responsibilities

- Structure, alignment, grouping and disclosure belong to `apps/chat-web/src/app/*.svelte`, using Svelte 5 runes and
  existing `$registry/...` primitives/compositions. No app-owned primitive library, raw HTML fallback or manual
  change to the installed `registry/svelte` tree. Semantic tags use `tag`; headings use `Title as`.
- Tones, edge roles, radius scopes, icon treatment and permitted shadows belong to `styles/chat-skin.css`, with the
  app's existing radius declarations in `app.css`. Fix base typography in the appropriate CSS layer in `app.css`;
  component utility classes must retain control of size, weight and line height. Do not patch layout through global
  theme selectors or override utility classes to conceal a composition problem.
- Composition consumes semantic tokens, never literal colors. Icons use Lucide through supported registry icon
  handling. All visible and accessible wording comes from dictionary entries (EN/RU) or catalog/props data.

### 2. Visual grammar

- Retain `h-10` bars, `sm` controls and the project's 8px layout / 4px control rhythm. No wholesale adoption of the
  concepts' 44px controls, large floating gutters or 20-28px corners. Runtime pane dimensions retain the documented
  inline-size exception; do not add arbitrary-value classes for fixed layout sizes.
- Surfaces and grouping provide the primary separation. Structural dividers remain quiet. Selection is normally
  tonal, with readable text and semantic state; it is distinct from hover and keyboard focus. Light primary fills
  emphasize the available main action rather than every selected control.
- Radius scopes follow nesting: a surrounding surface must geometrically contain its inner controls. Docked panes
  follow their edges. Use token scopes and supported utilities, not scattered per-element CSS fixes.
- Preserve ADR 0026 contrast floors. Do not globally darken `--input` to hide field edges. If the composer becomes a
  single visible input surface, define its boundary and focus treatment, verify actual adjacent surfaces and update
  the relevant documentation/tests without reducing text, icon, required boundary or focus contrast targets.

### 3. Composer, conversation and first use

- Make one coherent input surface with a stable bottom action row: explicit Ask / Build and the model selector on
  the left, send/stop on the right. Wrapping long labels must not leave send centered against a stack of settings.
  Move Add model into the model menu, retaining keyboard reachability and dialog focus return.
- Keep the selected model visible once. Put its full ID and detailed usage/runtime information behind an accessible
  disclosure. Separate browser persistence from live model connection; never claim connection from persistence mode.
  Errors and actionable warnings stay visible. Enter/Shift+Enter, IME, cancel and explicit mode semantics remain.
- Use one selected-scenario presentation rather than both a selected button and a duplicate removable badge. Keep
  attached context near the composer; use the catalog's screen title and retain its ID in details. If metadata is
  unavailable, keep an honest ID fallback rather than inventing a friendly-name mapping.
- Give first-use content and composer a shared alignment strategy. Rewrite the welcome text as useful task guidance,
  with EN/RU dictionary entries. Preserve scenario, screen and collection intake behavior.
- Tune user/assistant message hierarchy, secondary actions, line length and alignment with the composer. A compact
  user bubble is a design direction to validate with real short/long conversations, not a reason to drop actions.

### 4. Apply the grammar across the shell

Navigation, panel tabs, preview/code controls, preview chrome, catalog cards/filters, Sections, inspector, Settings
and menus use the same control geometry and state vocabulary. Reduce technical metadata prominence and consolidate
secondary catalog filters into accessible disclosure where helpful; retain counts, active-filter visibility, clear,
pagination, add/drag availability and error reasons. Data and names continue to come from the pinned catalog.

Do not recolor block thumbnails or the rendered page to match the shell. Review both themes and all interaction
states, not only the owner's dark screenshot. Preserve mounted tab panels, drafts, focus, shortcuts and pane prefs.

### 5. Scope and delivery

No page/session schema changes, catalog enrichment, new persistence keys, model-tool changes or paid model calls are
needed. Preview document styles, `/preview`, Custom Skin and ZIP output remain isolated from the chat theme. Preview
zoom modes and address navigation behavior are separate functional work; neither is a prerequisite for this visual
refactor. The narrow screenshot is a responsive regression case, not evidence for replacing the layout.

Implementation follows [the plan](../../docs/plans/chat-ui-refinement.md); acceptance follows
[the UI SLO](../slo/chat-ui-refinement.md). Update behavior-dependent tests where intentional presentation changes
invalidate source-shape assertions, while preserving functional and accessibility coverage. Do not grow baselines or
add unavailable upstream tooling. Verified work goes to `main` under the repository's owner delivery rules, no PR.

## Owner follow-up: concrete interaction fixes (2026-11-12)

The owner supplied selected DOM elements after trying the first refactor. This explicitly changes resting field
edges: `--input` maps to a quieter `--ui-field-edge` in both themes; `--ui-edge` remains the stronger emphasis color
and keyboard focus remains at least 3:1. Resting outlines no longer carry a blanket 3:1 claim. Text, icons, focus
and validation feedback retain their requirements. The policy applies only to the shell, including native select
inset rings, never to the registry or rendered page.

- New feed preferences default to two columns; existing explicit one-column choices remain. Both views use a stacked
  card with full-width media, so one column enlarges the preview instead of becoming a compact media row.
- Replace the new-chat lightning icon with chat-plus and the Night Mode switch with a Sun/Moon action whose label
  names the target mode. Keep the existing System/Dark/Light preference behavior.
- Remove Home (no distinct destination) and the duplicate sidebar toggle. The main toolbar toggle reports the actual
  desktop state. Settings and Search opened from the rail expand the sidebar, focus their controls, and provide
  explicit close buttons, Escape and focus return. Settings gains spacing and a sticky heading with a close action.
  The mobile drawer keeps its own close action and focus return because it overlays the main toolbar.
- Separate Preview/Code controls with a 4px gap; Download ZIP uses the ghost variant. Selected Sections rows use
  tonal fill and a quiet boundary instead of the primary outline; keyboard focus remains visible.
- Assistant Copy is explicitly Copy Markdown: copy source Markdown, including displayed proposal commentary, never
  reconstructed rendered HTML. Success changes icon/name; clipboard failure is visible. Share uses the same source.

No storage migration, schema change or inference path is introduced. The SLO and
[follow-up report](../../docs/acceptance/chat-ui-followup.md) record this work rather than silently preserving the
former universal resting-edge claim.

## Consequences

- This is an app composition refactor as well as a theme refinement; a token-only patch is insufficient.
- The accepted design direction is shared across the shell, while framework and exported page ownership stay clear.
- Automated checks establish contracts and compilation; visual acceptance requires recorded browser evidence.
- This ADR records approval and scope; measured results and limitations belong to the linked acceptance report.

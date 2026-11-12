# Chat UI refinement: implementation evidence

Date: 2026-11-12. Scope: [ADR 0028](../../.project/adr/0028-chat-ui-refinement.md),
[SLO](../../.project/slo/chat-ui-refinement.md), [plan](../plans/chat-ui-refinement.md).
Baseline: `4905fcc`; this report ships with the implementation it describes. The screenshots contain local fixture
messages and a catalog Hero page, not a real conversation or model output. No paid model calls were made.

## Delivered

- Base form-control inheritance is in `@layer base`, allowing typography utilities to work. Before: representative
  toolbar controls and selects computed to 16px despite `text-xs`/`text-sm`. After: composer text is 14px and controls
  follow their declared compact scale; toolbar height remains 40px.
- One composer surface, one input boundary, a stable bottom row with Ask/Build, model and send/stop; Add model is in
  the chooser. Connection/usage details are disclosed on request; errors remain visible. Enter handling belongs to
  the form and only handles textarea events, avoiding duplicate submission and interfering with button activation.
- No duplicate scenario badge, tonal scenario selection, catalog screen title in attached context, a shorter welcome
  message, aligned first-use content, compact user messages and secondary run details.
- Secondary filters use native disclosure, active filter values stay visible, card variants are readable without a
  truncated spec prefix, and toolbar/inspector actions use consistent tonal states rather than extra outlines.
- The model dialog traps keyboard focus and returns it to its trigger. Changed card/inspector composition uses
  registry primitives with appropriate roots and semantic headings.

## Baseline repairs

These are separate from the visual changes and preserve the pinned catalog contents:

- LF checkout policy in `.gitattributes`: CRLF conversion changed raw-byte hashes and generated-file comparisons on
  Windows. Normalized working files match their published pins; generated registry/catalog files have no content diff.
- Search-index packing now explicitly uses English collation, matching the existing pin, instead of the OS default
  locale. The Russian Windows locale previously ordered Cyrillic terms first and changed the packed byte sequence.
- Tests use `fileURLToPath`, normalized relative paths and Windows junctions for exported build fixtures. No tests
  were skipped and no baseline/contrast thresholds were relaxed. Temporary tool downloads live in ignored `.cache`.

## Browser observations

Environment: Windows, Node 22.23.5, headless Microsoft Edge 157.0.4341.46, isolated profiles, zoom 100%. All dimensions
below are CSS pixels. Tests ran on a local Vite server; runtime failures were intercepted locally where needed.

- Both dark and light at 1920x1080, 1440x900, 1024x768, 768x1024 and 390x844: no horizontal document overflow, 40px
  main toolbar, 14px composer text and no browser page errors in the recorded matrix.
- The model selector and send control share the same bottom edge in the conversation fixture. Send is 32x32px.
  Narrow views retain Chat/Preview switching; desktop uses the existing fitting rules. The desktop fixture requested
  a 464px left panel, which the layout may narrow when space is constrained.
- Draft text survived Blocks/Chat switches. Model chooser Escape and dialog Escape returned focus. Forward/backward
  Tab wrap was exercised in the model dialog; Code opened and displayed non-empty generated source.
- Multiline input and Shift+Enter worked. Synthetic composition events prevented Enter submission during IME;
  busy/cancel and a failed run were exercised in both themes with intercepted runtime calls only.
- Expanded navigation, Sections, inspector edits and undo/redo were exercised in both themes. Edited page data survived
  reload. System followed an emulated OS theme change in both directions.
- Standalone Preview opened without the shell. Computed `--ui-canvas` was empty in the iframe in all ten matrix cases.
- On the production build, generated Code was non-empty, ZIP download completed, and the model dialog's forward and
  backward Tab cycles retained focus. A browser context with touch capabilities kept secondary catalog actions visible.
- Russian dictionary wording and an artificially long model label were checked at 1440x900 and 390x844. This used a
  test-only dictionary-module response substitution; the application still has its existing English locale selection.

## Representative screenshots

- [Conversation, dark, 1440x900](chat-ui-refinement/chat-dark-1440.png): navigation rail, 464px chat pane, clean page.
- [Conversation, light, 1440x900](chat-ui-refinement/chat-light-1440.png): same local fixture and pane preferences.
- [Conversation, light, 390x844](chat-ui-refinement/chat-light-390.png): responsive Chat surface.
- [Inspector, light, 1440x900](chat-ui-refinement/inspector-light.png): expanded navigation, Sections, edited Hero.
- [Catalog, dark, 1440x900](chat-ui-refinement/blocks-dark-1440.png): role filter, secondary filter disclosure.
- [Russian text fixture, 390x844](chat-ui-refinement/chat-ru-390.png): test-only Russian wording and long label.

Input references remain the owner's screenshots and concept files listed in ADR 0028. An original light-theme
before-screenshot was not collected; do not treat the evidence as a full before/after image set.

## Verification and limits

Final commands passed on Node 22.23.5: `npm run verify` (95 contract tests and 359 unit tests, all passing;
svelte-check: 0 errors / 0 warnings; static build), `npm run registry:check` (361 items, 502 files), and
`npm run snapshot:check` (3,665 entities, 13,721 edges, pins and derived artifacts matching).
Existing tests cover page/session contracts, mode
semantics, catalog gates, inspector operations, export compilation, preview isolation and theme contrast floors.

An earlier concurrent build exhausted esbuild memory while browser/dev work was also running; verification was then
run sequentially with `GOMAXPROCS=2` and `GOMEMLIMIT=512MiB`. These are local process settings, not product defaults.
Vite still reports an existing mixed JSON-import-attributes warning for `package.json`; it did not block the build.
The dev-server ZIP download exceeded a short browser timeout while compiling raw registry modules; the completed
production build's ZIP download passed. No registry or export source was changed to work around that observation.

Real hardware touch, screen-reader navigation and real IME composition were not certified by the synthetic browser
checks. A live provider, every registry block and every possible state combination were not exercised. The remaining
strong borders on input identification, focus and selected-section/drop feedback are intentional accessibility and
editing affordances. Owner visual review is still needed before describing the UI as release-ready.

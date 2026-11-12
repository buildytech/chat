# SLO: Chat UI refinement acceptance

Status: accepted targets (2026-11-12); initial implementation measured in
[the acceptance report](../../docs/acceptance/chat-ui-refinement.md). Targets below remain unchanged.

Decision: [ADR 0028](../adr/0028-chat-ui-refinement.md). Sequence and evidence checklist:
[refactoring plan](../../docs/plans/chat-ui-refinement.md). This is a local release-quality objective for the shell,
not an uptime promise, production measurement or new telemetry system. Existing build/CI objectives remain in
[chat-web.md](chat-web.md).

## Measurement window and release rule

Evaluate each changed UI slice before its verified commit; run the full matrix on the final candidate. Record the
commit, browser/version, CSS viewport, zoom, theme, locale and relevant pane state with each evidence set. Measure
layout in CSS pixels at 100% browser zoom. Never infer CSS dimensions from image dimensions alone.

The target is 100% pass for applicable cases and zero unresolved release-blocking defects introduced by the refactor.
Any unrun applicable case is pending, not a pass. There is no visual error budget: fix the defect before calling the
refactor accepted. A missing fixture or unavailable external runtime is recorded explicitly, with local state coverage
and the remaining limitation. Do not spend paid model calls to obtain visual states.

## Objectives and observation

### UI-01: Coherent typography and control geometry

Target: zero overridden intended typography sizes/weights caused by the form-control reset; zero clipped labels,
icons or focus indicators, unintended overlap, or accidental horizontal document overflow in the matrix.

Measure computed font family, size, weight and line height on representative button, textarea, select and label
elements. Compare toolbar control centers, heights and shared content edges using browser bounds: elements intended
to align share those edges/centers within 1 CSS px (glyph shapes may need optical review). A toolbar remains 40 CSS px;
fixed spacing follows the project's 8+4 rhythm. Review long EN/RU model and screen labels.

### UI-02: Deliberate surfaces, borders and state hierarchy

Target: every changed control has a readable default, hover, selected/pressed where applicable, focus and disabled
state; no unintended nested input borders or bright selection outlines competing with the primary action.

Review paired screenshots and keyboard interaction. Each visible boundary must have a stated purpose: pane
separation, required input identification, focus, selection or validation/drop feedback. Intended selected states
remain distinguishable from hover. Decorative separators are not input affordances and need not share their contrast.

### UI-03: Contrast and keyboard accessibility

Target: primary text 7:1, muted text 4.5:1, status text 4.5:1 on its intended surface;
icons, emphasized boundaries and focus indicators 3:1 against their actual adjacent surfaces. No removed
keyboard action, inaccessible disclosure or focus trap in non-modal shell UI.

Owner follow-up (ADR 0028, 2026-11-12): normal field outlines deliberately use the quieter `--ui-field-edge`, visible
at rest but below emphasis. Only `--ui-edge` emphasis and focus retain the old 3:1 edge assertion. This explicitly
replaces the blanket resting-field-edge target; text/focus thresholds are unchanged. Token tests alone do not
establish universal WCAG non-text boundary compliance.

Measure token contrast with the existing `ui-skin.test.ts` tests and inspect computed colors/adjacency in the browser,
including selected, disabled and error presentations as applicable. Check Tab/Shift+Tab, menu operation, Escape and
focus return. Preserve primitive-supported ARIA states and native form semantics. Do not weaken contrast tests to
approve a quieter screenshot.

### UI-04: Stable composer and useful first-use content

Target: send/stop stays aligned to the bottom action row for short and wrapped model labels; no duplicate selected
scenario or repeated full model label in the primary view. Ask / Build, model choice and attached context remain
visible and operable. Technical IDs remain reachable in details, with an honest fallback if titles are absent.

Exercise empty, multiline and long draft; IME; Enter/Shift+Enter; sending/cancel; errors; model menu and Add model.
Check scenario selection/removal, screen attachment/removal and collection chips. Storage and connection messages
describe their own state without contradiction; actionable errors remain visible when details are closed.

### UI-05: Functional and document isolation

Target: zero regressions in mounted-tab draft preservation, local persistence, pane preferences/shortcuts, catalog
filters/pagination, add/drop/reorder, inspector selection/edits, undo/redo and Apply/Discard. Zero chat theme leakage
into preview documents, `/preview`, Custom Skin or ZIP output; zero manual changes to registry snapshot files.

Use existing tests plus browser smoke on a local fixture/session. Check computed preview tokens and stylesheet
imports, clean preview, standalone preview and export isolation. Exercise card availability on later result pages.
Visual work must not require a live model call.

### UI-06: Verification and evidence

Target: `npm run verify` and `npm run registry:check` succeed on the candidate. Record actual results, not planned
commands. No new baseline entries, skipped checks or unsupported upstream gates introduced for this work.

Visual evidence is manual until automated browser coverage exists. A successful build is not proof of a successful
mount, alignment, accessibility or visual acceptance.

## Required review matrix

- Desktop: 1920x1080 and 1440x900 CSS px; navigation rail and expanded navigation; representative inspector open.
- Compact desktop: 1024x768 CSS px with expanded navigation and with rails; intentional wrapping/collapse is valid,
  accidental overlap or lost actions is not. Use the existing layout fitting rules.
- Responsive: 768x1024 and 390x844 CSS px; navigation drawer, Chat/Preview switching and inspector overlay.
- Dark and light themes on every viewport; verify System follows OS preference. EN and RU at least at 1440x900 and
  390x844, including long labels. Confirm keyboard access on desktop and pointer/touch disclosure on mobile.
- States across this matrix: first use, real short/long conversation, attached screen/collection, catalog and
  Sections, preview/code, inspector, Settings, model menu/dialog, details, errors and busy/cancel. Cover each state in
  both themes; repeat width-sensitive cases at the narrow sizes. No claim of exhaustive combinatorial testing.

## Evidence status

See [the acceptance report](../../docs/acceptance/chat-ui-refinement.md) for browser measurements, screenshots,
verification results and remaining limits. Automated checks and a local browser pass do not replace owner design
review or real-device accessibility testing.

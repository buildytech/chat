# Chat UI: DOM-based owner follow-up

Date: 2026-11-12. Baseline: `978db20`. Authority: the owner's annotated DOM feedback, recorded as an addendum to
[ADR 0028](../../.project/adr/0028-chat-ui-refinement.md). This extends the
[initial acceptance report](chat-ui-refinement.md); its screenshots describe the preceding version.

## Changes

- All shell fields, including native select inset rings and the preview skin selector, use a quieter resting edge.
  The new `--ui-field-edge` is separate from the existing emphasis/focus colors. Text/icon/focus thresholds remain;
  the old blanket claim that every resting input edge is 3:1 is explicitly superseded in the ADR and SLO.
- Both catalog column counts keep full-width media above the card body. One column enlarges the thumbnail. New or
  invalid preferences default to two columns, while saved explicit choices of one or two columns survive reload.
- New chat uses a chat-plus icon; the theme action uses Sun/Moon and names the target mode. Home and the duplicate
  sidebar toggle are removed. The main toggle's expanded state now follows the real desktop pane state.
- Settings opened from the rail expands the navigation and focuses an explicit close button. Its panel has spacing
  from the trigger and a sticky heading. Close and Escape return focus. Search has the same rail-open/focus behavior
  and an explicit close action; modal dialogs take precedence over these sidebar shortcuts.
- A mobile-only close action remains inside the navigation drawer, because the drawer covers the main toolbar
  button. Opening focuses that close action; closing returns focus to the toolbar. Desktop has no duplicate toggle.
- Preview/Code has a 4px gap; Download ZIP is ghost. Selected Sections rows use tonal fill with a quiet edge.
- Assistant copy is named Copy Markdown, preserves source formatting and includes proposal commentary when shown.
  Success changes to a checkmark/Copied name and announces it; clipboard failures show a visible, actionable status.
  Copy/share do not create page revisions or model calls.

## Verification

Final browser measurements, representative screenshots and command results are recorded below.
Browser fixtures contain no user conversation or credentials. Clipboard checks intercept the API in the isolated
test page so they do not read or overwrite the user's system clipboard.

The unit suites run serially on this 8GB Windows host because concurrent tooling exhausted available memory.
The existing Settings height assertion was updated from arbitrary `max-h-[75%]` to the equivalent standard
`max-h-3/4` utility; its independent scrolling requirement remains.

## Recorded desktop scenarios

Microsoft Edge 157.0.4341.46, isolated profiles, 1440x900 CSS px, 100% zoom, dark and light:

- Fresh preference: two columns. First card width 148px, media 146px. After switching to one column: card 304px,
  media 302px, same top media composition. The explicit one-column preference survived reload.
- Settings from the rail expanded navigation. Trigger-to-panel gap measured 8px. The close button returned focus.
  Search opened from the rail, focused its input and returned focus to its trigger when closed.
- Sun/Moon actions changed the theme; Home was absent and the main toolbar supplied the single desktop nav toggle.
- Assistant Copy Markdown preserved headings, emphasis and lists exactly. Copied feedback and a simulated clipboard
  failure were both exercised. The clipboard API was intercepted, not the operating system's clipboard.
- No page errors were recorded in either desktop theme.

## Responsive and visual evidence

- 1024x768 dark: rail Settings and keyboard Search worked. Selected section border computed to `rgb(62, 65, 71)`
  with tonal `rgb(51, 54, 59)` fill, replacing the white primary outline.
- 768x1024 dark and 390x844 light: the drawer's close action received focus on open. Escape first closed Settings,
  then the drawer; the explicit mobile close button also returned focus to the main toggle. No horizontal overflow
  or page errors were recorded.
- Resting search field edges computed to `#3e4147` in dark and `#c7c8ce` in light. Focus tokens remain `#8e9199` and
  `#71727a`; palette tests retain their existing text, icon and emphasis/focus floors.

Screenshots (local fixtures only): [one-column media](chat-ui-followup/one-column-dark.png),
[two-column default](chat-ui-followup/two-columns-light.png), [Settings](chat-ui-followup/settings-dark.png),
[mobile Settings](chat-ui-followup/settings-mobile-light.png), [selected section](chat-ui-followup/selection-dark.png).

## Final checks

- Node 22.23.5: all 95 contract tests and 359 unit tests passed, with `--test-concurrency=1` on the same declared test
  suites. No test files were omitted or skipped. The corrected Settings-height assertion passed as part of this run.
- `npm run check`: 0 errors, 0 warnings. `npm run build`: static SPA completed. Builds used local memory limits;
  the initial 512MiB Node heap was insufficient, and 1024MiB completed successfully.
- Registry check: 361 items / 502 files match. Snapshot check: 3,665 entities / 13,721 edges, pins and derived
  artifacts match. Generated files, page/session schemas and model tools have no changes.
- The existing JSON import-attributes warning remains non-blocking. Real IME, screen readers and physical touch
  devices were not certified; clipboard behavior was checked through an isolated API substitute, not OS permissions.

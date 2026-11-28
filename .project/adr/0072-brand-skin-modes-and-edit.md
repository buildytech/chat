# ADR 0072: Brand Skins carry both modes, and Design edits a skin in place

Status: accepted (2026-11-28). Owner request t275u.

Extends [0070](0070-design-mode-brand-skins.md) and [0071](0071-design-provider-role.md).

## Context

The owner's session (export of 2026-11-28, five Brand Skins in one project) shows two problems.

**One mode per skin.** TITAN came out dark only. After "no light theme" Design made "Lumen", light only. After "TITAN needs both light and dark; Lumen now has no dark" it made `TITAN-2`, dark again. Causes, all in one path:

- The Design prompt described `theme.mode` as `"light" or "dark"` and said nothing about the other mode.
- A magazine-theme v2 config (Stock's format) has one `mode` and one `palette`. The palette is computed per mode (`paletteTokens(p, mode, skin)`), but `rootStyle` wrote only the tokens of the config's own mode, inline on `<html>`. Inline style beats the skin's `.dark` rules, so the other mode never showed.
- The preview, the standalone preview and the ZIP then forced the config's mode (`forcedPreviewMode`, `class="dark"` or `data-theme="light"` fixed on `<html>`), so the light/dark switch of the app did nothing for a Brand Skin.
- The validator checked WCAG AA only in that one mode.
- The brand contract (`brand.contract.json`) wrote `tokens.color = { light: <the mode's colours>, dark: {} }`: the dark set was always empty, whichever mode the skin had.

**A new skin on every request.** `designSend` always called `newBrandSkinId`, so each message (including "add the other mode") created a skin, and the first one stayed unfixed.

## Decision

1. **A skin is rendered in both modes from its palette.** `renderCustomSkin` returns the mode-independent inline declarations (`style`: radius, fonts, per-element tokens, type scale) and `modes: { light, dark }`, the palette's colour tokens and `color-scheme` for each mode. They are written as two rules, `:root:root { light }` and `:root:root:is(.dark, [data-theme="dark"]) { dark }` (selectors that outrank the skin's own `[data-skin]` rules; the Blocks feed uses a `[data-page-skin]` scope variant). `config.mode` stays in the file (Stock exports it) but is only the skin's default; nothing fixes it any more. The preview, the standalone preview, the feed thumbnails, the Svelte ZIP (`src/custom-skin.css`, the page follows `prefers-color-scheme`) and the templ ZIP (`theme.css`) all carry both. Every stored skin gains its second mode without migration, because it is derived from the palette it already has.
2. **The validator requires both modes and checks AA in both.** `themeContrastIssues` checks body text (4.5:1) and the primary pair (3:1) in light and in dark and names the mode in the message. A skin with no palette is rejected (`missing_palette`). The proposal's brand contract carries `tokens.color.light` and `tokens.color.dark`; `modeCompletenessIssues` rejects a contract with a missing or empty mode (`missing_mode`) or a missing required token of one (`missing_mode_token`).
3. **The Design prompt says so.** Every skin carries both modes; the host renders both from one palette; design for both; the host rejects a skin that fails AA in either; never claim a mode is missing.
4. **Design edits the active skin by default.** `BrandSkinRecord` gains `revision` (1 on create; older records read as 1) and `updatedAt`. A Design turn edits the picked Brand Skin, or the project's active one when it is a Brand Skin; only when there is none (or the person pressed **Create new**) does it create one. The model receives the current brief and theme in an `EDIT MODE` block of the system prompt and answers the full updated JSON (a patch would be merged by the host through the same validator; the full document keeps one path). The host validates it like any proposal. On success the skin keeps its id and `createdAt`, takes the new brief and theme and `revision + 1`, and is selected. An answer that changes nothing is reported ("stays as it is") and does not bump the revision. Messages carry `skinId` and `revision`.
5. **The Design panel shows the target.** "Editing «name», revision N" with **Create new**; each skin has **Edit** (and **Use**, which also makes it the edit target). **Apply in Design** under an Ask answer (ADR 0071) calls the same `designSend`, so it edits the active skin.

## Consequences

Nothing in the Stock format changes: a skin's `theme.json` is still a plain magazine-theme v2 config and imports into Stock unchanged. A skin cannot carry a hand-tuned second palette: both modes are derived from `palette` (hue, harmony, base colour; dark lifts the base colour and deepens surfaces). If that proves too narrow, a per-mode palette belongs in the Brand Skin record, not in the Stock config.

The exported templ site shows dark under `.dark` or `data-theme="dark"` on `<html>`; it has no script of its own. The Svelte ZIP follows the system.

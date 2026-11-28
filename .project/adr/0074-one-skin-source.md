# ADR 0074: One skin source, one registry, one deterministic apply

Status: accepted (2026-11-28). Owner requests t294u, t295u, t296u.

Extends [0070](0070-design-mode-brand-skins.md) and [0072](0072-brand-skin-modes-and-edit.md).

## Context

The owner switched between custom skins and the simple blocks of the side catalog either kept the old colours or took the new ones "at random".

Each place that dresses a page in a skin had its own reader and writer:

- the preview frame (`applySkin`, `lib/theme/skins.ts`), its own tokens and style elements;
- the standalone preview window (the same `applySkin`, but the project read from storage separately);
- the catalog cards (`lib/feed/page-skin.svelte.ts`): its own renderer, its own two `<style>` elements;
- the ZIP (`pack.ts`, `templ-code.ts`): the rules written again.

The causes of the "random" switch were in the catalog path:

1. The cards re-read the skin when the registry skin under the Brand Skin changed (`render.skin`, e.g. `modern-minimal`), and two Brand Skins usually sit on the same one. Switching between such two skins did nothing; switching between skins on different registry skins worked. That looks random.
2. The base CSS is loaded asynchronously, and nothing ordered the loads: a slow load of the skin before could finish after the skin that was chosen last, and the palette `<style>` was removed and added back, so cascade order depended on timing.
3. The frame document's skin was applied from an effect with no version, so an iframe that loaded during a switch could keep the previous skin.

## Decision

1. **One description of the skin in force.** `theme/skin-source.ts` (pure): a `SkinSource` `{ key, id, registry, config }`. `key` is the identity of everything the skin draws with (id, registry skin, and every value of the theme config), so an edit of a skin (same id, new revision) changes it as a switch does. `skinSheets(source, target)` returns the rules for `document` (selectors on the root) or `scope` (a scope element inside the app): the palette of **both modes**, the root attributes, the mode-independent inline declarations and the font URLs. `theme/skin-source.svelte.ts` reads it for the selected project: the one reactive read the preview pane and the catalog cards share.
2. **One writer.** `theme/skin-apply.ts`: `createSkinApplier(document, { target, baseCss })`. Deterministic by construction:
   - last write wins: each `apply` takes a version; a call that is no longer the latest drops its result after the load (a slow skin that finishes last never paints), and reports `false`;
   - atomic: base CSS, palette sheet, root attributes, inline variables and font links are written in one synchronous step;
   - fixed order: the base `<style>` and the palette `<style>` are created together, base first, and only their text changes, never removed;
   - idempotent and cached: the skin already worn writes nothing, a base CSS loaded once commits synchronously;
   - a new document (an iframe that loaded) has a new applier and so gets the skin in force on its first apply.
   `applySkin(doc, id, config)` (preview frame, preview window) and `applyScopeSkin(source)` (catalog cards) both go through it; the ZIP's `custom-skin.css` is `skinSheets(…, "document").modes`.
3. **One registry.** The selector lists the registry skins and the project's Brand Skins (`ext.design.skins`). A Brand Skin made by Design and one imported in Settings are the same `BrandSkinRecord` written by the same `saveBrandSkin`: Settings import is `importedSkinRecord` (id `custom`, `source: "import"`; the same config again is no change, a different one is `revision + 1`, as a Design edit) and is selected like a new Design skin. Design edits an imported skin like its own.
4. **Compatible with the Stock / Magazine theme editor** (codegen-x/ui8kit `packages/theme-model`, the Theme sheet's Export / Import). Its export is format `magazine-theme` v2, which is already the Brand Skin's theme. Checked against `1d00f63`: the skin ids, radii, font ids and `THEME_SCHEMA` of the vendored model (`lib/theme/magazine/`) are equal to upstream's, and real exports of upstream's `toConfig` are the fixtures of `skin-registry.test.ts` (`fixtures/ui8kit-theme-exports.json`, made with bun from the upstream code).

   | Stock editor | BuildY |
   | --- | --- |
   | Export (`toConfig`, v2) | imports as a Brand Skin; Export gives back the same JSON |
   | stored `{ v: 1, theme }` (`stock:v1:theme`) | read by its `fromConfig`, written as v2 |
   | bare theme object (no `format`) | the same |
   | style preset, format 1 (Design system tab, "Copy preset": skin, font, radius, tokens) | the same; the preset's screen, fonts, pattern are not part of a theme |
   | `mode` | the skin's default mode; both modes are always rendered |
   | `palette: null` | a skin of the registry skin's own colours (both modes come from that skin) |
   | a value its reader drops (unknown skin, font, token) | an issue (`not_kept`), nothing is lost silently |

   Export (Settings, and `theme.json` in the ZIP) gives the chosen Brand Skin's config, whatever made it, as `JSON.stringify(config, null, 2)`.

## Consequences

- A switch, an edit of the active skin and a reload of the frame all end on the last skin chosen, in light and dark, for the preview, the catalog cards, the preview window and the ZIP.
- Tests: `skin-source.test.ts` (keys, sheets, wiring), `skin-registry.test.ts` (rapid switching and every arrival order of slow loads, fixed order, cached commit, fresh document, real Stock exports round trip, import → switch → export through the ZIP).
- `templ-code.ts` still receives a `CustomSkinRender` (the templ ZIP's `theme.css`); it writes the same `modeCss`. Folding it into `skinSheets` is left for when that file next changes.

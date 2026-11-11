# ADR 0025: Custom Skin, one imported Stock theme (magazine-theme v2)

Status: accepted (2026-11-11). Owner request t141u (plus t142u: preview only; t143u: compact, scrolling Settings).

## Context

The Stock theme editor of codegen-x/ui8kit (app.codegen-x.com, Theme > Export / import) keeps a whole site theme as
one JSON config, format `magazine-theme`, version 2 (`packages/theme-model/src/global-theme.ts`: `toConfig`,
`fromConfig`, `THEME_SCHEMA`). Every field:

| field | values | meaning |
| --- | --- | --- |
| `format`, `version` | `"magazine-theme"`, `2` | required |
| `mode` | `light` / `dark` | the app's mode (palette tokens differ per mode) |
| `skin` | one of 16 skins or null | the base skin, same CSS as the registry's `theme-<skin>` |
| `font`, `headingFont` | 11 taste fonts + 26 Google fonts, or null | `--font-sans`; `--taste-heading` / `--font-serif` |
| `radius` | 0, 4, 8, 12, 16 or null | `--radius` (px) |
| `tokens` | `radius-<badge/button/card/alert/media>` (radii), `density-<badge/button/card/alert>` (compact / default / comfortable), `shadow-<card/alert/media>` (none / sm / md) | `--radius-*`, `data-density-*` on the root, `--shadow-*`; kit.css reads them |
| `palette` | null or `{ harmony (9), h 0..359, s, l 0..100, contrast? "AAA" }` | rewrites primary / secondary / accent / ring / charts / sidebar colours and tints the skin's neutrals (lightness table from the skin CSS), WCAG AA or AAA pairs |
| `fontScale` | 80..120 step 5 (100 not stored) | `--text-*` |
| `fontWidth` | the font's wdth axis (only Roboto, Open Sans, IBM Plex Sans) | `font-stretch` |
| `fontWeight`, `headingWeight` | 300..700 | `font-weight`, `--taste-heading-weight` |
| `tracking` | -0.05..0.1 em | `--tracking-normal` |

There is a JSON Schema in code (`THEME_SCHEMA`, 2020-12, built from `FIELDS`) but no published file. `fromConfig` also
reads the stored shape `{ v: 1, theme }`, a bare theme and the old format-1 preset, and drops values it does not know
(listed in `dropped`). Stock applies a theme on `<html>`: `data-skin`, `data-density-*`, the inline variables of
`rootStyle`, the mode (`data-theme`, `.dark`, `color-scheme`), the Google fonts, plus two base rules of its app.css
(body on the type scale, h1-h3 in the heading font and weight).

## Decision

- **Port, not a new format.** `apps/chat-web/src/lib/theme/magazine/` is the Stock theme model ported from codegen-x
  afc826c (only imports changed; ids the model read from other packages are in `ids.ts`). The neutral lightness table
  is generated from the registry skin CSS (`npm run theme:neutrals`, checked by a test); it equals Stock's. A parity
  run over 4000 random configs against the original gave identical `fromConfig`, `rootStyle` (both modes),
  `rootAttrs`, `toConfig` and `THEME_SCHEMA`.
- **Strict import.** Settings > Theme import (file or paste) takes exactly `format: "magazine-theme"`, `version: 2`;
  the config is checked against Stock's own `THEME_SCHEMA` (unknown keys, values outside the lists, ranges, required)
  and then read by `fromConfig`; a value Stock would drop is an issue too (`not_kept`). Issues name a JSON Pointer and
  the allowed values (en / ru). A failing import changes nothing.
- **One slot.** The passing config is stored as `buildy:v1:customSkin` `{ v: 1, config }` (a bad stored value goes to
  quarantine). A new import replaces it; Remove empties it (a chat using it goes back to the default theme). Export
  writes Stock's own text (`JSON.stringify(config, null, 2)`): Stock export -> chat import -> chat export is byte-equal.
- **Custom Skin in the preset selector.** With a slot, the preview's skin list has "Custom Skin" (session `skin` =
  `custom`, allowed by the session schema's pattern; no contract change). A host without the slot shows the default
  theme, as the schema says for unknown skins.
- **Preview only (t142u).** The preview document gets theme-base + the base skin CSS, Stock's base rules, the root
  attributes and inline variables, the config's mode (the chat's mode no longer reaches the frame while it is on) and
  the font links. The chat UI document is never touched (skins.ts only writes the document it is given).
- **ZIP.** The base skin is the registry item `theme-<skin>` (as `npx ui8kit add theme-<skin>` writes it); index.html
  carries the root attributes, the inline variables, the fixed mode and the font links; `src/custom-skin.css` holds the
  base rules; `theme.json` is the config (re-importable in BuildY or Stock); manifest.json names it.
- **Fonts.** Stock self-hosts the taste fonts (`taste-<id>`); the chat loads the same faces from Google Fonts, so
  `--font-sans` names e.g. `Manrope` where Stock writes `taste-manrope`.

## Settings layout (t143u)

The Settings region is compact (xs text, py-1 rows) and scrolls on its own: the preferences block takes at most 3/4
of the sidebar height and the region inside it is `overflow-y-auto overscroll-contain`; the upper part of the sidebar
scrolls separately. Focused controls scroll into view natively.

The xs size is set on the region itself: app.css has an unlayered `button, input, textarea, select { font: inherit }`,
which beats a `text-xs` utility on the control (utilities live in a cascade layer), so the controls take the region's
size by inheritance. Measured live after 77f2e2a: every Settings button was 16px with `text-xs` on it.

## Open

- A published JSON Schema for magazine-theme v2 belongs in ui8kit/contract (generated from Stock's `THEME_SCHEMA`), and
  a session or prefs field could carry the slot inside the session file; not done here (the slot is browser-local).

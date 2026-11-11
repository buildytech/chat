// Ported from codegen-x/ui8kit afc826c packages/theme-model/src/global-theme.ts (Stock theme editor, format magazine-theme v2).
// Same logic and output as the original: only the imports changed (ids.ts holds the ids it read from other packages).
// The global theme: the one model of a site's design (Model), shared by the apps (moved from apps/magazine/src/lib; the Magazine
// and Stock read it by package name). One skin, font, default radius and per-element tokens for the whole site, from one place, on
// top of the defaults. Saved on this device under the app's own key (readTheme/writeTheme take it: the Magazine `magazine:v1:theme`,
// Stock `stock:v1:theme`); the light/dark mode is the app's own (`codegen-x-theme`, @ui8kit/app-shared runtime/theme) and is part of the model's fields and of the exported config.
// FIELDS below is the schema of every setting: the controller (global-theme.svelte.ts) writes them, and every view (the Theme sheet,
// its Design system panel, the style page's Design system tab) renders them; export/import (toConfig/fromConfig, format
// `magazine-theme` v2, THEME_SCHEMA) carries all of them.
//
// Precedence, from strongest:
//   1. a feed card's own design: every feed card shows a style (screen + skin + font + radius). The frame of a style sets its own
//      data-skin, --radius and fonts, and `.mg-shot`/`.mg-own` (magazine.css) reset the global per-element tokens at that boundary.
//   2. the global theme: data-skin, --radius, --font-sans and the tokens on the magazine root (.mg-root), inherited by the site chrome,
//      the sheets and the specimen. The style page shows its style with the global theme as its overrides (its Design system tab
//      edits this same theme), so the tab, the Theme sheet and the site always agree.
//   3. the defaults: the kit's own values (the sky skin of the app CSS, var(--radius), the spec's padding and shadow).
// The two layers are stored apart (the feed tune in the address, the global theme here): changing one never rewrites the other.
import { RADII, SKIN_IDS, THEME_FONT_IDS, themeHeadingWeight } from "./ids.ts";
import { cleanPalette, CONTRAST_LEVELS, HARMONIES, paletteStyle, type Palette } from "./palette.ts";
import { cleanHeadingWeight, cleanScale, cleanTracking, cleanWeight, cleanWidth, FONT_SCALES, FONT_WEIGHTS, TRACKINGS, typeStyle, widthAxis } from "./type.ts";
import { cleanTokens, DENSITIES, DENSITY_ELEMENTS, DENSITY_VARS, ELEMENT_SLOT, ELEMENTS, setToken, SHADOW_ELEMENTS, SHADOWS, tokenAttrs, tokenStyle, type Density, type Tokens } from "./design.ts";

/** palette: the custom colours of the colour wheel (palette.ts), with the skin's neutrals tinted by it; absent: the skin's own colours.
 *  fontScale: every text size in % (type.ts; absent: 100%); fontWidth: the font's Width axis in % (only for a font that has one;
 *  absent: the font's own width) */
export type GlobalTheme = { skin: string | null; font: string | null; headingFont: string | null; radius: number | null; tokens: Tokens; palette?: Palette; fontScale?: number; fontWidth?: number; fontWeight?: number; headingWeight?: number; tracking?: number };
export const NO_THEME: GlobalTheme = { skin: null, font: null, headingFont: null, radius: null, tokens: {} };

/** a theme from anything (storage, JSON): unknown values become null, unknown tokens are dropped */
export function cleanTheme(v: unknown): GlobalTheme {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const skin = typeof o.skin === "string" && (SKIN_IDS as readonly string[]).includes(o.skin) ? o.skin : null;
  const font = typeof o.font === "string" && (THEME_FONT_IDS as readonly string[]).includes(o.font) ? o.font : null;
  const headingFont = typeof o.headingFont === "string" && (THEME_FONT_IDS as readonly string[]).includes(o.headingFont) ? o.headingFont : null;
  const radius = typeof o.radius === "number" && (RADII as readonly number[]).includes(o.radius) ? o.radius : null;
  const palette = cleanPalette(o.palette);
  const fontScale = cleanScale(o.fontScale), fontWidth = cleanWidth(font, o.fontWidth);
  const fontWeight = cleanWeight(o.fontWeight), headingWeight = cleanHeadingWeight(o.headingWeight), tracking = cleanTracking(o.tracking);
  return { skin, font, headingFont, radius, tokens: cleanTokens(o.tokens), ...(palette ? { palette } : {}), ...(fontScale !== null ? { fontScale } : {}), ...(fontWidth !== null ? { fontWidth } : {}), ...(fontWeight !== null ? { fontWeight } : {}), ...(headingWeight !== null ? { headingWeight } : {}), ...(tracking !== null ? { tracking } : {}) };
}

/** a patch merged into a theme (every controller's setTheme): choosing a skin (any patch naming `skin`) returns to that skin's own
 *  colours, so it drops a custom palette unless the patch sets one itself; one rule for every view that picks a skin. Likewise
 *  choosing a font drops the width (each font has its own axis, or none); the scale stays. Undefined fields are removed. */
export function patchTheme(t: GlobalTheme, patch: Partial<GlobalTheme>): GlobalTheme {
  const next: GlobalTheme = { ...t, ...patch };
  if ("skin" in patch && !("palette" in patch)) delete next.palette;
  if ("font" in patch && !("fontWidth" in patch)) delete next.fontWidth;
  for (const k of ["palette", "fontScale", "fontWidth", "fontWeight", "headingWeight", "tracking"] as const) if (next[k] === undefined) delete next[k];
  return next;
}

export const isDefault = (t: GlobalTheme): boolean => t.skin === null && t.font === null && t.headingFont === null && t.radius === null && Object.keys(t.tokens).length === 0 && !t.palette && t.fontScale === undefined && t.fontWidth === undefined && t.fontWeight === undefined && t.headingWeight === undefined && t.tracking === undefined;

/** localStorage, or null where there is none or it is blocked (reading the property itself throws then) */
const local = (): Storage | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };

/** the theme saved under `key` (the app's own storage key) */
export function readTheme(key: string, store: Pick<Storage, "getItem"> | null = local()): GlobalTheme {
  try { const raw = store?.getItem(key); return raw ? cleanTheme((JSON.parse(raw) as { theme?: unknown }).theme) : NO_THEME; } catch { return NO_THEME; }
}
/** save the theme under `key`; the default theme is not stored (the key is removed) */
export function writeTheme(key: string, t: GlobalTheme, store: Pick<Storage, "setItem" | "removeItem"> | null = local()): void {
  try { if (isDefault(t)) store?.removeItem(key); else store?.setItem(key, JSON.stringify({ v: 1, theme: cleanTheme(t) })); } catch { /* storage blocked: this visit only */ }
}

/** one density for every element that has one ("default" clears them) */
export function setDensity(tokens: Tokens, d: Density): Tokens {
  return DENSITY_ELEMENTS.reduce((t, e) => setToken(t, "density-" + e, d === "default" ? null : d), tokens);
}
/** the density shared by every element, or null when they differ */
export function densityOf(tokens: Tokens): Density | null {
  const v = DENSITY_ELEMENTS.map((e) => (tokens["density-" + e] as Density | undefined) ?? "default");
  return v.every((x) => x === v[0]) ? v[0]! : null;
}
export { DENSITIES };

/** the CSS variables of the root: radius, the body and heading fonts, the per-element tokens, the custom palette's
 *  colour tokens for the app's mode now (they differ between light and dark), and the type scale (--text-*) and width (font-stretch) */
export function rootStyle(t: GlobalTheme, family: (id: string) => string, mode: "light" | "dark" = "light"): string {
  return [
    t.radius !== null ? `--radius:${t.radius}px` : "",
    t.font ? `--font-sans:${family(t.font)},sans-serif` : "",
    [t.headingFont ? `--taste-heading:${family(t.headingFont)},sans-serif;--font-serif:${family(t.headingFont)},sans-serif` : t.font ? `--taste-heading:${family(t.font)},sans-serif` : "", t.headingWeight === undefined && t.headingFont ? `--taste-heading-weight:${themeHeadingWeight(t.headingFont) ?? "var(--font-weight-semibold,600)"}` : ""].filter(Boolean).join(";"),
    tokenStyle(t.tokens),
    t.palette ? paletteStyle(t.palette, mode, t.skin) : "",
    typeStyle(t.fontScale ?? null, t.fontWidth ?? null, t.fontWeight ?? null, t.headingWeight ?? null, t.tracking ?? null),
  ].filter(Boolean).join(";");
}
/** the attributes of the root: the skin and the density attributes */
export function rootAttrs(t: GlobalTheme): Record<string, string> {
  return { ...(t.skin ? { "data-skin": t.skin } : {}), ...tokenAttrs(t.tokens) };
}

// ---- the schema of every setting (one entry per field of the model) ----

export const MODES = ["light", "dark"] as const;
export type Mode = (typeof MODES)[number];
export type FieldGroup = "site" | "radius" | "density" | "shadow";
export type FieldValue = string | number;
/** one setting: its id (the token key for per-element ones), its allowed values, where it is kept and what "not set" means */
export type Field = {
  id: string;
  group: FieldGroup;
  /** the element of a per-element token (badge, button, card, alert, media) */
  element?: string;
  values: readonly FieldValue[];
  /** false: the field always has one of its values (mode; density, whose "default" is its unset value) */
  nullable: boolean;
  /** the value shown when the theme does not set it */
  unset: FieldValue | null;
  /** where the value lives: the app's light/dark key, the theme object, or its tokens map */
  store: "mode" | "theme" | "tokens";
  /** a per-element token: the data-slot kit.css matches (the composition that carries it) and the CSS variables it ends in (description only) */
  slot?: string;
  css?: readonly string[];
};

export const FIELDS: readonly Field[] = [
  { id: "mode", group: "site", values: MODES, nullable: false, unset: null, store: "mode" },
  { id: "skin", group: "site", values: SKIN_IDS, nullable: true, unset: null, store: "theme" },
  { id: "font", group: "site", values: THEME_FONT_IDS, nullable: true, unset: null, store: "theme" },
  { id: "headingFont", group: "site", values: THEME_FONT_IDS, nullable: true, unset: null, store: "theme", css: ["--taste-heading", "--font-serif"] },
  { id: "radius", group: "site", values: RADII, nullable: true, unset: null, store: "theme" },
  ...ELEMENTS.map((e): Field => ({ id: "radius-" + e, group: "radius", element: e, values: RADII, nullable: true, unset: null, store: "tokens", slot: ELEMENT_SLOT[e], css: ["--radius-" + e] })),
  ...DENSITY_ELEMENTS.map((e): Field => ({ id: "density-" + e, group: "density", element: e, values: DENSITIES, nullable: false, unset: "default", store: "tokens", slot: ELEMENT_SLOT[e], css: DENSITY_VARS[e] })),
  ...SHADOW_ELEMENTS.map((e): Field => ({ id: "shadow-" + e, group: "shadow", element: e, values: SHADOWS, nullable: true, unset: null, store: "tokens", slot: ELEMENT_SLOT[e], css: ["--shadow-" + e] })),
];
export const FIELD_IDS: readonly string[] = FIELDS.map((f) => f.id);
export const fieldOf = (id: string): Field | undefined => FIELDS.find((f) => f.id === id);

/** the whole state the views show: the theme and the app's mode */
export type ThemeState = { mode: Mode; theme: GlobalTheme };

/** the value of one field (the field's `unset` when the theme does not set it) */
export function fieldValue(s: ThemeState, id: string): FieldValue | null {
  const f = fieldOf(id);
  if (!f) return null;
  if (f.store === "mode") return s.mode;
  if (f.store === "theme") return s.theme[id as "skin" | "font" | "headingFont" | "radius" | "fontWeight" | "headingWeight" | "tracking"] ?? f.unset;
  return s.theme.tokens[id] ?? f.unset;
}

/** set one field of the theme (mode is the app's, not the theme's: the controller handles it); an unknown value clears the field */
export function setThemeField(t: GlobalTheme, id: string, v: FieldValue | null): GlobalTheme {
  const f = fieldOf(id);
  if (!f || f.store === "mode") return t;
  const value = v !== null && f.values.includes(v) ? v : null;
  if (f.store === "theme") return cleanTheme(patchTheme(t, { [id]: value }));
  return { ...t, tokens: setToken(t.tokens, id, value) };
}

// ---- the views: the same fields, each view its own controls ----

/** sheet: the narrow Theme panel (selects, compact); design: the Design system panel of the Theme sheet (radio groups) */
export type ThemeView = "sheet" | "design";
export type Control = "radio" | "select";
const CONTROL: Record<ThemeView, (f: Field) => Control> = {
  sheet: (f) => (f.id === "mode" || f.id === "radius" ? "radio" : "select"),
  design: (f) => (f.id === "skin" || f.id === "font" || f.id === "headingFont" ? "select" : "radio"),
};
/** every field of the model, in order, with the control a view renders for it: both views cover every field */
export const viewFields = (view: ThemeView): Array<{ field: Field; control: Control }> => FIELDS.map((field) => ({ field, control: CONTROL[view](field) }));

// ---- export / import: one config with every field (the future external API reads and writes this) ----

export const CONFIG_FORMAT = "magazine-theme";
export const CONFIG_VERSION = 2;
export type ThemeConfig = { format: typeof CONFIG_FORMAT; version: typeof CONFIG_VERSION; mode: Mode; skin: string | null; font: string | null; headingFont: string | null; radius: number | null; tokens: Tokens; palette: Palette | null; fontScale?: number; fontWidth?: number; fontWeight?: number; headingWeight?: number; tracking?: number };
export type ImportResult = { ok: true; mode: Mode | null; theme: GlobalTheme; dropped: string[] } | { ok: false; error: string };

/** the config of a state: every field, unset ones as null (tokens: only the ones set; the type scale and width only when set) */
export function toConfig(s: ThemeState): ThemeConfig {
  const t = cleanTheme(s.theme);
  return { format: CONFIG_FORMAT, version: CONFIG_VERSION, mode: s.mode, skin: t.skin, font: t.font, headingFont: t.headingFont, radius: t.radius, tokens: t.tokens, palette: t.palette ?? null, ...(t.fontScale !== undefined ? { fontScale: t.fontScale } : {}), ...(t.fontWidth !== undefined ? { fontWidth: t.fontWidth } : {}), ...(t.fontWeight !== undefined ? { fontWeight: t.fontWeight } : {}), ...(t.headingWeight !== undefined ? { headingWeight: t.headingWeight } : {}), ...(t.tracking !== undefined ? { tracking: t.tracking } : {}) };
}

/**
 * a theme from a config: this format (v2), the stored shape (`{ v: 1, theme }`), a bare theme, or a style preset (format 1, the
 * Design system tab's "Copy preset": skin, font, radius, tokens). Fields not in the input are unset (an import replaces the theme);
 * a known field with an unknown value is dropped and named in `dropped`.
 */
export function fromConfig(input: unknown): ImportResult {
  let v = input;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return { ok: false, error: "not JSON" }; } }
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, error: "not an object" };
  let o = v as Record<string, unknown>;
  if (o.format !== undefined && o.format !== CONFIG_FORMAT && o.format !== 1) return { ok: false, error: "unknown format" };
  if (o.format === CONFIG_FORMAT && o.version !== CONFIG_VERSION) return { ok: false, error: "unknown version" };
  if (o.v === 1 && o.theme && typeof o.theme === "object") o = o.theme as Record<string, unknown>;
  const theme = cleanTheme(o);
  const mode = o.mode === "light" || o.mode === "dark" ? o.mode : null;
  const dropped: string[] = [];
  for (const k of ["skin", "font", "headingFont", "radius"] as const) if (o[k] !== undefined && o[k] !== null && theme[k] === null) dropped.push(k);
  if (o.mode !== undefined && o.mode !== null && mode === null) dropped.push("mode");
  if (o.palette !== undefined && o.palette !== null && !theme.palette) dropped.push("palette");
  // the defaults themselves (100%, the font's own width) are not dropped: they are what an absent field means
  if (o.fontScale !== undefined && o.fontScale !== null && o.fontScale !== 100 && theme.fontScale === undefined) dropped.push("fontScale");
  for (const k of ["fontWeight", "headingWeight", "tracking"] as const) if (o[k] !== undefined && o[k] !== null && theme[k] === undefined && !(k === "fontWeight" && o[k] === 400) && !(k === "tracking" && o[k] === 0)) dropped.push(k);
  if (o.fontWidth !== undefined && o.fontWidth !== null && theme.fontWidth === undefined && o.fontWidth !== widthAxis(theme.font)?.default) dropped.push("fontWidth");
  if (o.tokens && typeof o.tokens === "object" && !Array.isArray(o.tokens)) {
    for (const [k, x] of Object.entries(o.tokens as Record<string, unknown>)) if (!(k in theme.tokens) && !(k.startsWith("density-") && x === "default" && fieldOf(k))) dropped.push(k);
  } else if (o.tokens !== undefined && o.tokens !== null) dropped.push("tokens");
  return { ok: true, mode, theme, dropped };
}

/** JSON Schema (2020-12) of the config, made from FIELDS: what an external tool or API may send */
export const THEME_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "magazine-theme.v2.json",
  title: "Magazine theme",
  type: "object",
  required: ["format", "version"],
  additionalProperties: false,
  properties: {
    format: { const: CONFIG_FORMAT },
    version: { const: CONFIG_VERSION },
    ...Object.fromEntries(FIELDS.filter((f) => f.store !== "tokens").map((f) => [f.id, { enum: f.nullable ? [...f.values, null] : [...f.values] }])),
    palette: { type: ["object", "null"], required: ["harmony", "h", "s", "l"], additionalProperties: false, properties: { harmony: { enum: [...HARMONIES] }, h: { type: "number", minimum: 0, maximum: 359 }, s: { type: "number", minimum: 0, maximum: 100 }, l: { type: "number", minimum: 0, maximum: 100 }, contrast: { enum: [...CONTRAST_LEVELS] } } },
    fontScale: { enum: [...FONT_SCALES] },
    fontWidth: { type: "integer", minimum: 25, maximum: 300 },
    fontWeight: { enum: [...FONT_WEIGHTS] },
    headingWeight: { enum: [...FONT_WEIGHTS] },
    tracking: { enum: [...TRACKINGS] },
    tokens: { type: "object", additionalProperties: false, properties: Object.fromEntries(FIELDS.filter((f) => f.store === "tokens").map((f) => [f.id, { enum: [...f.values] }])) },
  },
} as const;

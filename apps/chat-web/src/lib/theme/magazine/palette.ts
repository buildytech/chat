// Ported from codegen-x/ui8kit afc826c packages/theme-model/src/palette.ts (Stock theme editor, format magazine-theme v2).
// Same logic and output as the original: only the imports changed (ids.ts holds the ids it read from other packages).
// The custom palette of the global theme: a colour wheel as in online palette editors (reference: htmlcolorcodes.com/color-wheel,
// reimplemented): one base colour (hue round the wheel, saturation from the centre out, lightness on the outer ring) and a harmony
// (the reference's six, plus monochromatic, and Adobe Color's double split complementary and compound) give the hues; turning the base turns them all, so their angles always hold.
// Only colour changes: the result rewrites the values of the skin's own shadcn tokens (--primary, --secondary, --accent, --ring,
// --chart-1..5 and their sidebar twins, with their -foreground pairs) in the skins' format `hsl(H S% L%)`, for the light and the
// dark mode. The neutrals (background, foreground, card, popover, muted, border, input and the sidebar's: NEUTRAL_TOKENS) follow
// as tinted neutrals: the palette's base hue at a low saturation, the skin's own lightness (skin-neutrals.ts). Destructive stays the
// skin's semantic colour; radius, fonts and spacing stay the skin's.
// Every -foreground pair is checked for the palette's contrast level (WCAG AA 4.5:1 by default, AAA 7:1 on request): the colour's
// lightness moves away from its text until it passes; every neutral text (foreground, muted-foreground, ...) moves away from its
// surfaces until it passes on each of them.

export const HARMONIES = ["monochromatic", "analogous", "complementary", "split", "triadic", "tetradic", "square", "double-split", "compound"] as const;
export type Harmony = (typeof HARMONIES)[number];
/** the hue offsets (degrees) of each harmony from the base colour; monochromatic: one hue, its shades and tints */
export const OFFSETS: Record<Harmony, readonly number[]> = {
  monochromatic: [0],
  analogous: [0, -30, 30],
  complementary: [0, 180],
  split: [0, 150, 210],
  triadic: [0, 120, 240],
  tetradic: [0, 60, 180, 240],
  square: [0, 90, 180, 270],
  // two complementary pairs 30° apart, an X on the wheel (Adobe Color: Double Split Complementary)
  "double-split": [0, 30, 180, 210],
  // the base, its two neighbours and two colours either side of its complement (Adobe Color: Compound; five colours)
  compound: [0, -30, 30, 165, 195],
};

/** well-known colour combinations as palettes (the harmony nearest to the pair's angle, the base hue, saturation and lightness of
 *  its main colour); the names are the panel's texts (PaletteText.presets), by id */
export const PRESETS: ReadonlyArray<{ id: string; palette: Palette }> = [
  { id: "blue-orange", palette: { harmony: "complementary", h: 215, s: 85, l: 45 } },
  { id: "red-green", palette: { harmony: "complementary", h: 355, s: 75, l: 45 } },
  { id: "yellow-violet", palette: { harmony: "complementary", h: 48, s: 90, l: 50 } },
  { id: "navy-gold", palette: { harmony: "complementary", h: 223, s: 80, l: 22 } },
  { id: "teal-amber", palette: { harmony: "split", h: 197, s: 65, l: 29 } },
  { id: "sage-terracotta", palette: { harmony: "tetradic", h: 15, s: 62, l: 47 } },
  { id: "butter-aubergine", palette: { harmony: "triadic", h: 290, s: 45, l: 30 } },
  { id: "blue-tan", palette: { harmony: "complementary", h: 212, s: 60, l: 38 } },
  { id: "mint-burgundy", palette: { harmony: "split", h: 345, s: 65, l: 32 } },
  { id: "pink-green", palette: { harmony: "complementary", h: 330, s: 70, l: 55 } },
  { id: "coral-turquoise", palette: { harmony: "compound", h: 10, s: 80, l: 60 } },
  { id: "rgb-triad", palette: { harmony: "triadic", h: 0, s: 80, l: 50 } },
  { id: "ocean", palette: { harmony: "analogous", h: 200, s: 70, l: 40 } },
  { id: "sunset", palette: { harmony: "analogous", h: 25, s: 90, l: 50 } },
  { id: "forest", palette: { harmony: "analogous", h: 130, s: 45, l: 32 } },
  { id: "lavender", palette: { harmony: "monochromatic", h: 265, s: 55, l: 55 } },
];
/** a palette is a preset's when every value matches */
export const samePalette = (a: Palette | null | undefined, b: Palette): boolean => !!a && a.harmony === b.harmony && a.h === b.h && a.s === b.s && a.l === b.l;
/** the lightness steps of a monochromatic harmony's markers (from the base lightness) */
export const MONO_STEPS = [0, -24, 24] as const;

/** the contrast the palette's text keeps (WCAG 2.x, normal text): AA 4.5:1, AAA 7:1 */
export const CONTRAST_LEVELS = ["AA", "AAA"] as const;
export type ContrastLevel = (typeof CONTRAST_LEVELS)[number];
/** contrast: absent is AA (palettes stored before the level existed read as AA; AA is not written) */
export type Palette = { harmony: Harmony; h: number; s: number; l: number; contrast?: "AAA" };
export const DEFAULT_PALETTE: Palette = { harmony: "analogous", h: 220, s: 80, l: 45 };
export type Mode = "light" | "dark";
export type Hsl = { h: number; s: number; l: number };

import { NEUTRAL_TOKENS, type NeutralToken } from "./neutral-tokens.ts";
import { SKIN_NEUTRALS, type Neutral } from "./skin-neutrals.ts";

export { NEUTRAL_TOKENS };
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const wrap = (h: number): number => ((h % 360) + 360) % 360;
const round1 = (v: number): number => Math.round(v * 10) / 10;

/** a palette from anything (storage, JSON); null when it is not one */
export function cleanPalette(v: unknown): Palette | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!(HARMONIES as readonly string[]).includes(o.harmony as string)) return null;
  const n = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const h = n(o.h), s = n(o.s), l = n(o.l);
  if (h === null || s === null || l === null) return null;
  return { harmony: o.harmony as Harmony, h: Math.round(wrap(h)), s: Math.round(clamp(s, 0, 100)), l: Math.round(clamp(l, 0, 100)), ...(o.contrast === "AAA" ? { contrast: "AAA" as const } : {}) };
}

/** the colours of the harmony's markers on the wheel (hue, saturation, lightness) */
export function harmonyColours(p: Palette): Hsl[] {
  if (p.harmony === "monochromatic") return MONO_STEPS.map((d) => ({ h: p.h, s: p.s, l: clamp(p.l + d, 8, 92) }));
  return OFFSETS[p.harmony].map((o) => ({ h: wrap(p.h + o), s: p.s, l: p.l }));
}

// ---- colour math (sRGB, WCAG 2 relative luminance) ----

export function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const S = s / 100, L = l / 100, k = (n: number) => (n + h / 30) % 12, a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}
export function luminance(c: Hsl): number {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hslToRgb(c).map(lin) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: Hsl, b: Hsl): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export const css = (c: Hsl): string => `hsl(${round1(c.h)} ${round1(c.s)}% ${round1(c.l)}%)`;

export const AA = 4.5;
export const AAA = 7;
export const contrastLevel = (p: Palette): ContrastLevel => p.contrast ?? "AA";
/** the ratio a palette's text pairs must reach */
export const targetRatio = (p: Palette): number => (p.contrast === "AAA" ? AAA : AA);
/** a palette at a contrast level (AA drops the field: the stored form of the default) */
export function withContrast(p: Palette, level: ContrastLevel): Palette {
  const { contrast: _, ...rest } = p;
  return level === "AAA" ? { ...rest, contrast: "AAA" } : rest;
}
/** a colour and the text on it: white or a deep tint of its own hue, whichever reads better; then the colour's lightness moves
 *  away from that text until the pair passes `ratio` (with a margin for the 1-decimal values) */
export function withForeground(bg: Hsl, ratio: number): { bg: Hsl; fg: Hsl } {
  const light: Hsl = { h: 0, s: 0, l: 100 };
  const dark: Hsl = { h: bg.h, s: Math.min(bg.s, 40), l: 10 };
  const fg = contrast(bg, light) >= contrast(bg, dark) ? light : dark;
  let c = { ...bg };
  const step = fg === light ? -1 : 1;
  while (contrast(c, fg) < ratio + 0.1 && c.l > 0 && c.l < 100) c = { ...c, l: clamp(c.l + step, 0, 100) };
  return { bg: c, fg };
}

/** the skin tokens the palette rewrites (the skins' own names): the colours, then the tinted neutrals */
export const PALETTE_TOKENS = [
  "primary", "primary-foreground", "secondary", "secondary-foreground", "accent", "accent-foreground", "ring",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
  "sidebar-primary", "sidebar-primary-foreground", "sidebar-accent", "sidebar-accent-foreground", "sidebar-ring",
  ...NEUTRAL_TOKENS,
] as const;
export type PaletteToken = (typeof PALETTE_TOKENS)[number];
/** the neutral texts and the surfaces each must read on (at the palette's contrast level) */
export const NEUTRAL_PAIRS: ReadonlyArray<readonly [NeutralToken, readonly NeutralToken[]]> = [
  ["foreground", ["background", "card", "popover"]],
  ["card-foreground", ["card"]],
  ["popover-foreground", ["popover"]],
  ["muted-foreground", ["background", "muted", "card"]],
  ["sidebar-foreground", ["sidebar"]],
];
const TEXTS = new Set<NeutralToken>(NEUTRAL_PAIRS.map(([t]) => t));
const LINES = new Set<NeutralToken>(["border", "input", "sidebar-border"]);

/** the neutral tokens of a skin (null: the kit's own theme) tinted by a palette: the base hue, a low saturation (surfaces 8%, text
 *  10%, lines 12%; monochromatic tints everything: 20/24/24%; never above the palette's own), the skin's lightness and alpha; then
 *  each text moves away from its surfaces until it passes the palette's contrast level on all of them */
export function neutralTokens(p: Palette, mode: Mode, skin: string | null): Record<NeutralToken, string> {
  const row = SKIN_NEUTRALS[skin ?? "default"];
  if (!row) throw new Error(`no neutral lightness for skin ${skin}: run \`bun run skin-neutrals\` in packages/theme-model`);
  const mono = p.harmony === "monochromatic";
  const sat = (t: NeutralToken): number => Math.min(p.s, TEXTS.has(t) ? (mono ? 24 : 10) : LINES.has(t) ? (mono ? 24 : 12) : mono ? 20 : 8);
  const values = new Map<NeutralToken, { c: Hsl; a: number | undefined }>(
    NEUTRAL_TOKENS.map((t, i) => { const v: Neutral = row[mode][i]!; return [t, { c: { h: p.h, s: sat(t), l: v[0] }, a: v[1] }]; }),
  );
  const get = (t: NeutralToken): Hsl => values.get(t)!.c;
  for (const [text, surfaces] of NEUTRAL_PAIRS) {
    let c = get(text);
    const bgs = surfaces.map(get);
    const up = c.l >= bgs.reduce((n, b) => n + b.l, 0) / bgs.length;
    const worst = (x: Hsl): number => Math.min(...bgs.map((b) => contrast(x, b)));
    while (worst(c) < targetRatio(p) + 0.1 && c.l > 0 && c.l < 100) c = { ...c, l: clamp(c.l + (up ? 1 : -1), 0, 100) };
    values.set(text, { c, a: undefined });
  }
  return Object.fromEntries(NEUTRAL_TOKENS.map((t) => {
    const { c, a } = values.get(t)!;
    return [t, a === undefined ? css(c) : `hsl(${round1(c.h)} ${round1(c.s)}% ${round1(c.l)}% / ${a})`];
  })) as Record<NeutralToken, string>;
}

/** the pairs a palette checks for its contrast level: the colour and its text */
export const FOREGROUND_PAIRS = [["primary", "primary-foreground"], ["secondary", "secondary-foreground"], ["accent", "accent-foreground"], ["sidebar-primary", "sidebar-primary-foreground"], ["sidebar-accent", "sidebar-accent-foreground"]] as const;

/** the token values (`hsl(H S% L%)`) of a palette in one mode over a skin (null: the kit's own theme) */
export function paletteTokens(p: Palette, mode: Mode, skin: string | null): Record<PaletteToken, string> {
  const dark = mode === "dark";
  const cs = harmonyColours(p);
  const at = (i: number): Hsl => cs[i % cs.length]!;
  // the base colour: its own lightness in light mode, mirrored above the middle in dark mode
  const base: Hsl = { h: p.h, s: p.s, l: dark ? Math.max(p.l, 100 - p.l) : p.l };
  const ratio = targetRatio(p);
  const primary = withForeground(base, ratio);
  // secondary and accent: quiet surfaces in the 2nd and 3rd colours of the harmony (tints in light mode, deep tones in dark)
  const surface = (c: Hsl, light: number, deep: number, sat: number): Hsl => ({ h: c.h, s: Math.min(c.s, sat), l: dark ? deep : light });
  const mono = p.harmony === "monochromatic";
  const secondary = withForeground(surface(at(1), mono ? 94 : 92, mono ? 18 : 22, 70), ratio);
  const accent = withForeground(surface(at(mono ? 2 : 2), mono ? 88 : 90, mono ? 26 : 28, 80), ratio);
  // the charts: every colour of the harmony at a readable middle lightness; shades of the hue fill the rest
  const mid = dark ? 62 : 52;
  const SHADES = [0, -14, 14, -24, 24];
  const chart = (i: number): string => {
    const n = mono ? 1 : cs.length;
    const c = at(i);
    const round = Math.floor(i / n);
    return css({ h: c.h, s: c.s, l: clamp((mono ? base.l : mid) + (mono ? SHADES[i]! : round === 0 ? 0 : SHADES[round * 2 - 1]!), 12, 88) });
  };
  return {
    primary: css(primary.bg), "primary-foreground": css(primary.fg),
    secondary: css(secondary.bg), "secondary-foreground": css(secondary.fg),
    accent: css(accent.bg), "accent-foreground": css(accent.fg),
    ring: css(primary.bg),
    "chart-1": chart(0), "chart-2": chart(1), "chart-3": chart(2), "chart-4": chart(3), "chart-5": chart(4),
    "sidebar-primary": css(primary.bg), "sidebar-primary-foreground": css(primary.fg),
    "sidebar-accent": css(accent.bg), "sidebar-accent-foreground": css(accent.fg),
    "sidebar-ring": css(primary.bg),
    ...neutralTokens(p, mode, skin),
  };
}

/** the CSS declarations of a palette in one mode (`--primary:hsl(...)`; ...), for the root's inline style */
export const paletteStyle = (p: Palette, mode: Mode, skin: string | null): string => Object.entries(paletteTokens(p, mode, skin)).map(([k, v]) => `--${k}:${v}`).join(";");

// ---- the wheel: angle and distance <-> hue and saturation ----

/** hue at the angle of a point from the wheel's centre: 0 at the top, clockwise */
export const hueAt = (dx: number, dy: number): number => Math.round(wrap((Math.atan2(dx, -dy) * 180) / Math.PI));
/** the position of a colour on a wheel of radius 1 (saturation 100 at the rim) */
export function wheelPoint(h: number, s: number): { x: number; y: number } {
  const a = (h * Math.PI) / 180, r = s / 100;
  return { x: Math.sin(a) * r, y: -Math.cos(a) * r };
}
/** the base hue that puts marker `i` (its offset) under the pointer: dragging any marker turns the whole harmony */
export const baseHueFor = (p: Palette, i: number, pointerHue: number): number => Math.round(wrap(pointerHue - (OFFSETS[p.harmony][i] ?? 0)));

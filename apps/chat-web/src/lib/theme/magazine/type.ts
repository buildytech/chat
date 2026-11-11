// Ported from codegen-x/ui8kit afc826c packages/theme-model/src/type.ts (Stock theme editor, format magazine-theme v2).
// Same logic and output as the original: only the imports changed (ids.ts holds the ids it read from other packages).
// The fine type controls of the global theme (the Fonts panel's header): size, width, weight and tracking.
// Scale: one percentage for every text size (80..120% in 5% steps; 100% is the kit's own scale and is not stored). It rewrites
// Tailwind's --text-* theme variables on the theme root (every text-* utility and every kit recipe reads them; line heights are
// ratios of the size and follow), never the root font size, so every rem of spacing (the 8 + 4 grid) stays as it is. Google Fonts
// has no size gradation to follow: its type tester is a free pixel slider; the steps here are the usual 5% of type-scale tools.
// Width: the font's Width axis (wdth, @ui8kit/taste-data/font-ids FONT_WIDTH, from Google Fonts' metadata), as font-stretch on the
// root, shown and kept only for a font that has the axis, in whole percents inside its range; its default is not stored.
import { FONT_WIDTH, type FontId, type WidthAxis } from "./ids.ts";

export const FONT_SCALES = [80, 85, 90, 95, 100, 105, 110, 115, 120] as const;
export const SCALE_STEP = 5;
export const DEFAULT_SCALE = 100;

export const FONT_WEIGHTS = [300, 400, 500, 600, 700] as const;
export const DEFAULT_FONT_WEIGHT = 400;
export const TRACKINGS = [-0.05, -0.025, 0, 0.025, 0.05, 0.075, 0.1] as const;
export const TRACKING_STEP = 0.025;
export const DEFAULT_TRACKING = 0;

/** Tailwind's type scale (tailwindcss/theme.css --text-*, rem); the test reads the file, so it cannot drift */
export const TEXT_SIZES = {
  xs: 0.75, sm: 0.875, base: 1, lg: 1.125, xl: 1.25, "2xl": 1.5, "3xl": 1.875, "4xl": 2.25, "5xl": 3, "6xl": 3.75, "7xl": 4.5, "8xl": 6, "9xl": 8,
} as const;

/** the Width axis of a font (null: the default font, or a font without one) */
export const widthAxis = (font: string | null): WidthAxis | null => (font ? FONT_WIDTH[font as FontId] ?? null : null);

/** a stored scale: one of the steps other than 100, else null */
export const cleanScale = (v: unknown): number | null => (typeof v === "number" && v !== DEFAULT_SCALE && (FONT_SCALES as readonly number[]).includes(v) ? v : null);
/** a stored width for a font: a whole percent inside its axis other than the default, else null */
export function cleanWidth(font: string | null, v: unknown): number | null {
  const a = widthAxis(font);
  return a && typeof v === "number" && Number.isInteger(v) && v >= a.min && v <= a.max && v !== a.default ? v : null;
}
/** body weight: 400 is the inherited default; a face without the chosen cut uses its closest face (or synthesis) */
export const cleanWeight = (v: unknown): number | null => (typeof v === "number" && v !== DEFAULT_FONT_WEIGHT && (FONT_WEIGHTS as readonly number[]).includes(v) ? v : null);
/** heading weight has no single default: the selected face's metadata or the skin supplies it */
export const cleanHeadingWeight = (v: unknown): number | null => (typeof v === "number" && (FONT_WEIGHTS as readonly number[]).includes(v) ? v : null);
/** base tracking in em, including negative steps; zero leaves the skin's own --tracking-normal */
export const cleanTracking = (v: unknown): number | null => (typeof v === "number" && v !== DEFAULT_TRACKING && (TRACKINGS as readonly number[]).includes(v) ? v : null);

const r4 = (v: number): number => Math.round(v * 1e4) / 1e4;
/** the declarations of the root for a scale and a width (empty at the defaults) */
export function typeStyle(scale: number | null, width: number | null, weight: number | null = null, headingWeight: number | null = null, tracking: number | null = null): string {
  return [
    scale !== null ? Object.entries(TEXT_SIZES).map(([k, rem]) => `--text-${k}:${r4((rem * scale) / 100)}rem`).join(";") : "",
    width !== null ? `font-stretch:${width}%` : "",
    weight !== null ? `font-weight:${weight}` : "",
    headingWeight !== null ? `--taste-heading-weight:${headingWeight}` : "",
    tracking !== null ? `--tracking-normal:${tracking}em` : "",
  ].filter(Boolean).join(";");
}

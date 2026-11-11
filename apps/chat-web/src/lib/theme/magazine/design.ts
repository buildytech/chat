// Ported from codegen-x/ui8kit afc826c packages/theme-model/src/design.ts (the token part; effective/withTokens of the style playground are not ported) (Stock theme editor, format magazine-theme v2).
// Same logic and output as the original: only the imports changed (ids.ts holds the ids it read from other packages).
// The Design system playground as pure functions: the overrides (skin, font, radius) on top of a style's own parts give the effective
// design, whether it differs from the style, and the key "Save as collection item" would create. The per-element tokens (kit CSS, UI8KIT-2.0 §11)
// are a second, flat map: only the keys that differ from the style's own values, so `{}` means "nothing changed". They are CSS variables and
// data attributes on a wrapper, never part of the style key.
import { RADII } from "./ids.ts";

export const ELEMENTS = ["badge", "button", "card", "alert", "media"] as const;
export const SHADOW_ELEMENTS = ["card", "alert", "media"] as const;
export const DENSITY_ELEMENTS = ["badge", "button", "card", "alert"] as const;
export const DENSITIES = ["compact", "default", "comfortable"] as const;
export const SHADOWS = ["none", "sm", "md"] as const;
/**
 * where kit.css (UI8KIT-2.0 §11) reads each element's tokens: the data-slot of the composition that carries them (Badge, Button, Card,
 * Alert: `fixed["data-slot"]` in packages/kit-compose/src/map.ts; media: pattern.media-frame) and the CSS variables a radius, shadow
 * or density token ends in (a density token is the attribute `data-density-<element>`, which sets these variables).
 */
export const ELEMENT_SLOT = { badge: "badge", button: "button", card: "card", alert: "alert", media: "media-frame" } as const satisfies Record<(typeof ELEMENTS)[number], string>;
export const DENSITY_VARS = { badge: ["--pad-badge", "--h-badge"], button: ["--pad-button", "--h-button"], card: ["--pad-card"], alert: ["--pad-alert", "--min-alert"] } as const satisfies Record<(typeof DENSITY_ELEMENTS)[number], readonly string[]>;
export type Density = (typeof DENSITIES)[number];
export type Shadow = (typeof SHADOWS)[number];
/** `radius-card`: 16, `density-button`: "comfortable", `shadow-card`: "sm" (only changed keys; absent = the style's own) */
export type Tokens = Record<string, number | string>;

const RADIUS_KEYS = ELEMENTS.map((e) => "radius-" + e);
const DENSITY_KEYS = DENSITY_ELEMENTS.map((e) => "density-" + e);
const SHADOW_KEYS = SHADOW_ELEMENTS.map((e) => "shadow-" + e);
/** the value a shadow position writes: the shared scale of the skin (var(--shadow-sm), var(--shadow-md)), or no shadow */
const SHADOW_VALUE: Record<Shadow, string> = { none: "0 0 #0000", sm: "var(--shadow-sm)", md: "var(--shadow-md)" };

const valid = (k: string, v: unknown): boolean =>
  RADIUS_KEYS.includes(k) ? typeof v === "number" && (RADII as readonly number[]).includes(v)
  : DENSITY_KEYS.includes(k) ? typeof v === "string" && v !== "default" && (DENSITIES as readonly string[]).includes(v)
  : SHADOW_KEYS.includes(k) ? typeof v === "string" && (SHADOWS as readonly string[]).includes(v)
  : false;

/** keep only known keys with a known, non-default value (density "default" is the style's own, so it is not stored) */
export function cleanTokens(t: unknown): Tokens {
  const out: Tokens = {};
  if (!t || typeof t !== "object" || Array.isArray(t)) return out;
  for (const k of [...RADIUS_KEYS, ...DENSITY_KEYS, ...SHADOW_KEYS]) {
    const v = (t as Record<string, unknown>)[k];
    if (valid(k, v)) out[k] = v as number | string;
  }
  return out;
}

/** set one key; null (or density "default") removes it, so the map holds only what differs */
export function setToken(t: Tokens, key: string, value: number | string | null): Tokens {
  const next = { ...t };
  delete next[key];
  return value === null ? cleanTokens(next) : cleanTokens({ ...next, [key]: value });
}

/** the CSS variables of the tokens, for the `style` attribute of a wrapper (`--radius-card:16px;--shadow-card:var(--shadow-sm)`) */
export function tokenStyle(t: Tokens): string {
  const c = cleanTokens(t);
  return Object.entries(c).flatMap(([k, v]) => {
    if (k.startsWith("radius-")) return [`--${k}:${v}px`];
    if (k.startsWith("shadow-")) return [`--${k}:${SHADOW_VALUE[v as Shadow]}`];
    return [];
  }).join(";");
}

/** the density attributes of the tokens (`data-density-card="comfortable"`), spread on the same wrapper */
export function tokenAttrs(t: Tokens): Record<string, string> {
  const c = cleanTokens(t);
  return Object.fromEntries(Object.entries(c).filter(([k]) => k.startsWith("density-")).map(([k, v]) => ["data-" + k, String(v)]));
}

// Ported from codegen-x/ui8kit afc826c packages/theme-model/src/neutral-tokens.ts (Stock theme editor, format magazine-theme v2).
// Same logic and output as the original: only the imports changed (ids.ts holds the ids it read from other packages).
// The neutral tokens of a skin (its surfaces, their text, the lines): a custom palette tints them with its own hue at a low
// saturation and keeps the skin's lightness (palette.ts paletteTokens; the lightness table: skin-neutrals.ts, generated from the
// skin CSS by scripts/skin-neutrals.ts). Destructive is not one of them: it stays the skin's semantic colour.
export const NEUTRAL_TOKENS = [
  "background", "foreground", "card", "card-foreground", "popover", "popover-foreground", "muted", "muted-foreground",
  "border", "input", "sidebar", "sidebar-foreground", "sidebar-border",
] as const;
export type NeutralToken = (typeof NEUTRAL_TOKENS)[number];

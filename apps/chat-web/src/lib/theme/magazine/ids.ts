// Ids the Stock theme model reads from other codegen-x/ui8kit packages, copied at afc826c:
// SKIN_IDS, RADII (packages/taste-data/src/taste.ts), FONT_IDS, FONT_WIDTH (packages/taste-data/src/font-ids.ts),
// GOOGLE_FONTS, THEME_FONT_IDS, themeHeadingWeight (packages/shared/app/src/runtime/theme-fonts.ts, generated there by
// compose-gen) and SKIN_FONTS (packages/shared/app/src/runtime/skin-fonts.ts, from the skins' skins.json).
// One difference: Stock self-hosts the taste fonts (FONT_IDS, family `taste-<id>`); the chat preview and the exported
// site load the same faces from Google Fonts (SELF_HOSTED below), so `themeFamily` names the Google family for them.

/** the skins of the kit: sky + the 14 tweakcn presets + rose (the chat registry's theme-<skin> items, same CSS) */
export const SKIN_IDS = [
  "sky", "modern-minimal", "violet-bloom", "t3-chat", "bubblegum", "doom-64", "amber-minimal", "supabase",
  "kodama-grove", "perpetuity", "cosmic-night", "claude", "mocha-mousse", "neo-brutalism", "notebook", "rose",
] as const;
export type SkinId = (typeof SKIN_IDS)[number];

/** corner radius in px, written to --radius */
export const RADII = [0, 4, 8, 12, 16] as const;
export type Radius = (typeof RADII)[number];

export const FONT_IDS = [
  "inter", "roboto", "manrope", "montserrat", "rubik", "nunito", "ibm-plex-sans", "golos-text", "onest", "open-sans", "istok-web",
] as const;
export type FontId = (typeof FONT_IDS)[number];

/** the Width axis (wdth, %) of the fonts that have one */
export type WidthAxis = { min: number; max: number; default: number };
export const FONT_WIDTH: Partial<Record<FontId, WidthAxis>> = {
  roboto: { min: 75, max: 100, default: 100 },
  "open-sans": { min: 75, max: 100, default: 100 },
  "ibm-plex-sans": { min: 75, max: 100, default: 100 },
};

export const GOOGLE_FONTS: Record<string, { family: string; google: string; headingWeight?: number }> = {
  "andika": { family: "Andika", google: "Andika:wght@400;700" },
  "architects-daughter": { family: "Architects Daughter", google: "Architects+Daughter:wght@400" },
  "comfortaa": { family: "Comfortaa", google: "Comfortaa:wght@400;500;600;700" },
  "didact-gothic": { family: "Didact Gothic", google: "Didact+Gothic:wght@400" },
  "dm-sans": { family: "DM Sans", google: "DM+Sans:wght@400;500;600;700" },
  "gabriela": { family: "Gabriela", google: "Gabriela:wght@400" },
  "geologica": { family: "Geologica", google: "Geologica:wght@400;500;600;700" },
  "google-sans": { family: "Google Sans", google: "Google+Sans:wght@400;500;700" },
  "great-vibes": { family: "Great Vibes", google: "Great+Vibes:wght@400" },
  "inter": { family: "Inter", google: "Inter:wght@400;500;600;700" },
  "istok-web": { family: "Istok Web", google: "Istok+Web:ital,wght@0,400;0,700;1,400;1,700" },
  "kurale": { family: "Kurale", google: "Kurale:wght@400" },
  "marmelad": { family: "Marmelad", google: "Marmelad:wght@400" },
  "merriweather": { family: "Merriweather", google: "Merriweather:wght@400;500;600;700" },
  "montserrat-alternates": { family: "Montserrat Alternates", google: "Montserrat+Alternates:wght@400;500;600;700" },
  "nunito-sans": { family: "Nunito Sans", google: "Nunito+Sans:wght@400;500;600;700" },
  "nunito": { family: "Nunito", google: "Nunito:wght@400;500;600;700" },
  "outfit": { family: "Outfit", google: "Outfit:wght@400;500;600;700" },
  "oxanium": { family: "Oxanium", google: "Oxanium:wght@400;500;600;700" },
  "pacifico": { family: "Pacifico", google: "Pacifico:wght@400", headingWeight: 300 },
  "plus-jakarta-sans": { family: "Plus Jakarta Sans", google: "Plus+Jakarta+Sans:wght@400;500;600;700" },
  "poppins": { family: "Poppins", google: "Poppins:wght@400;500;600;700" },
  "source-code-pro": { family: "Source Code Pro", google: "Source+Code+Pro:wght@400;500;600;700" },
  "tenor-sans": { family: "Tenor Sans", google: "Tenor+Sans:wght@400" },
  "ubuntu-sans": { family: "Ubuntu Sans", google: "Ubuntu+Sans:wght@400;500;600;700" },
  "ysabeau-office": { family: "Ysabeau Office", google: "Ysabeau+Office:wght@400;500;600;700" },
};
export const THEME_FONT_IDS = [...new Set([...FONT_IDS, ...Object.keys(GOOGLE_FONTS)])] as const;

/** the taste fonts Stock self-hosts and that GOOGLE_FONTS does not list: the same faces from Google Fonts here */
export const SELF_HOSTED: Record<string, { family: string; google: string }> = {
  "roboto": { family: "Roboto", google: "Roboto:wdth,wght@75..100,300..700" },
  "manrope": { family: "Manrope", google: "Manrope:wght@300;400;500;600;700" },
  "montserrat": { family: "Montserrat", google: "Montserrat:wght@300;400;500;600;700" },
  "rubik": { family: "Rubik", google: "Rubik:wght@300;400;500;600;700" },
  "ibm-plex-sans": { family: "IBM Plex Sans", google: "IBM+Plex+Sans:wdth,wght@85..100,300..700" },
  "golos-text": { family: "Golos Text", google: "Golos+Text:wght@400;500;600;700" },
  "onest": { family: "Onest", google: "Onest:wght@300;400;500;600;700" },
  "open-sans": { family: "Open Sans", google: "Open+Sans:wdth,wght@75..100,300..700" },
};
export const themeFamily = (id: string): string => GOOGLE_FONTS[id]?.family ?? SELF_HOSTED[id]?.family ?? `taste-${id}`;
export const themeHeadingWeight = (id: string | null): number | null => id ? GOOGLE_FONTS[id]?.headingWeight ?? null : null;
/** the Google css2 spec of a theme font (null: unknown) */
export const themeFontSpec = (id: string): string | null => GOOGLE_FONTS[id]?.google ?? SELF_HOSTED[id]?.google ?? null;

// The Google fonts a skin needs (family:axes for the css2 API); the default skin uses the system font.
export const SKIN_FONTS: Record<string, readonly string[]> = {
  "sky": ["Istok+Web:ital,wght@0,400;0,700;1,400;1,700"],
  "modern-minimal": ["Inter:wght@400;500;600;700"],
  "violet-bloom": ["Plus+Jakarta+Sans:wght@400;500;600;700"],
  "bubblegum": ["Poppins:wght@400;500;600;700"],
  "doom-64": ["Oxanium:wght@400;500;600;700"],
  "amber-minimal": ["Inter:wght@400;500;600;700"],
  "supabase": ["Outfit:wght@400;500;600;700"],
  "kodama-grove": ["Merriweather:wght@400;500;600;700"],
  "perpetuity": ["Source+Code+Pro:wght@400;500;600;700"],
  "cosmic-night": ["Inter:wght@400;500;600;700"],
  "mocha-mousse": ["DM+Sans:wght@400;500;600;700"],
  "neo-brutalism": ["DM+Sans:wght@400;500;600;700"],
  "notebook": ["Architects+Daughter:wght@400"],
  "rose": ["Pacifico:wght@400","Nunito:wght@400;500;600;700"],
};

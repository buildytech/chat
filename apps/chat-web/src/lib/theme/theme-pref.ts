/**
 * The chat UI theme choice (ADR 0026). Pure: the chat shell's own light / dark mode, never the preview's skin.
 * "system" follows prefers-color-scheme; an absent or unknown stored value is "system".
 */
export type ThemePref = "system" | "dark" | "light";
export type ThemeMode = "dark" | "light";

export const THEME_PREFS: readonly ThemePref[] = ["system", "dark", "light"];

export function parseThemePref(raw: unknown): ThemePref {
	return raw === "dark" || raw === "light" || raw === "system" ? raw : "system";
}

export function resolveThemeMode(pref: ThemePref, systemDark: boolean): ThemeMode {
	if (pref === "system") return systemDark ? "dark" : "light";
	return pref;
}

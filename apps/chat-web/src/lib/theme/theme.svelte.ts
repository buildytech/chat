import { STORAGE_KEYS, readKey, writeKey } from "../browser/storage-v1.ts";
import { parseThemePref, resolveThemeMode, type ThemeMode, type ThemePref } from "./theme-pref.ts";

/** The resolved mode (session file `settings.theme`, read by /preview). */
export const THEME_KEY = STORAGE_KEYS.theme;
/** The choice in Settings (ADR 0026): system | dark | light, default system. */
export const THEME_PREF_KEY = STORAGE_KEYS.themePref;

const QUERY = "(prefers-color-scheme: dark)";

function systemDark(): boolean {
	return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
}

/** The chat document only: the preview frame gets its mode from PreviewPane, never these tokens. */
function apply(mode: ThemeMode) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.classList.toggle("dark", mode === "dark");
	root.dataset.theme = mode;
	root.style.colorScheme = mode;
	writeKey(THEME_KEY, mode);
}

export function createTheme() {
	let pref = $state<ThemePref>("system");
	let mode = $state<ThemeMode>("light");
	let listening = false;

	function update() {
		mode = resolveThemeMode(pref, systemDark());
		apply(mode);
	}

	function listen() {
		if (listening || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
		listening = true;
		window.matchMedia(QUERY).addEventListener("change", () => {
			if (pref === "system") update();
		});
	}

	function init() {
		if (typeof document === "undefined") return;
		pref = parseThemePref(readKey(THEME_PREF_KEY));
		update();
		listen();
	}

	function setPref(next: ThemePref) {
		pref = next;
		writeKey(THEME_PREF_KEY, next);
		update();
	}

	/** The Night Mode switch: an explicit choice, the opposite of what shows now. */
	function toggle() {
		setPref(mode === "dark" ? "light" : "dark");
	}

	return {
		get pref() {
			return pref;
		},
		get mode() {
			return mode;
		},
		get isDark() {
			return mode === "dark";
		},
		init,
		setPref,
		toggle
	};
}

export const theme = createTheme();

import { STORAGE_KEYS, readKey, writeKey } from "../browser/storage-v1.ts";

export const THEME_KEY = STORAGE_KEYS.theme;

function readInitial(): "light" | "dark" {
	if (typeof document === "undefined") return "light";
	const stored = readKey(THEME_KEY);
	if (stored === "dark" || stored === "light") return stored;
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(mode: "light" | "dark") {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.classList.toggle("dark", mode === "dark");
	root.dataset.theme = mode;
	root.style.colorScheme = mode;
	writeKey(THEME_KEY, mode);
}

export function createTheme() {
	let mode = $state<"light" | "dark">("light");

	function init() {
		mode = readInitial();
		apply(mode);
	}

	function toggle() {
		mode = mode === "dark" ? "light" : "dark";
		apply(mode);
	}

	return {
		get mode() {
			return mode;
		},
		get isDark() {
			return mode === "dark";
		},
		init,
		toggle
	};
}

export const theme = createTheme();

const STORAGE_KEY = "buildytech-chat-theme";

function readInitial(): "light" | "dark" {
	if (typeof document === "undefined") return "light";
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === "dark" || stored === "light") return stored;
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(mode: "light" | "dark") {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.classList.toggle("dark", mode === "dark");
	root.dataset.theme = mode;
	root.style.colorScheme = mode;
	localStorage.setItem(STORAGE_KEY, mode);
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

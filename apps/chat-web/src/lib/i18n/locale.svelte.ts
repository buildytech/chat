/**
 * The chat shell language (Settings). Stored in this browser only (`buildy:v1:locale`).
 * The page locale and the exported site stay on their own field.
 */
import { STORAGE_KEYS, readKey, writeKey } from "../browser/storage-v1.ts";
import { parseLocale, type UiLocale } from "./locale-pref.ts";

export const LOCALE_KEY = STORAGE_KEYS.locale;

function apply(lang: UiLocale) {
	if (typeof document === "undefined") return;
	document.documentElement.lang = lang;
}

function createLocale() {
	let current = $state<UiLocale>("en");
	let listening = false;

	function listen() {
		if (listening || typeof window === "undefined") return;
		listening = true;
		window.addEventListener("storage", (event) => {
			if (event.key !== LOCALE_KEY) return;
			current = parseLocale(event.newValue);
			apply(current);
		});
	}

	function init() {
		current = parseLocale(readKey(LOCALE_KEY));
		apply(current);
		listen();
	}

	function set(next: UiLocale) {
		current = next;
		writeKey(LOCALE_KEY, next);
		apply(next);
	}

	return {
		get current() {
			return current;
		},
		init,
		set
	};
}

export const uiLocale = createLocale();

if (typeof document !== "undefined") uiLocale.init();

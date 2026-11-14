/**
 * `buildy:v1:prefs` on any Storage-like object (ADR 0017). Pure, no Svelte. Reads the stored prefs (the layout of the
 * previous key `buildy:v1:layout` is an old key: set aside by storage-v1, ADR 0045). Unreadable text is quarantined
 * (never dropped) and the shell starts from the defaults.
 */
import { STORAGE_KEYS, quarantine, type StorageLike } from "../browser/storage-v1.ts";
import { defaultLayout, parsePrefsText, type LayoutPrefs } from "./prefs.ts";

export function loadLayout(store: StorageLike | null): LayoutPrefs {
	if (!store) return defaultLayout();
	const text = store.getItem(STORAGE_KEYS.prefs);
	const parsed = parsePrefsText(text);
	if (parsed) return parsed.layout;
	if (text != null) {
		quarantine(store, { key: STORAGE_KEYS.prefs, reason: "prefs_unreadable", raw: text });
		store.removeItem(STORAGE_KEYS.prefs);
	}
	return defaultLayout();
}

/** Write the layout; false when the browser refused (the caller keeps going with the in-memory layout). */
export function saveLayout(store: StorageLike | null, layout: LayoutPrefs): boolean {
	if (!store) return false;
	const text = JSON.stringify({ layout });
	try {
		store.setItem(STORAGE_KEYS.prefs, text);
		return store.getItem(STORAGE_KEYS.prefs) === text;
	} catch {
		return false;
	}
}

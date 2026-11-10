/**
 * `buildy:v1:prefs` on any Storage-like object (ADR 0017). Pure, no Svelte. Reads the stored prefs; when there are
 * none, moves the layout of the previous key `buildy:v1:layout` once (written, read back, then the old key removed).
 * Unreadable text is quarantined (never dropped) and the shell starts from the defaults.
 */
import { STORAGE_KEYS, quarantine, type StorageLike } from "../browser/storage-v1.ts";
import { defaultLayout, layoutFromLegacy, parsePrefsText, type LayoutPrefs } from "./prefs.ts";

export function loadLayout(store: StorageLike | null): LayoutPrefs {
	if (!store) return defaultLayout();
	const text = store.getItem(STORAGE_KEYS.prefs);
	const parsed = parsePrefsText(text);
	if (parsed) return parsed.layout;
	if (text != null) {
		quarantine(store, { key: STORAGE_KEYS.prefs, reason: "prefs_unreadable", raw: text });
		store.removeItem(STORAGE_KEYS.prefs);
	}
	const legacy = store.getItem(STORAGE_KEYS.layout);
	if (legacy == null) return defaultLayout();
	let layout = defaultLayout();
	try {
		layout = layoutFromLegacy(JSON.parse(legacy));
	} catch {
		quarantine(store, { key: STORAGE_KEYS.layout, reason: "layout_unreadable", raw: legacy });
	}
	if (saveLayout(store, layout)) store.removeItem(STORAGE_KEYS.layout);
	return layout;
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

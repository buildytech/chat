/**
 * The buildy:v1 key space of this browser (ADR 0015). Every BuildY value in localStorage lives under `buildy:v1:*`.
 * Keys of builds before buildy:v1 are not read any more (ADR 0045): a value under one is kept in quarantine as
 * `old_storage_key` and the key is removed, once, so nothing is lost and nothing is loaded silently.
 *
 * Quarantine (`buildy:v1:quarantine`): values that could not be loaded (corrupt JSON, a chat or page record the
 * session schema rejects, an old key, a chat replaced by an import) are kept there as raw text with the reason,
 * instead of being dropped. Pure, no Svelte; works on any Storage-like object.
 */

export const STORAGE_KEYS = {
	sessions: "buildy:v1:sessions",
	pages: "buildy:v1:pages",
	selectedSessionId: "buildy:v1:selectedSessionId",
	/** Layout preferences (ADR 0017): `{ layout }`, session file `prefs`. */
	prefs: "buildy:v1:prefs",
	/** The resolved light / dark mode of the chat UI (session file settings.theme; /preview follows it). */
	theme: "buildy:v1:theme",
	/** The chat UI theme choice (ADR 0026): "system" | "dark" | "light"; absent = system. */
	themePref: "buildy:v1:themePref",
	/** Chat UI language: "en" | "ru"; absent = en. Not the page locale. */
	locale: "buildy:v1:locale",
	previewHideServiceLabels: "buildy:v1:preview.hideServiceLabels",
	/** The one imported theme (Settings > Theme import, ADR 0025): `{ v: 1, config }`, config = magazine-theme v2. */
	customSkin: "buildy:v1:customSkin",
	/** Left panel tab, Blocks feed view and inspector slide-over open (ADR 0024): `{ tab, columns, inspector }`. */
	feed: "buildy:v1:feed",
	quarantine: "buildy:v1:quarantine"
} as const;

/** Keys of earlier builds (before buildy:v1, and `buildy:v1:layout` before the prefs key, ADR 0017). Never read: see `quarantineOldKeys`. */
const OLD_STORAGE_KEYS = [
	"buildytech-chat-sessions",
	"buildytech-creator-pages-v1",
	"buildy.creator.selectedSessionId",
	"buildy.creator.layout",
	"buildytech-chat-theme",
	"buildy:v1:layout"
] as const;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type QuarantineEntry = { at: string; key: string; reason: string; path?: string; raw: string };

/** The quarantined values, oldest first. A broken quarantine blob is returned as one entry (never thrown away). */
export function readQuarantine(store: StorageLike): QuarantineEntry[] {
	const raw = store.getItem(STORAGE_KEYS.quarantine);
	if (raw == null) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed as QuarantineEntry[];
	} catch {
		/* fall through */
	}
	return [{ at: new Date(0).toISOString(), key: STORAGE_KEYS.quarantine, reason: "corrupt_quarantine", raw }];
}

/** Keep a value that could not be loaded. Returns false when the browser refused the write (the caller keeps the source). */
export function quarantine(store: StorageLike, entry: Omit<QuarantineEntry, "at"> & { at?: string }): boolean {
	const list = readQuarantine(store);
	list.push({ at: entry.at ?? new Date().toISOString(), key: entry.key, reason: entry.reason, ...(entry.path ? { path: entry.path } : {}), raw: entry.raw });
	try {
		store.setItem(STORAGE_KEYS.quarantine, JSON.stringify(list));
		return true;
	} catch {
		return false;
	}
}

/**
 * Old keys leave localStorage: each value goes to quarantine first (reason `old_storage_key`), then its key is removed;
 * a refused quarantine write leaves the key in place (retried on the next load). The retired counter marker is dropped.
 * Returns the keys it set aside.
 */
export function quarantineOldKeys(store: StorageLike): string[] {
	const kept: string[] = [];
	for (const key of OLD_STORAGE_KEYS) {
		try {
			const raw = store.getItem(key);
			if (raw == null) continue;
			if (!quarantine(store, { key, reason: "old_storage_key", raw })) continue;
			store.removeItem(key);
			kept.push(key);
		} catch {
			/* retried on the next load */
		}
	}
	try {
		store.removeItem("buildy:v1:migration");
	} catch {
		/* informational only */
	}
	return kept;
}

let checkedOldKeys = false;

/** The browser's localStorage after the old keys are set aside, or null when storage is unavailable. */
export function browserStorage(): Storage | null {
	try {
		if (typeof localStorage === "undefined") return null;
		const store = localStorage;
		if (!checkedOldKeys) {
			checkedOldKeys = true;
			quarantineOldKeys(store);
		}
		return store;
	} catch {
		return null;
	}
}

/** What this browser quarantined (Settings > Quarantine): never loaded, never thrown away. */
export function browserQuarantine(): QuarantineEntry[] {
	try {
		const store = browserStorage();
		return store ? readQuarantine(store) : [];
	} catch {
		return [];
	}
}

/** Read one buildy:v1 key. Null when absent or storage is unavailable. */
export function readKey(key: string): string | null {
	try {
		return browserStorage()?.getItem(key) ?? null;
	} catch {
		return null;
	}
}

/** Write one buildy:v1 preference key; preferences are best effort (no error surface). */
export function writeKey(key: string, value: string | null): void {
	try {
		const store = browserStorage();
		if (!store) return;
		if (value == null) store.removeItem(key);
		else store.setItem(key, value);
	} catch {
		/* nonsecret preference only */
	}
}

/**
 * The buildy:v1 key space of this browser (ADR 0015). Every BuildY value in localStorage lives under `buildy:v1:*`.
 * Older builds wrote other keys; `migrateLegacyStorage` moves them once (copy, read back, then remove the old key).
 * It is idempotent: a second run finds no legacy key and writes nothing. When both keys exist with different values,
 * the new key wins and the legacy value goes to quarantine, so nothing is lost.
 *
 * Quarantine (`buildy:v1:quarantine`): values that could not be loaded (corrupt JSON, a chat or page record the
 * session schema rejects, a legacy conflict, a chat replaced by an import) are kept there as raw text with the reason,
 * instead of being dropped. Pure, no Svelte; works on any Storage-like object.
 */

import { MIGRATION_KEY, noteMigrationHit, readMarker, startMigrationCounters } from "./migration-counters.ts";

export const STORAGE_KEYS = {
	sessions: "buildy:v1:sessions",
	pages: "buildy:v1:pages",
	selectedSessionId: "buildy:v1:selectedSessionId",
	/** Before ADR 0017; moved once into prefs.layout by creator-layout.svelte.ts. */
	layout: "buildy:v1:layout",
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
	migration: MIGRATION_KEY,
	quarantine: "buildy:v1:quarantine"
} as const;

/** Keys of earlier builds and the buildy:v1 key each one moves to (a module adds its own with `registerLegacyKey`, before the first storage access). */
export const LEGACY_STORAGE_KEYS: Record<string, string> = {
	"buildytech-chat-sessions": STORAGE_KEYS.sessions,
	"buildytech-creator-pages-v1": STORAGE_KEYS.pages,
	"buildy.creator.selectedSessionId": STORAGE_KEYS.selectedSessionId,
	"buildy.creator.layout": STORAGE_KEYS.layout,
	"buildytech-chat-theme": STORAGE_KEYS.theme
};

/** A module's key of an earlier build moves to its buildy:v1 key with the others (the loader registers modules before the first storage access). */
export function registerLegacyKey(legacy: string, current: string): void {
	LEGACY_STORAGE_KEYS[legacy] = current;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type QuarantineEntry = { at: string; key: string; reason: string; path?: string; raw: string };

export type MigrationReport = { moved: string[]; same: string[]; conflicts: string[]; failed: string[] };

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
 * One-time move of the legacy keys into buildy:v1. Copy, read back, then remove the legacy key; a refused write
 * leaves the legacy key in place (retried on the next load). Writes the migration marker only when it moved something.
 */
export function migrateLegacyStorage(store: StorageLike, now: () => string = () => new Date().toISOString()): MigrationReport {
	const report: MigrationReport = { moved: [], same: [], conflicts: [], failed: [] };
	for (const [legacy, next] of Object.entries(LEGACY_STORAGE_KEYS)) {
		const old = store.getItem(legacy);
		if (old == null) continue;
		const current = store.getItem(next);
		try {
			if (current == null) {
				store.setItem(next, old);
				if (store.getItem(next) !== old) {
					report.failed.push(legacy);
					continue;
				}
				report.moved.push(legacy);
			} else if (current === old) {
				report.same.push(legacy);
			} else {
				if (!quarantine(store, { key: legacy, reason: "legacy_conflict", raw: old, at: now() })) {
					report.failed.push(legacy);
					continue;
				}
				report.conflicts.push(legacy);
			}
			store.removeItem(legacy);
		} catch {
			report.failed.push(legacy);
		}
	}
	if (report.moved.length || report.conflicts.length || report.same.length) {
		try {
			store.setItem(STORAGE_KEYS.migration, JSON.stringify({ ...readMarker(store), version: 1, at: now(), ...report }));
		} catch {
			/* the marker is informational only */
		}
	}
	return report;
}

let migrated = false;

/** The browser's localStorage after the one-time migration, or null when storage is unavailable. */
export function browserStorage(): Storage | null {
	try {
		if (typeof localStorage === "undefined") return null;
		const store = localStorage;
		if (!migrated) {
			migrated = true;
			const report = migrateLegacyStorage(store);
			startMigrationCounters(store);
			noteMigrationHit(store, "legacyKeys", report.moved.length + report.conflicts.length);
		}
		return store;
	} catch {
		return null;
	}
}

/** Count a hit of an old-data path in the migration marker (`window.buildy.migrationReport()`); never throws. */
export function noteMigration(path: import("./migration-counters.ts").MigrationPath, n = 1): void {
	try {
		const store = browserStorage();
		if (store) noteMigrationHit(store, path, n);
	} catch {
		/* informational only */
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

/** Read one buildy:v1 key (after the migration). Null when absent or storage is unavailable. */
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

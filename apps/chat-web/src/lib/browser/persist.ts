/**
 * Browser-local persistence for chats and per-session pages.
 * Existing `buildytech-chat-sessions` array is kept as-is (forward-compatible fields only).
 * Pages live in a separate versioned key so older clients never mis-parse a wrapper.
 */

import { isScenarioId, type ScenarioId } from "@buildytech/builder-core";

export const SESSIONS_KEY = "buildytech-chat-sessions";
export const PAGES_KEY = "buildytech-creator-pages-v1";
export const PAGES_VERSION = 1 as const;

export type PersistErrorCode = "unavailable" | "quota" | "corrupt";

export type PersistError = {
	code: PersistErrorCode;
	message: string;
};

export type StoredPageProvenance = {
	screenId: string | null;
	scenarioId: ScenarioId | null;
	missing: string[];
	assembler?: string;
};

export type StoredPageRecord = {
	applied: unknown | null;
	candidate: unknown | null;
	appliedProvenance?: StoredPageProvenance | null;
	candidateProvenance?: StoredPageProvenance | null;
	selectedBlockId: string | null;
	revision: number | null;
};

const STOCK_NOTE = /^Stock screen (screen\.[A-Za-z0-9._/-]+)$/;

function recordedId(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
	return trimmed;
}

function inferScreenIdFromUnknown(page: unknown): string | null {
	if (!page || typeof page !== "object") return null;
	const layout = (page as { layout?: { blocks?: unknown } }).layout;
	const stack = Array.isArray(layout?.blocks) ? [...layout.blocks] : [];
	while (stack.length) {
		const node = stack.pop();
		if (!node || typeof node !== "object") continue;
		const rec = node as { copy?: { note?: unknown }; children?: unknown };
		const note = rec.copy?.note;
		if (typeof note === "string") {
			const hit = note.match(STOCK_NOTE);
			if (hit?.[1]) return hit[1];
		}
		if (Array.isArray(rec.children)) stack.push(...rec.children);
	}
	return null;
}

function normalizeProvenance(raw: unknown, page: unknown): StoredPageProvenance | null {
	if (page == null && raw == null) return null;
	const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
	return {
		screenId: recordedId(rec?.screenId) ?? inferScreenIdFromUnknown(page),
		scenarioId: isScenarioId(rec?.scenarioId) ? rec.scenarioId : null,
		missing: Array.isArray(rec?.missing) ? rec.missing.filter((row): row is string => typeof row === "string") : [],
		assembler: typeof rec?.assembler === "string" ? rec.assembler : undefined
	};
}

/** Old blobs stored pages without sibling provenance. Infer Stock id from CTA note; else recorded absence. */
export function migrateStoredPageRecord(record: StoredPageRecord): StoredPageRecord {
	const appliedProvenance = normalizeProvenance(record.appliedProvenance, record.applied);
	const candidateProvenance = record.candidate
		? (normalizeProvenance(record.candidateProvenance, record.candidate) ?? appliedProvenance)
		: null;
	return { ...record, appliedProvenance, candidateProvenance };
}

type PagesBlobV1 = {
	version: typeof PAGES_VERSION;
	pages: Record<string, StoredPageRecord>;
};

let lastError: PersistError | null = null;
const frozenKeys = new Set<string>();

export function getPersistError(): PersistError | null {
	return lastError;
}

export function clearPersistError(): void {
	lastError = null;
	frozenKeys.clear();
}

/** After an explicit in-app confirm, later writes may replace a corrupt blob. */
export function allowPersistOverwrite(): void {
	frozenKeys.clear();
	if (lastError?.code === "corrupt") lastError = null;
}

function remember(code: PersistErrorCode, message: string): void {
	lastError = { code, message };
}

function storage(): Storage | null {
	try {
		if (typeof localStorage === "undefined") return null;
		const probe = localStorage;
		void probe.getItem(SESSIONS_KEY);
		return probe;
	} catch {
		remember("unavailable", "This browser is not saving chats. Work in this tab only.");
		return null;
	}
}

function isQuota(err: unknown): boolean {
	if (!err || typeof err !== "object") return false;
	const rec = err as { name?: string; code?: number };
	return rec.name === "QuotaExceededError" || rec.code === 22;
}

function writeJson(key: string, value: unknown): boolean {
	const store = storage();
	if (!store) return false;
	if (frozenKeys.has(key)) {
		remember("corrupt", "Saved data could not be read. Existing data was left untouched.");
		return false;
	}
	try {
		store.setItem(key, JSON.stringify(value));
		if (lastError?.code === "quota") lastError = null;
		return true;
	} catch (err) {
		if (isQuota(err)) {
			remember("quota", "This browser ran out of local storage. The last change is in this tab only until you free space.");
			return false;
		}
		remember("unavailable", "This browser is not saving chats. Work in this tab only.");
		return false;
	}
}

export function loadSessionsJson(): unknown {
	const store = storage();
	if (!store) return [];
	const raw = store.getItem(SESSIONS_KEY);
	if (raw == null) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed;
		if (parsed && typeof parsed === "object" && Array.isArray((parsed as { sessions?: unknown }).sessions)) {
			return (parsed as { sessions: unknown[] }).sessions;
		}
		remember("corrupt", "Saved chats could not be read. Existing data was left untouched.");
		frozenKeys.add(SESSIONS_KEY);
		return [];
	} catch {
		remember("corrupt", "Saved chats could not be read. Existing data was left untouched.");
		frozenKeys.add(SESSIONS_KEY);
		return [];
	}
}

export function saveSessionsJson(sessions: unknown): boolean {
	return writeJson(SESSIONS_KEY, sessions);
}

function emptyBlob(): PagesBlobV1 {
	return { version: PAGES_VERSION, pages: {} };
}

export function loadPagesBlob(): PagesBlobV1 {
	const store = storage();
	if (!store) return emptyBlob();
	const raw = store.getItem(PAGES_KEY);
	if (raw == null) return emptyBlob();
	try {
		const parsed = JSON.parse(raw) as PagesBlobV1;
		if (!parsed || parsed.version !== PAGES_VERSION || typeof parsed.pages !== "object" || parsed.pages == null) {
			remember("corrupt", "Saved pages could not be read. Existing data was left untouched.");
			frozenKeys.add(PAGES_KEY);
			return emptyBlob();
		}
		return { version: PAGES_VERSION, pages: parsed.pages };
	} catch {
		remember("corrupt", "Saved pages could not be read. Existing data was left untouched.");
		frozenKeys.add(PAGES_KEY);
		return emptyBlob();
	}
}

export function readSessionPages(sessionId: string): StoredPageRecord | null {
	const rec = loadPagesBlob().pages[sessionId];
	if (!rec) return null;
	return migrateStoredPageRecord(rec);
}

export function writeSessionPages(sessionId: string, record: StoredPageRecord): boolean {
	const blob = loadPagesBlob();
	blob.pages[sessionId] = record;
	return writeJson(PAGES_KEY, blob);
}

export function deleteSessionPages(sessionId: string): boolean {
	const blob = loadPagesBlob();
	if (!(sessionId in blob.pages)) return true;
	delete blob.pages[sessionId];
	return writeJson(PAGES_KEY, blob);
}

export function clearPagesBlob(): boolean {
	return writeJson(PAGES_KEY, emptyBlob());
}

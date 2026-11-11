/**
 * Browser-local persistence for chats and per-session pages under the buildy:v1 key space (ADR 0015): chats in
 * `buildy:v1:sessions`, page records in `buildy:v1:pages` (page-spec/v1 store blob). Both are validated at load against
 * the session profile buildy:v1 (`session.schema.json#/$defs/session`) and page-spec/v1 (`#/$defs/record`); a value
 * that fails goes to quarantine (`buildy:v1:quarantine`) with its reason and the rest loads. Nothing is dropped silently.
 */

import { isPageFamily, isScenarioId, type PageFamily, type ScenarioId } from "@buildytech/builder-core";
import { pageSpecDefIssues } from "@buildytech/page-contract";
import { sessionDefIssues } from "@buildytech/page-contract/session";
import { STORAGE_KEYS, browserStorage, quarantine, type StorageLike } from "./storage-v1.ts";

export const SESSIONS_KEY = STORAGE_KEYS.sessions;
export const PAGES_KEY = STORAGE_KEYS.pages;
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
	/** page-spec 1.4.0 (ADR 0027): the advisory screen family, derived after every operation unless pinned. */
	family?: PageFamily | null;
	familyPinned?: boolean;
};

export type StoredPageRecord = {
	applied: unknown | null;
	candidate: unknown | null;
	appliedProvenance?: StoredPageProvenance | null;
	candidateProvenance?: StoredPageProvenance | null;
	selectedBlockId: string | null;
	revision: number | null;
	/**
	 * Last proposed page in this chat, kept after Discard so a follow-up turn
	 * ("add a sidebar") edits it instead of rebuilding from scratch.
	 */
	lastProposed?: unknown | null;
	lastProposedProvenance?: StoredPageProvenance | null;
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
		assembler: typeof rec?.assembler === "string" ? rec.assembler : undefined,
		...(isPageFamily(rec?.family) ? { family: rec.family } : {}),
		...(rec?.familyPinned === true ? { familyPinned: true } : {})
	};
}

/** Old blobs stored pages without sibling provenance. Infer Stock id from CTA note; else recorded absence. */
export function migrateStoredPageRecord(record: StoredPageRecord): StoredPageRecord {
	const appliedProvenance = normalizeProvenance(record.appliedProvenance, record.applied);
	const candidateProvenance = record.candidate
		? (normalizeProvenance(record.candidateProvenance, record.candidate) ?? appliedProvenance)
		: null;
	const lastProposedProvenance = record.lastProposed
		? normalizeProvenance(record.lastProposedProvenance, record.lastProposed)
		: null;
	return { ...record, appliedProvenance, candidateProvenance, lastProposed: record.lastProposed ?? null, lastProposedProvenance };
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

let storeOverride: StorageLike | null = null;
/** Raw text this tab validated or wrote per key: validation runs once per value, not on every keystroke save. */
const trusted = new Map<string, string>();

/** Tests: run the store against an in-memory Storage. */
export function useStorageForTests(store: StorageLike | null): void {
	storeOverride = store;
	lastError = null;
	frozenKeys.clear();
	trusted.clear();
}

function storage(): StorageLike | null {
	if (storeOverride) return storeOverride;
	try {
		const probe = browserStorage();
		if (!probe) throw new Error("unavailable");
		void probe.getItem(SESSIONS_KEY);
		return probe;
	} catch {
		remember("unavailable", "This browser is not saving chats. Work in this tab only.");
		return null;
	}
}

const QUARANTINED = "Some saved data did not pass the session schema and was moved to quarantine (buildy:v1:quarantine). Everything else loaded.";

/** Keep an unreadable value in quarantine. If even that write is refused, freeze the key so it is never overwritten. */
function keepAside(store: StorageLike, key: string, reason: string, raw: string, path?: string): boolean {
	if (quarantine(store, { key, reason, raw, path })) {
		remember("corrupt", QUARANTINED);
		return true;
	}
	remember("corrupt", "Saved data could not be read. Existing data was left untouched.");
	frozenKeys.add(key);
	return false;
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
		const text = JSON.stringify(value);
		store.setItem(key, text);
		trusted.set(key, text);
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

/**
 * Chats of this browser, each validated against session.schema.json#/$defs/session. A chat that fails is moved to
 * quarantine and the list is rewritten without it; an unreadable blob is quarantined whole.
 */
export function loadSessionsJson(): unknown[] {
	const store = storage();
	if (!store) return [];
	const raw = store.getItem(SESSIONS_KEY);
	if (raw == null) return [];
	let list: unknown[] | null = null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (Array.isArray(parsed)) list = parsed;
		else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { sessions?: unknown }).sessions)) {
			list = (parsed as { sessions: unknown[] }).sessions;
		}
	} catch {
		list = null;
	}
	if (!list) {
		if (keepAside(store, SESSIONS_KEY, "corrupt", raw)) writeRaw(store, SESSIONS_KEY, "[]");
		return [];
	}
	if (trusted.get(SESSIONS_KEY) === raw) return list;
	const valid: unknown[] = [];
	let rewrite = false;
	list.forEach((entry, i) => {
		const item = repairSession(entry);
		if (item !== entry) rewrite = true;
		const issues = sessionDefIssues(item, "session");
		if (!issues.length) {
			valid.push(item);
			return;
		}
		const first = issues[0]!;
		if (keepAside(store, SESSIONS_KEY, `session_invalid:${first.keyword}`, JSON.stringify(item), `$[${i}]${first.path.slice(1)}`)) rewrite = true;
		else valid.push(item);
	});
	if (rewrite) writeRaw(store, SESSIONS_KEY, JSON.stringify(valid));
	else trusted.set(SESSIONS_KEY, raw);
	return valid;
}

/**
 * Known fixes applied before validation. 2026-11-11 (one day on staging): "Start page from this screen" wrote
 * `proposal.origin: "feed-screen"`, which the session schema does not allow; the field is dropped (the proposal is
 * an ordinary program proposal) so those chats load instead of going to quarantine. Identity when nothing changes.
 */
export function repairSession(item: unknown): unknown {
	const rec = item as { messages?: Array<{ proposal?: { origin?: unknown } }> } | null;
	if (!rec || !Array.isArray(rec.messages) || !rec.messages.some((m) => m?.proposal?.origin === "feed-screen")) return item;
	return {
		...rec,
		messages: rec.messages.map((m) => {
			if (m?.proposal?.origin !== "feed-screen") return m;
			const { origin: _origin, ...proposal } = m.proposal;
			return { ...m, proposal };
		})
	};
}

function writeRaw(store: StorageLike, key: string, value: string): void {
	try {
		store.setItem(key, value);
		trusted.set(key, value);
	} catch {
		/* the quarantined copy is safe; the next load retries */
	}
}

export function saveSessionsJson(sessions: unknown): boolean {
	return writeJson(SESSIONS_KEY, sessions);
}

function emptyBlob(): PagesBlobV1 {
	return { version: PAGES_VERSION, pages: {} };
}

/**
 * The page store blob. Each chat's record is validated against page-spec.schema.json#/$defs/record (after the legacy
 * provenance migration); a record that fails goes to quarantine and the blob is rewritten without it.
 */
export function loadPagesBlob(): PagesBlobV1 {
	const store = storage();
	if (!store) return emptyBlob();
	const raw = store.getItem(PAGES_KEY);
	if (raw == null) return emptyBlob();
	let parsed: PagesBlobV1 | null = null;
	try {
		parsed = JSON.parse(raw) as PagesBlobV1;
	} catch {
		parsed = null;
	}
	if (!parsed || parsed.version !== PAGES_VERSION || typeof parsed.pages !== "object" || parsed.pages == null || Array.isArray(parsed.pages)) {
		if (keepAside(store, PAGES_KEY, "corrupt", raw)) writeRaw(store, PAGES_KEY, JSON.stringify(emptyBlob()));
		return emptyBlob();
	}
	if (trusted.get(PAGES_KEY) === raw) return { version: PAGES_VERSION, pages: parsed.pages };
	const pages: Record<string, StoredPageRecord> = {};
	let dropped = false;
	for (const [id, record] of Object.entries(parsed.pages)) {
		const issues = record && typeof record === "object" ? pageSpecDefIssues(JSON.parse(JSON.stringify(migrateStoredPageRecord(record))), "record") : [{ path: "$", keyword: "type" }];
		if (!issues.length) {
			pages[id] = record;
			continue;
		}
		const first = issues[0]!;
		if (keepAside(store, PAGES_KEY, `page_record_invalid:${first.keyword}`, JSON.stringify(record), `$.pages.${id}${first.path.slice(1)}`)) dropped = true;
		else pages[id] = record;
	}
	if (dropped) writeRaw(store, PAGES_KEY, JSON.stringify({ version: PAGES_VERSION, pages }));
	else trusted.set(PAGES_KEY, raw);
	return { version: PAGES_VERSION, pages };
}

/** Keep a value aside in quarantine (e.g. a chat an import replaces). False when the browser refused the write. */
export function quarantineValue(key: string, reason: string, raw: string): boolean {
	const store = storage();
	return store ? quarantine(store, { key, reason, raw }) : false;
}

/** Write every page record at once (import). */
export function writeAllSessionPages(records: Record<string, StoredPageRecord>): boolean {
	const blob = loadPagesBlob();
	Object.assign(blob.pages, records);
	return writeJson(PAGES_KEY, blob);
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

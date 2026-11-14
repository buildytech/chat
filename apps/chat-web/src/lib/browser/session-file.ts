/**
 * Portable session file buildy:v1 (ADR 0015, https://schema.buildy.tw/session.schema.json): build it from the browser
 * stores, parse and check one before an import, and keep session.pageRevision / history in step with the page store.
 * Pure: no Svelte, no storage. Lab BuildY opens the same file (its importer reads `sessions[]`).
 */
import {
	SESSION_FORMAT,
	SESSION_MAX_HISTORY,
	SESSION_SCHEMA_URL,
	sessionFileIssues,
	sessionProgramIssues,
	type SessionRevisionEntry
} from "@buildytech/page-contract/session";
import { migrateStoredPageRecord, type StoredPageRecord } from "./persist.ts";

export type SessionPins = {
	stock: { repo: string; contentCommit: string };
	registry: { url: string; sourceCommit: string };
	catalogDigest?: string;
};
export type SessionApp = { name: string; version: string; host: "browser" | "desktop" | "wordpress"; commit?: string };
/** Layout preferences (session 1.2.0 `prefs`, `buildy:v1:prefs`; ADR 0017). */
export type SessionPrefs = { layout?: Record<string, number | boolean> };
export type SessionSettings = { theme?: "light" | "dark"; selectedModelId?: string; previewHideServiceLabels?: boolean };

/** The project a stored session works on: its `projectId`, else its own id (every file before session 1.9.0). */
export function projectIdOf(chat: { id: string; projectId?: string }): string {
	return chat.projectId ?? chat.id;
}

/** A session as the stores keep it: the project part, plus the optional chat extension (the page record lives in the page store). */
export type StoredChat = {
	id: string;
	/** session 1.9.0: the project of the session (its page record is keyed by it); absent: `id`. */
	projectId?: string;
	pageRevision?: number | null;
	pageId?: string;
	history?: SessionRevisionEntry[];
	[key: string]: unknown;
};

export type SessionFileChat = StoredChat & { page: StoredPageRecord | null };

export type SessionFile = {
	$schema: string;
	format: typeof SESSION_FORMAT;
	exportedAt: string;
	app: SessionApp;
	pins: SessionPins;
	selectedSessionId: string | null;
	sessions: SessionFileChat[];
	settings?: SessionSettings;
	prefs?: SessionPrefs;
};

export type SessionFileIssue = { path: string; keyword: string };
/** Old-data paths a parsed file went through (migration counters, `window.buildy.migrationReport()`). */
export type SessionFileLegacy = { pageV1: number; proposalApplied: number };
export type ParsedSessionFile =
	| { ok: true; file: SessionFile; legacy: SessionFileLegacy }
	| { ok: false; code: "invalid_json" | "schema_invalid" | "program_invalid"; issues: SessionFileIssue[] };

/** JSON round trip: drops `undefined` and functions so the file is exactly what JSON.stringify would write. */
function plain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/** The revision of a chat's applied page (the page store is the source of truth). */
function revisionOf(record: StoredPageRecord | null | undefined): number | null {
	if (!record || !record.applied) return null;
	return typeof record.revision === "number" ? record.revision : 1;
}

/** session.pageRevision equal to its page record's revision; returns the same object when nothing changes. */
export function reconcileChatRevision<T extends StoredChat>(chat: T, record: StoredPageRecord | null | undefined): T {
	if (record === undefined) return chat;
	const revision = revisionOf(record);
	if ((chat.pageRevision ?? null) === revision) return chat;
	return { ...chat, pageRevision: revision };
}

/** Record one page revision on the chat: pageRevision, pageId and one history entry (last SESSION_MAX_HISTORY kept). */
export function recordRevision<T extends StoredChat>(chat: T, entry: SessionRevisionEntry): T {
	const history = [...(chat.history ?? []), plain(entry)].slice(-SESSION_MAX_HISTORY);
	return { ...chat, pageRevision: entry.revision, pageId: entry.pageId ?? chat.pageId, history };
}

/** The page record as it goes into the file (null when the chat has none). */
function fileRecord(record: StoredPageRecord | null | undefined): StoredPageRecord | null {
	if (!record) return null;
	return plain({ ...record, revision: revisionOf(record) });
}

export function buildSessionFile(input: {
	chats: StoredChat[];
	pages: Record<string, StoredPageRecord | null | undefined>;
	selectedSessionId: string | null;
	app: SessionApp;
	pins: SessionPins;
	settings?: SessionSettings;
	prefs?: SessionPrefs;
	now?: string;
}): SessionFile {
	const sessions = input.chats.map((chat) => {
		const page = fileRecord(input.pages[projectIdOf(chat)]);
		const synced = reconcileChatRevision(chat, page ?? null);
		return plain({ ...synced, page });
	});
	const ids = new Set(sessions.map((s) => s.id));
	return {
		$schema: SESSION_SCHEMA_URL,
		format: SESSION_FORMAT,
		exportedAt: input.now ?? new Date().toISOString(),
		app: plain(input.app),
		pins: plain(input.pins),
		selectedSessionId: input.selectedSessionId && ids.has(input.selectedSessionId) ? input.selectedSessionId : null,
		sessions,
		...(input.settings ? { settings: plain(input.settings) } : {}),
		...(input.prefs ? { prefs: plain(input.prefs) } : {})
	};
}

/** Parse and check a session file: JSON, then session.schema.json, then its program checks. Nothing is written. */
export function parseSessionFile(input: unknown): ParsedSessionFile {
	let value: unknown = input;
	if (typeof input === "string") {
		try {
			value = JSON.parse(input);
		} catch {
			return { ok: false, code: "invalid_json", issues: [{ path: "$", keyword: "json" }] };
		}
	}
	const issues = sessionFileIssues(value);
	if (issues.length) return { ok: false, code: "schema_invalid", issues: issues.slice(0, 20) };
	const legacy = legacyOf(value as SessionFile);
	const file = migrateSessionFile(value as SessionFile);
	const program = sessionProgramIssues(file);
	if (program.length) return { ok: false, code: "program_invalid", issues: program.slice(0, 20) };
	return { ok: true, file, legacy };
}

const isV1PageDoc = (page: unknown): boolean => Boolean(page && typeof page === "object" && "layout" in page && !("blocks" in page));

/** What an incoming file carries from before page-spec 2 / proposal status (counted, not changed). */
function legacyOf(file: SessionFile): SessionFileLegacy {
	const legacy: SessionFileLegacy = { pageV1: 0, proposalApplied: 0 };
	for (const chat of file.sessions) {
		const page = chat.page as { applied?: unknown; candidate?: unknown; lastProposed?: unknown } | null;
		if (page && [page.applied, page.candidate, page.lastProposed].some(isV1PageDoc)) legacy.pageV1 += 1;
		const messages = Array.isArray(chat.messages) ? (chat.messages as Array<{ proposal?: { status?: unknown } }>) : [];
		legacy.proposalApplied += messages.filter((m) => m?.proposal && m.proposal.status === undefined).length;
	}
	return legacy;
}

/** Split a checked file into what the session store and the page store keep (page records are keyed by project id). */
export function splitSessionFile(file: SessionFile): { chats: StoredChat[]; pages: Record<string, StoredPageRecord> } {
	const chats: StoredChat[] = [];
	const pages: Record<string, StoredPageRecord> = {};
	for (const { page, ...chat } of file.sessions) {
		chats.push(chat as StoredChat);
		if (page) pages[projectIdOf(chat)] = page;
	}
	return { chats, pages };
}

/**
 * A session file with every page record at page-spec/v2 (ADR 0034): 1.x pages are migrated block by block (same registry
 * item, variant and props the preview rendered), v2 pages stay as they are. Chats, history and settings are untouched.
 */
export function migrateSessionFile(file: SessionFile): SessionFile {
	return plain({ ...file, sessions: file.sessions.map((chat) => ({ ...chat, page: chat.page ? migrateStoredPageRecord(chat.page) : null })) });
}

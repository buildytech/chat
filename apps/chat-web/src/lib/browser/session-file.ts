/**
 * Portable session file buildy:v2 (ADR 0015, https://schema.buildy.tw/session-v2.schema.json): build it from the browser
 * stores, parse and check one before an import, and keep session.pageRevision / history in step with the page store.
 * Pure: no Svelte, no storage. Lab BuildY opens the same file (its importer reads `sessions[]`).
 */
import { cloneJson } from "@buildytech/page-contract";
import {
	SESSION_FORMAT,
	SESSION_MAX_HISTORY,
	SESSION_SCHEMA_URL,
	sessionFileIssues,
	sessionProgramIssues,
	type SessionRevisionEntry
} from "@buildytech/page-contract/session";
import { isV1Page, normalizePageRecord, type StoredPageRecord } from "./persist.ts";

/** The catalog sources of this build: the registry and the prototypes commit the catalog was generated from. */
export type SessionPins = {
	registry: { url: string; sourceCommit: string };
	prototypes: { repo: string; commit: string };
	catalogDigest?: string;
};
export type SessionApp = { name: string; version: string; host: "browser" | "desktop" | "wordpress"; commit?: string };
/** Layout preferences (session `prefs`, stored as `buildy:v1:prefs`; ADR 0017). */
export type SessionPrefs = { layout?: Record<string, number | boolean> };
export type SessionSettings = { theme?: "light" | "dark"; selectedModelId?: string; previewHideServiceLabels?: boolean };

/** The project a stored session works on: its `projectId`, else its own id. */
export function projectIdOf(chat: { id: string; projectId?: string }): string {
	return chat.projectId ?? chat.id;
}

/** A session as the stores keep it: the project part, plus the optional chat extension (the page record lives in the page store). */
export type StoredChat = {
	id: string;
	/** The project of the session (its page record is keyed by it); absent: `id`. */
	projectId?: string;
	pageRevision?: number | null;
	pageId?: string;
	history?: SessionRevisionEntry[];
	[key: string]: unknown;
};

type SessionFileChat = StoredChat & { page: StoredPageRecord | null };

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

type SessionFileIssue = { path: string; keyword: string };
export type ParsedSessionFile =
	| { ok: true; file: SessionFile }
	| { ok: false; code: "invalid_json" | "schema_invalid" | "program_invalid" | "page_v1_unsupported"; issues: SessionFileIssue[] };

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
	const history = [...(chat.history ?? []), cloneJson(entry)].slice(-SESSION_MAX_HISTORY);
	return { ...chat, pageRevision: entry.revision, pageId: entry.pageId ?? chat.pageId, history };
}

/** The page record as it goes into the file (null when the chat has none). */
function fileRecord(record: StoredPageRecord | null | undefined): StoredPageRecord | null {
	if (!record) return null;
	return cloneJson({ ...record, revision: revisionOf(record) });
}

/**
 * Dedup of the page record in the file (t85u step 7): `lastProposed` equal to `candidate` or `applied` goes into the file
 * as null with a chat-local reference in the session ext (`chat-page-ref`, format page-ref/1); import restores it. The
 * record stays valid against page-spec-v2 `$defs/record` (vendored 0.5.0) and its provenance stays where it is.
 */
const PAGE_REF = "chat-page-ref";
type PageRef = { format: "page-ref/1"; lastProposed: "candidate" | "applied" };
function dedupRecord(record: StoredPageRecord | null): { page: StoredPageRecord | null; ref: PageRef | null } {
	if (!record?.lastProposed) return { page: record, ref: null };
	const same = JSON.stringify(record.lastProposed);
	const slot = record.candidate && JSON.stringify(record.candidate) === same ? "candidate" : record.applied && JSON.stringify(record.applied) === same ? "applied" : null;
	return slot ? { page: { ...record, lastProposed: null }, ref: { format: "page-ref/1", lastProposed: slot } } : { page: record, ref: null };
}
function isPageRef(value: unknown): value is PageRef {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const v: Record<string, unknown> = { ...value };
	return v.format === "page-ref/1" && (v.lastProposed === "candidate" || v.lastProposed === "applied");
}
/** The chat with its page record whole again (the inverse of dedupRecord); the reference leaves the ext. */
function restoreRecord(chat: SessionFileChat): SessionFileChat {
	const ext: Record<string, unknown> | null = chat.ext && typeof chat.ext === "object" && !Array.isArray(chat.ext) ? { ...chat.ext } : null;
	const ref: unknown = ext?.[PAGE_REF];
	if (!ext || !(PAGE_REF in ext)) return chat;
	delete ext[PAGE_REF];
	const page = chat.page && isPageRef(ref) && chat.page.lastProposed == null && chat.page[ref.lastProposed] ? { ...chat.page, lastProposed: cloneJson(chat.page[ref.lastProposed]) } : chat.page;
	return { ...chat, ext, page };
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
		const { page, ref } = dedupRecord(fileRecord(input.pages[projectIdOf(chat)]));
		const synced = reconcileChatRevision(chat, page ?? null);
		const ext: Record<string, unknown> = synced.ext && typeof synced.ext === "object" && !Array.isArray(synced.ext) ? { ...synced.ext } : {};
		delete ext[PAGE_REF];
		if (ref) ext[PAGE_REF] = ref;
		return cloneJson({ ...synced, ...(ref || synced.ext ? { ext } : {}), page });
	});
	const ids = new Set(sessions.map((s) => s.id));
	return {
		$schema: SESSION_SCHEMA_URL,
		format: SESSION_FORMAT,
		exportedAt: input.now ?? new Date().toISOString(),
		app: cloneJson(input.app),
		pins: cloneJson(input.pins),
		selectedSessionId: input.selectedSessionId && ids.has(input.selectedSessionId) ? input.selectedSessionId : null,
		sessions,
		...(input.settings ? { settings: cloneJson(input.settings) } : {}),
		...(input.prefs ? { prefs: cloneJson(input.prefs) } : {})
	};
}

/** Parse and check a session file: JSON, then session-v2.schema.json, then its program checks. Nothing is written. */
export function parseSessionFile(input: unknown): ParsedSessionFile {
	let value: unknown = input;
	if (typeof input === "string") {
		try {
			value = JSON.parse(input);
		} catch {
			return { ok: false, code: "invalid_json", issues: [{ path: "$", keyword: "json" }] };
		}
	}
	// A retired page-spec/v1 page fails the v2 record schema too; it is named first so the author is told why.
	const old = v1PageIssues(value);
	if (old.length) return { ok: false, code: "page_v1_unsupported", issues: old.slice(0, 20) };
	const issues = sessionFileIssues(value);
	if (issues.length) return { ok: false, code: "schema_invalid", issues: issues.slice(0, 20) };
	const file = normalizeSessionFile(value as SessionFile);
	const program = sessionProgramIssues(file);
	if (program.length) return { ok: false, code: "program_invalid", issues: program.slice(0, 20) };
	return { ok: true, file };
}

/** Pages in the retired page-spec/v1 format (ADR 0045): the file is refused, nothing is read from it. */
function v1PageIssues(value: unknown): SessionFileIssue[] {
	const out: SessionFileIssue[] = [];
	const sessions = value && typeof value === "object" ? (value as { sessions?: unknown }).sessions : undefined;
	if (!Array.isArray(sessions)) return out;
	sessions.forEach((chat: unknown, i) => {
		const page = chat && typeof chat === "object" ? (chat as { page?: unknown }).page : undefined;
		if (!page || typeof page !== "object") return;
		for (const slot of ["applied", "candidate", "lastProposed"]) if (isV1Page((page as Record<string, unknown>)[slot])) out.push({ path: `$.sessions[${i}].page.${slot}`, keyword: "page_v1_unsupported" });
	});
	return out;
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

/** A session file with the sibling provenance of every page record complete; chats, history and settings are untouched. */
function normalizeSessionFile(file: SessionFile): SessionFile {
	return cloneJson({ ...file, sessions: file.sessions.map(restoreRecord).map((chat) => ({ ...chat, page: chat.page ? normalizePageRecord(chat.page) : null })) });
}

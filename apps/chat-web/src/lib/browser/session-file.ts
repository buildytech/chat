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
import type { StoredPageRecord } from "./persist.ts";

export type SessionPins = {
	stock: { repo: string; contentCommit: string };
	registry: { url: string; sourceCommit: string };
	catalogDigest?: string;
};
export type SessionApp = { name: string; version: string; host: "browser" | "desktop" | "wordpress"; commit?: string };
export type SessionSettings = { theme?: "light" | "dark"; selectedModelId?: string; previewHideServiceLabels?: boolean };

/** A chat as the chat store keeps it, plus its revision history (the page record lives in the page store). */
export type StoredChat = {
	id: string;
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
};

export type SessionFileIssue = { path: string; keyword: string };
export type ParsedSessionFile =
	| { ok: true; file: SessionFile }
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
	now?: string;
}): SessionFile {
	const sessions = input.chats.map((chat) => {
		const page = fileRecord(input.pages[chat.id]);
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
		...(input.settings ? { settings: plain(input.settings) } : {})
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
	const file = value as SessionFile;
	const program = sessionProgramIssues(file);
	if (program.length) return { ok: false, code: "program_invalid", issues: program.slice(0, 20) };
	return { ok: true, file };
}

/** Split a checked file into what the chat store and the page store keep. */
export function splitSessionFile(file: SessionFile): { chats: StoredChat[]; pages: Record<string, StoredPageRecord> } {
	const chats: StoredChat[] = [];
	const pages: Record<string, StoredPageRecord> = {};
	for (const { page, ...chat } of file.sessions) {
		chats.push(chat as StoredChat);
		if (page) pages[chat.id] = page;
	}
	return { chats, pages };
}

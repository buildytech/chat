/**
 * Session profile buildy:v1, published by @ui8kit/contract (https://schema.buildy.tw/session.schema.json): a portable
 * BuildY session file (chats, messages, Ask / Build mode, each chat's page-spec/v1 record with its revision and
 * revision history, catalog pins). Vendored in ../schema (byte-identical to the contract commit of
 * PAGE_SPEC_SCHEMA_SOURCE; `npm run schema:check` compares it with the live URL). The browser stores validate their
 * chats and page records against the same $defs at load.
 */
import sessionSchema from "../schema/session.schema.json" with { type: "json" };
import pageSpecSchema from "../schema/page-spec.schema.json" with { type: "json" };
import { SchemaRegistry, type SchemaIssue } from "./json-schema.ts";
import { addCollectionSchema } from "./collection.ts";

export const SESSION_SCHEMA_URL = "https://schema.buildy.tw/session.schema.json";
export const SESSION_FORMAT = "buildy:v1" as const;
export const SESSION_REVISION_CAUSES = ["apply", "edit", "undo", "redo"] as const;
export type SessionRevisionCause = (typeof SESSION_REVISION_CAUSES)[number];
export type SessionRevisionEntry = { revision: number; at: string; cause: SessionRevisionCause; pageId?: string; blockId?: string };
export const SESSION_MAX_HISTORY = (sessionSchema as { "x-limits": { maxHistory: number } })["x-limits"].maxHistory;

const registry = new SchemaRegistry();
registry.add(pageSpecSchema as Record<string, unknown>);
addCollectionSchema(registry);
registry.add(sessionSchema as Record<string, unknown>);

export { sessionSchema };

/** Schema issues of a whole session file. Empty = the shape is valid; run sessionProgramIssues next. */
export function sessionFileIssues(input: unknown): SchemaIssue[] {
	return registry.check(input, SESSION_SCHEMA_URL);
}

/** Schema issues against a session $def (one chat, one message, one revision entry). */
export function sessionDefIssues(input: unknown, def: "session" | "message" | "revisionEntry" | "settings" | "collection"): SchemaIssue[] {
	return registry.check(input, `${SESSION_SCHEMA_URL}#/$defs/${def}`);
}

type ProgramIssue = { path: string; keyword: string };

/** Program checks of one chat (x-program-checks): page revision and history agree with the page record. */
export function sessionChatProgramIssues(session: { pageRevision?: number | null; page?: { revision?: number | null } | null; history?: { revision: number }[] }, path = "$"): ProgramIssue[] {
	const out: ProgramIssue[] = [];
	const pageRevision = session.page ? (session.page.revision ?? null) : undefined;
	if (pageRevision !== undefined && (session.pageRevision ?? null) !== pageRevision) out.push({ path: `${path}.pageRevision`, keyword: "page_revision_mismatch" });
	const history = session.history ?? [];
	for (let i = 1; i < history.length; i++) {
		if (history[i]!.revision < history[i - 1]!.revision) {
			out.push({ path: `${path}.history[${i}]`, keyword: "history_not_monotonic" });
			break;
		}
	}
	const last = history.at(-1);
	if (last && pageRevision != null && last.revision > pageRevision) out.push({ path: `${path}.history[${history.length - 1}]`, keyword: "history_not_monotonic" });
	return out;
}

/** Program checks of a session file after the schema (x-program-checks of session.schema.json). */
export function sessionProgramIssues(doc: { selectedSessionId?: string | null; sessions: { id: string; pageRevision?: number | null; page?: { revision?: number | null } | null; history?: { revision: number }[] }[] }): ProgramIssue[] {
	const out: ProgramIssue[] = [];
	const seen = new Set<string>();
	doc.sessions.forEach((s, i) => {
		if (seen.has(s.id)) out.push({ path: `$.sessions[${i}].id`, keyword: "duplicate_session_id" });
		seen.add(s.id);
		out.push(...sessionChatProgramIssues(s, `$.sessions[${i}]`));
	});
	if (doc.selectedSessionId && !seen.has(doc.selectedSessionId)) out.push({ path: "$.selectedSessionId", keyword: "selected_session_unknown" });
	return out;
}

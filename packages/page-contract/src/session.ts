/**
 * Session profile buildy:v2 (@ui8kit/contract 0.5.0, https://schema.buildy.tw/session-v2.schema.json): the portable
 * BuildY session file of the simple line (sessions: a project with its page-spec/v2 record, skin, revision and revision
 * history, and its extensions; the chat is `ext.chat`; pins: registry and prototypes). Vendored in ../schema
 * (byte-identical to the contract commit of catalog/snapshot.config.json; `npm run schema:check` compares them). The
 * browser stores validate their sessions against the same $defs at load. buildy:v1 files and records are not read.
 */
import sessionSchema from "../schema/session-v2.schema.json" with { type: "json" };
import pageSpecSchema from "../schema/page-spec.schema.json" with { type: "json" };
import pageSpecV2Schema from "../schema/page-spec-v2.schema.json" with { type: "json" };
import { SchemaRegistry, type SchemaIssue } from "./json-schema.ts";

export const SESSION_SCHEMA_URL = "https://schema.buildy.tw/session-v2.schema.json";
export const SESSION_FORMAT = "buildy:v2" as const;
export type SessionRevisionCause = "apply" | "edit" | "undo" | "redo";
/** What a revision did: one field, a variant, a section or row added / moved / removed / inserted / replaced. */
export type SessionRevisionOp = "set_field" | "set_variant" | "add" | "move" | "remove" | "insert" | "replace";
/** `path`: JSON Pointer of the field or row in the block's props; never a value. */
export type SessionRevisionEntry = { revision: number; at: string; cause: SessionRevisionCause; pageId?: string; blockId?: string; op?: SessionRevisionOp; path?: string };
export const SESSION_MAX_HISTORY = (sessionSchema as { "x-limits": { maxHistory: number } })["x-limits"].maxHistory;

const registry = new SchemaRegistry();
registry.add(pageSpecSchema as Record<string, unknown>);
registry.add(pageSpecV2Schema as Record<string, unknown>);
registry.add(sessionSchema as Record<string, unknown>);

export { sessionSchema };

/** Schema issues of a whole session file. Empty = the shape is valid; run sessionProgramIssues next. */
export function sessionFileIssues(input: unknown): SchemaIssue[] {
	return registry.check(input, SESSION_SCHEMA_URL);
}

/** Schema issues against a session $def (one chat, one message, one revision entry). */
export function sessionDefIssues(input: unknown, def: "session" | "message" | "revisionEntry" | "settings"): SchemaIssue[] {
	return registry.check(input, `${SESSION_SCHEMA_URL}#/$defs/${def}`);
}

type ProgramIssue = { path: string; keyword: string };

/** Program checks of one chat (x-program-checks): page revision and history agree with the page record. */
function sessionChatProgramIssues(session: { pageRevision?: number | null; page?: { revision?: number | null } | null; history?: { revision: number }[] }, path = "$"): ProgramIssue[] {
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

/** Program checks of a session file after the schema (x-program-checks of session-v2.schema.json). */
export function sessionProgramIssues(doc: { selectedSessionId?: string | null; sessions: { id: string; projectId?: string; pageRevision?: number | null; page?: { revision?: number | null } | null; history?: { revision: number }[] }[] }): ProgramIssue[] {
	const out: ProgramIssue[] = [];
	const seen = new Set<string>();
	const pageOfProject = new Set<string>();
	doc.sessions.forEach((s, i) => {
		if (seen.has(s.id)) out.push({ path: `$.sessions[${i}].id`, keyword: "duplicate_session_id" });
		seen.add(s.id);
		out.push(...sessionChatProgramIssues(s, `$.sessions[${i}]`));
		// The page record belongs to the project; two sessions of one project may not both carry it.
		if (s.page) {
			const project = s.projectId ?? s.id;
			if (pageOfProject.has(project)) out.push({ path: `$.sessions[${i}].page`, keyword: "duplicate_project_page" });
			pageOfProject.add(project);
		}
	});
	if (doc.selectedSessionId && !seen.has(doc.selectedSessionId)) out.push({ path: "$.selectedSessionId", keyword: "selected_session_unknown" });
	return out;
}

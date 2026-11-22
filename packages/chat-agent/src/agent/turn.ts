/**
 * One agent turn (ADR 0034). The agent reads the page document and the registry, and writes the page with one tool,
 * `write_page`, offered only in Build (Ask is read-only, ADR 0059); Build's proposal is applied by the author with Apply. This module is pure: the
 * context a turn starts from, the proposal it ends with, and the write tool itself (scope and the one gate).
 */
import type { PageV2 } from "@buildytech/page-contract";
import type { AgentMode } from "./agent-tools.ts";
import { diffPages, type DiffEntry } from "@buildytech/builder-core";
import type { DocIssue } from "@buildytech/builder-core";
import { writeInputFromModel, writePage, type WriteInput } from "@buildytech/builder-core";
import { blankRequired } from "@buildytech/builder-core";

export type TurnContext = {
	scenario?: import("../scenarios/compile.ts").ScenarioRef;
	brief: string;
	mode: AgentMode;
	conversation?: Array<{ role: "user" | "assistant"; text: string }>;
	/** The page document the agent starts from (the applied page, the pending proposal, or an empty / draft page). */
	page: PageV2;
	/** Page revision of what the author sees: a proposal carries it so Apply can tell a changed page. */
	expectedRevision: number;
	/** Selected blocks: when set, the agent edits only those (their props, variant, item). Otherwise the whole page. */
	scopeBlockIds?: string[];
	/** The page the author sees, when `page` is a draft that is not on screen yet. Default: `page`. */
	shownPage?: PageV2 | null;
	/** Opaque, session-stable prompt-cache routing key from the host (x-grok-conv-id); absent: the run id. */
	cacheKey?: string;
	/** The author's date and IANA time zone, from their browser (ADR 0066): the system prompt states it. */
	today?: { date: string; timeZone: string };
};

/** What a turn proposes: the whole next page document and what differs from the page the author sees. */
export type PageProposal = {
	page: PageV2;
	diff: DiffEntry[];
	baseRevision: number;
	warnings: string[];
};

/** A turn that answered (Ask, or Build that only talked) and, when the agent wrote the page, its proposal. */
export type AgentReply = {
	ok: true;
	reply: "text";
	mode: AgentMode;
	text: string;
	/** Registry items the agent read (evidence of the turn). */
	blocks: string[];
	proposal?: PageProposal;
};

/** The last write the host rejected, kept small for diagnosis (the run record of the chat message; no prompts, no keys). */
export type RejectedWrite = { code: string; issues: Array<{ path: string; code: string; expected: string; got?: unknown }>; doc?: unknown; partial?: true };

export type AgentFailure = { ok: false; code: string; message: string; issues?: DocIssue[]; rejected?: RejectedWrite };

const REJECTED_DOC_CHARS = 24_000;
const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

/** What a failed turn keeps of its last rejected write: the first issues and the document (when large: the block of the first issue). */
export function rejectedWrite(input: Record<string, unknown>, issues: DocIssue[], code: string): RejectedWrite {
	const doc = input.page ?? input.patch;
	const out: RejectedWrite = {
		code,
		issues: issues.slice(0, 5).map((issue) => ({
			path: issue.path,
			code: issue.code,
			expected: cut(issue.expected, 300),
			...(issue.got === undefined ? {} : { got: typeof issue.got === "object" && issue.got !== null ? cut(JSON.stringify(issue.got), 200) : typeof issue.got === "string" ? cut(issue.got, 200) : issue.got })
		}))
	};
	if (doc === undefined) return out;
	if (JSON.stringify(doc).length <= REJECTED_DOC_CHARS) return { ...out, doc };
	const at = /^\/blocks\/(\d+)/.exec(issues[0]?.path ?? "");
	const blocks: unknown = typeof doc === "object" && doc !== null ? Reflect.get(doc, "blocks") : undefined;
	const block = at && Array.isArray(blocks) ? blocks[Number(at[1])] : undefined;
	return block !== undefined && JSON.stringify(block).length <= REJECTED_DOC_CHARS ? { ...out, doc: { block }, partial: true } : out;
}

export function isAgentReply(value: unknown): value is AgentReply {
	return Boolean(value && typeof value === "object" && (value as { reply?: unknown }).reply === "text" && (value as { ok?: unknown }).ok === true);
}

const MAX_TEXT = 12_000;
const MAX_CARDS = 10;

export function agentReply(mode: AgentMode, text: string, blocks: readonly string[], proposal?: PageProposal | null): AgentReply {
	return { ok: true, reply: "text", mode, text: text.trim().slice(0, MAX_TEXT), blocks: [...new Set(blocks)].slice(0, MAX_CARDS), ...(proposal ? { proposal } : {}) };
}

/** Scope rule of a write: with selected blocks only those blocks change (props, variant, item); nothing else. */
export function scopeIssues(diff: DiffEntry[], scope: readonly string[] | undefined): DocIssue[] {
	if (!scope?.length) return [];
	const allowed = new Set(scope);
	const out: DocIssue[] = [];
	for (const entry of diff) {
		const ok = entry.scope === "block" && entry.change === "changed" && entry.id !== undefined && allowed.has(entry.id);
		if (ok) continue;
		out.push({
			path: entry.scope === "page" ? (entry.paths?.[0] ?? "/") : `/blocks/${entry.id ?? ""}`,
			code: "outside_scope",
			expected: `only the selected blocks change (${[...allowed].join(", ")}): their props, variant or item. Page fields, other blocks, adds, removes and moves are not part of this edit`,
			got: entry.scope === "page" ? `page ${entry.paths?.join(", ") ?? ""}` : `${entry.change} ${entry.id ?? ""}`
		});
	}
	return out;
}

type WriteToolResult =
	| { ok: true; page: PageV2; proposal: PageProposal; payload: Record<string, unknown> }
	| { ok: false; code: string; message: string; issues: DocIssue[] };

/** write_page: `args` is { page } or { patch }. `working` is the page the write applies to (the base, or the last write of this turn). */
export function runWriteTool(ctx: TurnContext, working: PageV2, args: Record<string, unknown>, options: { now?: string } = {}): WriteToolResult {
	// The model writes money in major units (650); the document stores minor units (65000): converted before the gate (money-view.ts).
	const input: WriteInput = writeInputFromModel(working, args);
	const written = writePage(working, input, options);
	if (!written.ok) return { ok: false, code: written.code, message: written.message, issues: written.issues };
	const shown = ctx.shownPage ?? ctx.page;
	const diff = diffPages(shown, written.page);
	const against = diffPages(ctx.page, written.page);
	const issues = scopeIssues(against, ctx.scopeBlockIds);
	if (issues.length) {
		return { ok: false, code: "write_invalid", message: `The page was not written: ${issues.length} problem${issues.length > 1 ? "s" : ""}, first at ${issues[0]!.path} (${issues[0]!.code}). Nothing changed; fix the listed paths and call write_page again.`, issues };
	}
	const proposal: PageProposal = { page: written.page, diff, baseRevision: ctx.expectedRevision, warnings: written.warnings };
	const touched = new Set(diff.filter((entry) => entry.scope === "block" && entry.change !== "removed" && entry.change !== "moved" && entry.id).map((entry) => entry.id!));
	const empty = written.page.blocks.filter((block) => touched.has(block.id)).flatMap((block) => {
		const paths = blankRequired(block, 4);
		return paths.length ? [{ id: block.id, paths }] : [];
	});
	return {
		ok: true,
		page: written.page,
		proposal,
		payload: {
			ok: true,
			changed: diff.length > 0,
			blocks: written.page.blocks.map((block) => ({ id: block.id, item: block.item, variant: block.variant ?? null })),
			diff: diff.map((entry) => ({ change: entry.change, ...(entry.id ? { id: entry.id } : { page: true }), ...(entry.paths ? { paths: entry.paths.slice(0, 8) } : {}) })),
			...(written.warnings.length ? { notes: written.warnings } : {}),
			...(empty.length ? { empty_required_text: empty.slice(0, 8), fill: "These required texts are empty and the block would show nothing or its own placeholder. Write the author's content into them (one write_page with the whole page, or a patch) unless the request gives none." } : {}),
			note:
				ctx.mode === "ask"
					? "This is a proposal. Nothing is applied: the author applies it in Build with one click. Say in your answer what it changes."
					: "This is a proposal. The author sees the diff and applies it with Apply. Say in your answer what it changes."
		}
	};
}

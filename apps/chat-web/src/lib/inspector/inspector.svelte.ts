/**
 * Build inspector store (ADR 0014, rebuilt on page-spec/v2 by ADR 0034): field edits and block operations on the page
 * Preview shows. Every edit is one plain JSON write into the page document (`applyOp` -> `writePage`: the same gate,
 * normalization and props schema the agent's write_page goes through) and a local undo history. No chat proposal and no
 * model call: a passing edit replaces the visible page at once (persisted like any page edit), a rejected one leaves the
 * page as it was and is shown in its field.
 */
import { addScreen, applyOp, checkAdd, deriveFamily, inspectorValue, type AddCheck, type InspectorField, type OpResult, type PageFamily, type PageOp } from "@buildytech/builder-core";
import type { PageV2 } from "@buildytech/page-contract";
import { loadPropsGate, startEmptyPageInChat } from "../../modules/chat/core";
import { getBoundProjectId, getCurrentPage, getSelectedBlockId, replaceVisiblePage, selectBlock } from "../page-store";
import { commitChange } from "../page-store/revision";
import type { FieldIssue } from "./fields";
import { EditHistory } from "./history";

type Page = PageV2;
type Ok = Extract<OpResult, { ok: true }>;

const history = new EditHistory<Page>();
let historySession: string | null = null;
/** Bumped on every history change, so canUndo / canRedo readers update. */
let version = $state(0);
/** Rejected edits: block id -> field pointer -> issue. */
let issues = $state<Record<string, Record<string, FieldIssue>>>({});
/** The last rejected block operation, shown above the fields of its block. */
let opIssue = $state<{ blockId: string; code: string; message: string } | null>(null);

/** The history of the bound chat for the page Preview shows; reset when the chat or the page changed elsewhere. */
function historyFor(page: Page): EditHistory<Page> {
	const bound = getBoundProjectId();
	const head = history.head();
	if (bound !== historySession || (head !== null && head !== page)) {
		history.clear();
		historySession = bound;
		issues = {};
		opIssue = null;
	}
	return history;
}

function setIssue(blockId: string, pointer: string, issue: FieldIssue | null): void {
	const forBlock = { ...issues[blockId] };
	if (issue) forBlock[pointer] = issue;
	else delete forBlock[pointer];
	issues = { ...issues, [blockId]: forBlock };
}

/** A passing result replaces the visible page and becomes one history step (`key`: coalesced typing). */
function commit(before: Page, result: Ok, key: string | null): boolean {
	if (result.page === before) return true;
	const steps = historyFor(before);
	// Coalesced typing extends the open undo step and keeps its revision: one undo step = one page revision.
	const meta = { op: result.op, ...(result.path ? { path: result.path } : {}) };
	if (!replaceVisiblePage(result.page, result.blockId || null, commitChange(steps.continues(key)), meta)) return false;
	steps.record(before, result.page, key);
	version += 1;
	return true;
}

function restore(page: Page | null, change: "undo" | "redo"): boolean {
	if (!page) return false;
	replaceVisiblePage(page, null, change);
	issues = {};
	opIssue = null;
	version += 1;
	return true;
}

function isEditable(target: EventTarget | null): Element | null {
	const el = target as Element | null;
	return el?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']") ?? null;
}

type Added = { ok: true; blockId: string } | { ok: false; code: string; message: string };

export const inspector = {
	/** Set the page slug (the address bar of Preview): one undo step. */
	setSlug(slug: string): boolean {
		return inspector.setPageField("slug", slug);
	},

	/** A page field (title, slug, locale, seo title / description) through the same write: one undo step. */
	setPageField(field: Extract<PageOp, { op: "page" }>["field"], value: string): boolean {
		const page = getCurrentPage();
		if (!page) return false;
		historyFor(page).seal();
		const result = applyOp(page, { op: "page", field, value });
		if (!result.ok) return false;
		return commit(page, result, null);
	},

	/** Rejected edits of one block, by field pointer. */
	issuesFor(blockId: string): Record<string, FieldIssue> {
		return issues[blockId] ?? {};
	},

	get canUndo(): boolean {
		void version;
		const head = history.head();
		return history.canUndo && historySession === getBoundProjectId() && head === getCurrentPage();
	},

	get canRedo(): boolean {
		void version;
		const head = history.head();
		return history.canRedo && historySession === getBoundProjectId() && head === getCurrentPage();
	},

	/**
	 * Write a field of a block into its props. `typing` edits of one field coalesce into one undo step until seal().
	 * Returns false when the gate rejected the value (the page is unchanged and the field shows why).
	 */
	edit(blockId: string, field: InspectorField, value: string, typing: boolean): boolean {
		const page = getCurrentPage();
		if (!page) return false;
		historyFor(page);
		// A committed value equal to what the block already renders adds nothing.
		if (!typing && value === String(field.value ?? "")) {
			setIssue(blockId, field.pointer, null);
			history.seal();
			return true;
		}
		const result = applyOp(page, { op: "set", blockId, pointer: field.pointer, value: inspectorValue(field, value) });
		if (!result.ok) {
			const first = result.issues[0];
			setIssue(blockId, field.pointer, { pointer: result.pointer ?? field.pointer, code: result.code, message: first?.expected ? `${first.expected}${first.got && !first.expected.includes(String(first.got)) ? ` (${first.got})` : ""}` : result.message, ...(field.options ? { allowed: field.options } : {}), value });
			return false;
		}
		setIssue(blockId, field.pointer, null);
		const done = commit(page, result, typing ? `${blockId}${field.pointer}` : null);
		if (!typing) history.seal();
		return done;
	},

	/** The last rejected operation on this block, if any. */
	opIssueFor(blockId: string): { code: string; message: string } | null {
		return opIssue?.blockId === blockId ? opIssue : null;
	},

	/** A block operation (variant, reset, move, duplicate, remove, list rows): one undo step. */
	run(op: Exclude<PageOp, { op: "add" } | { op: "page" }>): boolean {
		const page = getCurrentPage();
		if (!page) return false;
		historyFor(page).seal();
		const result = applyOp(page, op);
		if (!result.ok) {
			opIssue = { blockId: "blockId" in op ? op.blockId : "", code: result.code, message: result.message };
			return false;
		}
		opIssue = null;
		return commit(page, result, null);
	},

	/** Whether the Blocks feed can add this Stock block variant (a registry item that renders), and why not. */
	canAdd(spec: string, variant: string | null): AddCheck {
		return checkAdd(spec, variant);
	},

	/**
	 * Blocks feed "+" (or a drop at slot `at`): the Stock block variant after the selected section, or where its role puts
	 * it, with the registry sample props, as one operation (every gate, one undo step, no model call). The new section
	 * becomes the selection.
	 */
	async add(spec: string, variant: string | null, at?: number): Promise<Added> {
		const bound = getBoundProjectId();
		try {
			await loadPropsGate();
		} catch {
			return { ok: false, code: "props_gate_unavailable", message: "Validation could not load. Retry adding the block or screen." };
		}
		if (bound !== getBoundProjectId()) return { ok: false, code: "page_changed", message: "The selected chat changed while validation loaded. Retry in this chat." };
		const check = checkAdd(spec, variant);
		if (!check.ok) return { ok: false, code: check.code, message: check.message };
		// Empty start: no page yet. The chat gets an empty page first, with no history step, so the section is the one undo step.
		if (!getCurrentPage() && !startEmptyPageInChat()) return { ok: false, code: "not_started", message: "The empty page could not be started." };
		const page = getCurrentPage();
		if (!page) return { ok: false, code: "not_started", message: "The empty page could not be started." };
		historyFor(page).seal();
		const selected = getSelectedBlockId();
		const after = selected ? page.blocks.findIndex((block) => block.id === selected) : -1;
		const slot = at ?? (after >= 0 ? after + 1 : undefined);
		const result = applyOp(page, { op: "add", item: check.item, variant: check.variant, ...(slot !== undefined ? { at: slot } : {}) });
		if (!result.ok) return { ok: false, code: result.code, message: result.message };
		if (!commit(page, result, null)) return { ok: false, code: "not_committed", message: "The page did not accept the change." };
		selectBlock(result.blockId);
		return { ok: true, blockId: result.blockId };
	},

	/**
	 * A Stock screen dropped into the page or started from: its renderable sections at slot `at` (default: the end),
	 * hard rules only, one undo step. With no page yet the chat first gets an empty page.
	 */
	async addScreen(screenId: string, at?: number): Promise<{ ok: true; blockId: string; added: number; skipped: string[] } | { ok: false; code: string; message: string }> {
		const bound = getBoundProjectId();
		try {
			await loadPropsGate();
		} catch {
			return { ok: false, code: "props_gate_unavailable", message: "Validation could not load. Retry adding the block or screen." };
		}
		if (bound !== getBoundProjectId()) return { ok: false, code: "page_changed", message: "The selected chat changed while validation loaded. Retry in this chat." };
		let page = getCurrentPage();
		if (!page && !startEmptyPageInChat(screenId)) return { ok: false, code: "not_started", message: "The empty page could not be started." };
		page = getCurrentPage();
		if (!page) return { ok: false, code: "not_started", message: "The empty page could not be started." };
		historyFor(page).seal();
		const result = addScreen(page, screenId, at);
		if (!result.ok) return { ok: false, code: result.code, message: result.message };
		if (!commit(page, result, null)) return { ok: false, code: "not_committed", message: "The page did not accept the change." };
		selectBlock(result.blockId);
		return { ok: true, blockId: result.blockId, added: result.added.length, skipped: result.skipped };
	},

	/** The advisory family of the page the feed ranks by (derived from its items; never stored, never a rule). */
	get family(): PageFamily | null {
		void version;
		const page = getCurrentPage();
		return page ? deriveFamily(page.blocks) : null;
	},

	/** End the open typing step (blur). */
	seal(): void {
		history.seal();
	},

	undo(): boolean {
		if (!inspector.canUndo) return false;
		return restore(history.undo(), "undo");
	},

	redo(): boolean {
		if (!inspector.canRedo) return false;
		return restore(history.redo(), "redo");
	},

	/**
	 * Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z and Ctrl+Y redo in Build, from the chat document and the preview frame. Other
	 * text fields (the composer, the address bar) keep their native undo; so does an inspector field with no step.
	 */
	onKey(event: KeyboardEvent): void {
		if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
		const key = event.key.toLowerCase();
		const redo = (key === "z" && event.shiftKey) || (key === "y" && event.ctrlKey && !event.shiftKey);
		const undo = key === "z" && !event.shiftKey;
		if (!undo && !redo) return;
		const field = isEditable(event.target);
		if (field && !field.closest('[data-slot="inspector"]')) return;
		if (!(undo ? inspector.canUndo : inspector.canRedo)) return;
		event.preventDefault();
		if (undo) inspector.undo();
		else inspector.redo();
	}
};

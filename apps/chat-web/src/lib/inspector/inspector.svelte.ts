/**
 * Build inspector store (ADR 0014): field edits and block operations on the page Preview shows, each through the
 * builder-core inspector gate (page-spec + props gate, fail closed), and a local undo history. No chat proposal and
 * no model call: a passing edit replaces the visible page at once (persisted like any page edit), a rejected one
 * leaves the page as it was and is shown in its field.
 */
import { canAddCatalogBlock, inspectorOp, inspectorSetField, type AddBlockCheck, type InspectorField, type InspectorOp, type InspectorResult } from "@buildytech/builder-core";
import type { Page } from "@buildytech/page-contract";
import { getChatMode } from "../chat-core";
import { getBoundPageSessionId, getCurrentPage, getCurrentProvenance, getPageRevision, getSelectedBlockId, replaceVisiblePage, selectBlock } from "../page-store";
import { commitChange } from "../page-store/revision";
import type { FieldIssue } from "./fields";
import { EditHistory } from "./history";

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
	const bound = getBoundPageSessionId();
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
function commit(before: Page, result: InspectorResult, key: string | null): boolean {
	if (!result.ok) return false;
	if (result.page === before) return true;
	const steps = historyFor(before);
	// Coalesced typing extends the open undo step and keeps its revision: one undo step = one page revision.
	if (!replaceVisiblePage(result.page, result.blockId, commitChange(steps.continues(key)))) return false;
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

export const inspector = {
	/** Rejected edits of one block, by field pointer. */
	issuesFor(blockId: string): Record<string, FieldIssue> {
		return issues[blockId] ?? {};
	},

	get canUndo(): boolean {
		void version;
		const head = history.head();
		return history.canUndo && historySession === getBoundPageSessionId() && head === getCurrentPage();
	},

	get canRedo(): boolean {
		void version;
		const head = history.head();
		return history.canRedo && historySession === getBoundPageSessionId() && head === getCurrentPage();
	},

	/**
	 * Write a field of a block. `typing` edits of one field coalesce into one undo step until seal(). Returns false
	 * when the gate rejected the value (the page is unchanged and the field shows why).
	 */
	edit(blockId: string, field: InspectorField, value: string, typing: boolean): boolean {
		const page = getCurrentPage();
		if (!page) return false;
		historyFor(page);
		// A committed value equal to what the block already renders (e.g. a variant default) adds no override.
		if (!typing && value === String(field.value ?? "")) {
			setIssue(blockId, field.pointer, null);
			history.seal();
			return true;
		}
		const result = inspectorSetField(page, blockId, field.pointer, value);
		if (!result.ok) {
			setIssue(blockId, field.pointer, { pointer: result.pointer, code: result.code, message: result.message, allowed: result.allowed, value });
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

	/** A block operation (variant, reset, move, duplicate, remove, row duplicate / remove): one undo step. */
	run(op: InspectorOp): boolean {
		const page = getCurrentPage();
		if (!page) return false;
		historyFor(page).seal();
		const provenance = getCurrentProvenance();
		const result = inspectorOp({ page, provenance, revision: getPageRevision() ?? 0 }, op);
		if (!result.ok) {
			opIssue = { blockId: op.blockId, code: result.code, message: result.message };
			return false;
		}
		opIssue = null;
		if (result.page === page) return true;
		return commit(page, result, null);
	},

	/** Whether the Blocks feed can add this Stock block variant to the page Preview shows (and why not). */
	canAdd(catalogBlock: string, variant: string | null): AddBlockCheck {
		void version;
		const page = getCurrentPage();
		const provenance = getCurrentProvenance();
		return page ? canAddCatalogBlock({ page, provenance }, catalogBlock, variant) : canAddCatalogBlock({ page: null, provenance: null }, catalogBlock, variant);
	},

	/**
	 * Blocks feed "+": the Stock block variant after the selected section, or at the end, as one inspector operation
	 * (every gate, one undo step, no model call). The new section becomes the selection.
	 */
	add(catalogBlock: string, variant: string | null): { ok: true; blockId: string } | { ok: false; code: string; message: string } {
		const page = getCurrentPage();
		if (!page) return { ok: false, code: "no_page", message: "There is no page yet." };
		historyFor(page).seal();
		const result = inspectorOp({ page, provenance: getCurrentProvenance(), revision: getPageRevision() ?? 0 }, { op: "add", blockId: getSelectedBlockId() ?? "", catalogBlock, variant });
		if (!result.ok) return { ok: false, code: result.code, message: result.message };
		if (!commit(page, result, null)) return { ok: false, code: "not_committed", message: "The page did not accept the change." };
		selectBlock(result.blockId);
		return { ok: true, blockId: result.blockId };
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
		if (getChatMode() !== "build") return;
		const field = isEditable(event.target);
		if (field && !field.closest('[data-slot="inspector"]')) return;
		if (!(undo ? inspector.canUndo : inspector.canRedo)) return;
		event.preventDefault();
		if (undo) inspector.undo();
		else inspector.redo();
	}
};

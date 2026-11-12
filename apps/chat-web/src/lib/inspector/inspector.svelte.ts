/**
 * Build inspector store (ADR 0014): field edits and block operations on the page Preview shows, each through the
 * builder-core inspector gate (page-spec + props gate, fail closed), and a local undo history. No chat proposal and
 * no model call: a passing edit replaces the visible page at once (persisted like any page edit), a rejected one
 * leaves the page as it was and is shown in its field.
 */
import {
	addScreenSections,
	canAddCatalogBlock,
	deriveFamily,
	inspectorOp,
	inspectorSetField,
	nextFamilyState,
	withFamily,
	type AddBlockCheck,
	type InspectorField,
	type InspectorOp,
	type InspectorResult,
	type PageFamily
} from "@buildytech/builder-core";
import type { StoredPageProvenance } from "../browser/persist";
import { parseDraftPage, type Page } from "@buildytech/page-contract";
import { getChatMode, startEmptyPageInChat } from "../chat-core";
import { getBoundPageSessionId, getCurrentPage, getCurrentProvenance, getPageRevision, getSelectedBlockId, replaceVisiblePage, selectBlock } from "../page-store";
import { commitChange } from "../page-store/revision";
import type { FieldIssue } from "./fields";
import { EditHistory } from "./history";

/** One undo step: the page and its provenance (the screen family rides with it, ADR 0027). */
type Snapshot = { page: Page; provenance: StoredPageProvenance | null };
const history = new EditHistory<Snapshot>();
let historySession: string | null = null;
/** Bumped on every history change, so canUndo / canRedo readers update. */
let version = $state(0);
/** Rejected edits: block id -> field pointer -> issue. */
let issues = $state<Record<string, Record<string, FieldIssue>>>({});
/** The last rejected block operation, shown above the fields of its block. */
let opIssue = $state<{ blockId: string; code: string; message: string } | null>(null);
/** The last screen family change (derived, pinned, undone): a small non-modal label, gone after a few seconds. */
let familyNote = $state<{ from: PageFamily | null; to: PageFamily | null; id: number } | null>(null);
let familyNoteTimer: ReturnType<typeof setTimeout> | null = null;

function noteFamily(from: PageFamily | null | undefined, to: PageFamily | null | undefined): void {
	if ((from ?? null) === (to ?? null)) return;
	familyNote = { from: from ?? null, to: to ?? null, id: (familyNote?.id ?? 0) + 1 };
	if (familyNoteTimer) clearTimeout(familyNoteTimer);
	familyNoteTimer = setTimeout(() => (familyNote = null), 6000);
}

/** The history of the bound chat for the page Preview shows; reset when the chat or the page changed elsewhere. */
function historyFor(page: Page): EditHistory<Snapshot> {
	const bound = getBoundPageSessionId();
	const head = history.head();
	if (bound !== historySession || (head !== null && head.page !== page)) {
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
	const prov = getCurrentProvenance();
	// The screen family follows the composition (ADR 0027): a first derivation rides with this step; a change of an
	// already derived family is its own step right after it (one undo reverts the family, the next the edit).
	const derived = prov && !prov.familyPinned ? nextFamilyState({ ...prov, family: prov.family ?? null }, result.page.layout.blocks) : prov;
	const changed = !!prov && !!derived && derived !== prov && derived.family !== (prov.family ?? null);
	const pageProv = changed && prov!.family != null ? prov : derived;
	// Coalesced typing extends the open undo step and keeps its revision: one undo step = one page revision.
	const meta = result.op ? { op: result.op, ...(result.path ? { path: result.path } : {}) } : undefined;
	if (!replaceVisiblePage(result.page, result.blockId, commitChange(steps.continues(key)), meta, pageProv)) return false;
	steps.record({ page: before, provenance: prov }, { page: result.page, provenance: pageProv }, key);
	if (changed && prov!.family != null) {
		replaceVisiblePage(result.page, result.blockId, "edit", { op: "set_family" }, derived);
		steps.record({ page: result.page, provenance: pageProv }, { page: result.page, provenance: derived }, null);
		noteFamily(prov!.family, derived!.family);
	}
	version += 1;
	return true;
}

function restore(snap: Snapshot | null, change: "undo" | "redo"): boolean {
	if (!snap) return false;
	const from = getCurrentProvenance()?.family;
	replaceVisiblePage(snap.page, null, change, undefined, snap.provenance);
	noteFamily(from, snap.provenance?.family);
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
 setSlug(slug: string): boolean {
  const page = getCurrentPage();
  if (!page) return false;
  if (page.slug === slug) return true;
  let next: Page;
  try { next = parseDraftPage({ ...page, slug, updatedAt: new Date().toISOString() }); } catch { return false; }
  const steps = historyFor(page);
  steps.seal();
  const provenance = getCurrentProvenance();
  if (!replaceVisiblePage(next)) return false;
  steps.record({ page, provenance }, { page: next, provenance }, null);
  version += 1;
  return true;
 },
	/** Rejected edits of one block, by field pointer. */
	issuesFor(blockId: string): Record<string, FieldIssue> {
		return issues[blockId] ?? {};
	},

	get canUndo(): boolean {
		void version;
		const head = history.head();
		return history.canUndo && historySession === getBoundPageSessionId() && head?.page === getCurrentPage();
	},

	get canRedo(): boolean {
		void version;
		const head = history.head();
		return history.canRedo && historySession === getBoundPageSessionId() && head?.page === getCurrentPage();
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
	 * Blocks feed "+" (or a drop at slot `at`): the Stock block variant after the selected section, or at the end, as one inspector operation
	 * (every gate, one undo step, no model call). The new section becomes the selection.
	 */
	add(catalogBlock: string, variant: string | null, at?: number): { ok: true; blockId: string } | { ok: false; code: string; message: string } {
		// Empty start: no page yet (or an empty one with no screen). The chat gets an empty page on the start screen
		// first, with no history step, so the section below is the one undo step (undo goes back to the empty page).
		const check = inspector.canAdd(catalogBlock, variant);
		if (!check.ok) return { ok: false, code: check.code, message: check.message };
		if (check.startScreenId && !startEmptyPageInChat(check.startScreenId)) {
			return { ok: false, code: "not_started", message: "The empty page could not be started." };
		}
		const page = getCurrentPage();
		if (!page) return { ok: false, code: "not_started", message: "The empty page could not be started." };
		historyFor(page).seal();
		// A drop names its slot (`at`); "+" adds after the selected section or at the end.
		const op = at === undefined ? { op: "add" as const, blockId: getSelectedBlockId() ?? "", catalogBlock, variant } : { op: "add" as const, blockId: "", catalogBlock, variant, at };
		const result = inspectorOp({ page, provenance: getCurrentProvenance(), revision: getPageRevision() ?? 0 }, op);
		if (!result.ok) return { ok: false, code: result.code, message: result.message };
		if (!commit(page, result, null)) return { ok: false, code: "not_committed", message: "The page did not accept the change." };
		selectBlock(result.blockId);
		return { ok: true, blockId: result.blockId };
	},

	/**
	 * A Stock screen dropped into the page or started from (t150u): its renderable sections at slot `at` (default:
	 * the end), hard rules only, one undo step. With no page yet the chat first gets an empty page on that screen.
	 */
	addScreen(screenId: string, at?: number): { ok: true; blockId: string; added: number; skipped: string[] } | { ok: false; code: string; message: string } {
		let page = getCurrentPage();
		if (!page || (page.layout.blocks.length === 0 && !getCurrentProvenance()?.screenId)) {
			if (!startEmptyPageInChat(screenId)) return { ok: false, code: "not_started", message: "The empty page could not be started." };
			page = getCurrentPage();
		}
		if (!page) return { ok: false, code: "not_started", message: "The empty page could not be started." };
		historyFor(page).seal();
		const result = addScreenSections({ page, provenance: getCurrentProvenance(), revision: getPageRevision() ?? 0 }, screenId, at);
		if (!result.ok) return { ok: false, code: result.code, message: result.message };
		if (!commit(page, result, null)) return { ok: false, code: "not_committed", message: "The page did not accept the change." };
		selectBlock(result.blockId);
		return { ok: true, blockId: result.blockId, added: result.added.length, skipped: result.skipped };
	},

	/** The page's screen family (ADR 0027): stored (or derived when not recorded yet), whether pinned, and the derived one. */
	get family(): { family: PageFamily; pinned: boolean; derived: PageFamily } | null {
		void version;
		const page = getCurrentPage();
		if (!page) return null;
		const prov = getCurrentProvenance();
		const derived = deriveFamily(page.layout.blocks);
		return { family: prov?.family ?? derived, pinned: prov?.familyPinned === true, derived };
	},

	/** The last family change, for the non-modal label. */
	get familyNote(): { from: PageFamily | null; to: PageFamily | null; id: number } | null {
		return familyNote;
	},

	/** Pin a family (Sections), or null: back to Auto (derived from the composition). One undo step (set_family). */
	pinFamily(family: PageFamily | null): boolean {
		const page = getCurrentPage();
		const prov = getCurrentProvenance();
		if (!page || !prov) return false;
		const steps = historyFor(page);
		steps.seal();
		const next = family ? withFamily(prov, family, true) : withFamily(prov, deriveFamily(page.layout.blocks), false);
		if (next.family === (prov.family ?? null) && next.familyPinned === (prov.familyPinned === true)) return true;
		if (!replaceVisiblePage(page, null, "edit", { op: "set_family" }, next)) return false;
		steps.record({ page, provenance: prov }, { page, provenance: next }, null);
		noteFamily(prov.family, next.family);
		version += 1;
		return true;
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

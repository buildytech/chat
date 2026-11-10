/**
 * Page revisions (ADR 0015), pure. The applied page of a chat has one revision per committed change: a proposal applied,
 * one inspector edit (typing in one field coalesces into one edit, the same as one undo step), one block operation, one
 * undo or redo. A write that continues the open typing step (`extend`) keeps the revision; a pending proposal has no
 * revision of its own. An unchanged value never gets here (the inspector returns the same page and records nothing).
 */
import type { SessionRevisionCause } from "@buildytech/page-contract/session";

export type VisibleChange = "edit" | "extend" | "undo" | "redo";

export type RevisionStep = { revision: number | null; cause: SessionRevisionCause | null };

/** Revision after a change of the visible page. `onApplied` false: the change hit a pending proposal (no revision). */
export function nextRevision(current: number | null, change: VisibleChange, onApplied: boolean): RevisionStep {
	if (!onApplied) return { revision: current, cause: null };
	if (change === "extend" && current != null) return { revision: current, cause: null };
	return { revision: (current ?? 0) + 1, cause: change === "extend" ? "edit" : change };
}

/** Which change an inspector commit is: `extend` when it continues the open undo step of the same field. */
export function commitChange(continuesOpenStep: boolean): VisibleChange {
	return continuesOpenStep ? "extend" : "edit";
}

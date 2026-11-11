import { parsePageSpec, type Page, type PageBlock } from "@buildytech/page-contract";
import type { SessionRevisionCause, SessionRevisionOp } from "@buildytech/page-contract/session";
import { mockLandingPage } from "./fixture";
import { findBlock, firstBlockId, hasBlock } from "./tree";
import { nextRevision, type VisibleChange } from "./revision";
import {
	readSessionPages,
	writeSessionPages,
	type StoredPageProvenance,
	type StoredPageRecord
} from "../browser/persist";

export { mockLandingPage };

/**
 * Client page state. Unbound sessions keep `null` (blank Workspace — not the North Harbor fixture).
 * `$state.raw` avoids proxying the DTO. Do not introduce shared SSR module state.
 */
let currentPage = $state.raw<Page | null>(null);
let candidatePage = $state.raw<Page | null>(null);
let appliedProvenance = $state.raw<StoredPageProvenance | null>(null);
let candidateProvenance = $state.raw<StoredPageProvenance | null>(null);
let lastProposedPage = $state.raw<Page | null>(null);
let lastProposedProvenance = $state.raw<StoredPageProvenance | null>(null);
let selectedBlockId = $state<string | null>(null);
let pageRevision = $state<number | null>(null);
let boundSessionId: string | null = null;

/** A new revision of the applied page: one per committed change (ADR 0015). The chat store keeps session.pageRevision and the history in sync. */
export type RevisionEvent = {
	sessionId: string;
	revision: number;
	cause: SessionRevisionCause;
	pageId: string;
	blockId?: string;
	/** session 1.6.0: what the change did and where (JSON Pointer in the block's render props); never a value. */
	op?: SessionRevisionOp;
	path?: string;
};

/** What an inspector change did, for the history entry of its revision (session 1.6.0). */
export type RevisionMeta = { op?: SessionRevisionOp; path?: string };
let revisionListener: ((event: RevisionEvent) => void) | null = null;

export function onPageRevision(listener: ((event: RevisionEvent) => void) | null): void {
	revisionListener = listener;
}

function announce(cause: SessionRevisionCause, blockId?: string | null, meta?: RevisionMeta): void {
	if (!boundSessionId || !currentPage || pageRevision == null) return;
	revisionListener?.({
		sessionId: boundSessionId,
		revision: pageRevision,
		cause,
		pageId: currentPage.id,
		...(blockId ? { blockId } : {}),
		...(meta?.op ? { op: meta.op } : {}),
		...(meta?.path ? { path: meta.path } : {})
	});
}

/** Saved pages are page-spec/v1 documents: the published schema, then the parsePage program checks. */
function parseStored(raw: unknown): Page | null {
	if (raw == null) return null;
	try {
		return parsePageSpec(raw);
	} catch {
		return null;
	}
}

function persistBound(): void {
	if (!boundSessionId) return;
	const record: StoredPageRecord = {
		applied: currentPage,
		candidate: candidatePage,
		appliedProvenance,
		candidateProvenance,
		selectedBlockId,
		revision: pageRevision,
		lastProposed: lastProposedPage,
		lastProposedProvenance
	};
	writeSessionPages(boundSessionId, record);
}

function syncSelection(page: Page | null): void {
	if (!page) {
		selectedBlockId = null;
		return;
	}
	if (!hasBlock(page.layout.blocks, selectedBlockId)) {
		selectedBlockId = firstBlockId(page.layout.blocks);
	}
}

function restoreRecord(record: StoredPageRecord | null): void {
	const applied = parseStored(record?.applied);
	const candidate = parseStored(record?.candidate);
	currentPage = applied;
	candidatePage = candidate;
	appliedProvenance = record?.appliedProvenance ?? null;
	candidateProvenance = record?.candidateProvenance ?? null;
	lastProposedPage = parseStored(record?.lastProposed);
	lastProposedProvenance = lastProposedPage ? (record?.lastProposedProvenance ?? null) : null;
	pageRevision = typeof record?.revision === "number" ? record.revision : applied ? 1 : null;
	const visible = candidate ?? applied;
	if (visible && record?.selectedBlockId && hasBlock(visible.layout.blocks, record.selectedBlockId)) {
		selectedBlockId = record.selectedBlockId;
	} else {
		syncSelection(visible);
	}
}

/** Bind Workspace to a chat. Persists the previous session first. Does not write on restore. */
export function bindPageSession(sessionId: string | null): void {
	if (boundSessionId && boundSessionId !== sessionId) persistBound();
	boundSessionId = sessionId;
	if (!sessionId) {
		currentPage = null;
		candidatePage = null;
		appliedProvenance = null;
		candidateProvenance = null;
		lastProposedPage = null;
		lastProposedProvenance = null;
		selectedBlockId = null;
		pageRevision = null;
		return;
	}
	restoreRecord(readSessionPages(sessionId));
}

export function getBoundPageSessionId(): string | null {
	return boundSessionId;
}

/** Read-only: the page a chat shows in Preview (candidate, else applied), straight from storage. Binds and writes nothing. */
export function readPreviewPage(sessionId: string | null | undefined): Page | null {
	if (!sessionId) return null;
	const record = readSessionPages(sessionId);
	return parseStored(record?.candidate) ?? parseStored(record?.applied);
}

/** Preview prefers an unapplied candidate, then last applied. */
export function getCurrentPage(): Page | null {
	return candidatePage ?? currentPage;
}

export function getLastAppliedPage(): Page | null {
	return currentPage;
}

export function getCandidatePage(): Page | null {
	return candidatePage;
}

export function hasUnappliedProposal(): boolean {
	return candidatePage !== null;
}

export function getCurrentProvenance(): StoredPageProvenance | null {
	return candidateProvenance ?? appliedProvenance;
}

export function getAppliedProvenance(): StoredPageProvenance | null {
	return appliedProvenance;
}

/**
 * Base page for the next chat turn: the pending proposal the author is looking at, else the
 * applied page, else the last proposal (kept after Discard). Follow-ups edit this page.
 */
export function getEditBase(): { page: Page; provenance: StoredPageProvenance | null; source: "candidate" | "applied" | "last-proposal" } | null {
	if (candidatePage) return { page: candidatePage, provenance: candidateProvenance ?? appliedProvenance, source: "candidate" };
	if (currentPage) return { page: currentPage, provenance: appliedProvenance, source: "applied" };
	if (lastProposedPage) return { page: lastProposedPage, provenance: lastProposedProvenance, source: "last-proposal" };
	return null;
}

export function getPageRevision(): number | null {
	return pageRevision;
}

/** Pure read — do not mutate inside $derived. */
export function getSelectedBlockId(): string | null {
	return selectedBlockId;
}

/** Pure read — do not mutate inside $derived. */
export function getSelectedBlock(): PageBlock | null {
	const page = candidatePage ?? currentPage;
	if (!page) return null;
	return findBlock(page.layout.blocks, selectedBlockId);
}

export function selectBlock(id: string): void {
	const page = candidatePage ?? currentPage;
	if (!page || !hasBlock(page.layout.blocks, id)) return;
	selectedBlockId = id;
	persistBound();
}

/**
 * Replace the current page after central runtime validation.
 * Malformed input must not call this — callers parse first and keep the previous page on failure.
 */
export function setCurrentPage(page: Page, revision: number | null = null): void {
	const next = parsePageSpec(page);
	currentPage = next;
	candidatePage = null;
	appliedProvenance = null;
	candidateProvenance = null;
	lastProposedPage = null;
	lastProposedProvenance = null;
	pageRevision = revision;
	syncSelection(next);
	persistBound();
}

export function setCandidatePage(page: Page, provenance?: StoredPageProvenance | null): void {
	candidatePage = parsePageSpec(page);
	candidateProvenance = provenance ?? null;
	lastProposedPage = candidatePage;
	lastProposedProvenance = candidateProvenance;
	syncSelection(candidatePage);
	persistBound();
}

export function discardCandidate(): void {
	candidatePage = null;
	candidateProvenance = null;
	syncSelection(currentPage);
	persistBound();
}

export function applyCandidate(revision: number | null = null): boolean {
	if (!candidatePage) return false;
	currentPage = candidatePage;
	appliedProvenance = candidateProvenance ?? appliedProvenance;
	candidatePage = null;
	candidateProvenance = null;
	pageRevision = revision ?? (pageRevision ?? 0) + 1;
	syncSelection(currentPage);
	persistBound();
	announce("apply");
	return true;
}

export type { VisibleChange };

/**
 * Build inspector edits: replace the page Preview shows (the pending proposal, else the applied page) with a page the
 * inspector gate already checked (page-spec + props gate). The applied page gets the next revision for every committed
 * change (coalesced typing is one change, matching one undo step); a pending proposal stays pending and keeps no
 * revision. Block objects are kept as given, so unchanged blocks do not re-render.
 */
export function replaceVisiblePage(page: Page, selectId: string | null = null, change: VisibleChange = "edit", meta?: RevisionMeta): boolean {
	if (!candidatePage && !currentPage) return false;
	// The visible page is the pending proposal when there is one (no revision), else the applied page.
	const step = nextRevision(pageRevision, change, !candidatePage);
	if (candidatePage) {
		if (lastProposedPage === candidatePage) lastProposedPage = page;
		candidatePage = page;
	} else {
		currentPage = page;
		pageRevision = step.revision;
	}
	if (selectId && hasBlock(page.layout.blocks, selectId)) selectedBlockId = selectId;
	else syncSelection(page);
	persistBound();
	if (step.cause) announce(step.cause, selectId, step.cause === "edit" ? meta : undefined);
	return true;
}

/**
 * Empty start (ADR 0024): the bound chat gets an empty page (no sections) on its start Stock screen as the applied
 * page, revision 0 and no history entry; the first section is the next change (revision 1, one undo step back to
 * this empty page). A chat that already shows a page or a pending proposal is left alone (false).
 */
export function startEmptyPage(page: Page, provenance: StoredPageProvenance): boolean {
	if (!boundSessionId || candidatePage || (currentPage && currentPage.layout.blocks.length > 0)) return false;
	currentPage = parsePageSpec(page, { draft: true });
	appliedProvenance = provenance;
	candidateProvenance = null;
	pageRevision = pageRevision ?? 0;
	selectedBlockId = null;
	persistBound();
	return true;
}

/** Blank Workspace for a new / unbound session. Never loads the demo fixture. */
export function clearCurrentPage(): void {
	currentPage = null;
	candidatePage = null;
	appliedProvenance = null;
	candidateProvenance = null;
	lastProposedPage = null;
	lastProposedProvenance = null;
	selectedBlockId = null;
	pageRevision = null;
	persistBound();
}

/** Mock-mode only: seed the North Harbor fixture. */
export function loadMockFixturePage(): void {
	setCurrentPage(mockLandingPage, 1);
}

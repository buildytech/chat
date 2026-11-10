import { parsePageSpec, type Page, type PageBlock } from "@buildytech/page-contract";
import { mockLandingPage } from "./fixture";
import { findBlock, firstBlockId, hasBlock } from "./tree";
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

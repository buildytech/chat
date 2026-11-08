import { parsePage, type Page, type PageBlock } from "@buildytech/page-contract";
import { mockLandingPage } from "./fixture";
import { findBlock, firstBlockId, hasBlock } from "./tree";
import { readSessionPages, writeSessionPages, type StoredPageRecord } from "../browser/persist";

export { mockLandingPage };

/**
 * Client page state. Unbound sessions keep `null` (blank Workspace — not the North Harbor fixture).
 * `$state.raw` avoids proxying the DTO. Do not introduce shared SSR module state.
 */
let currentPage = $state.raw<Page | null>(null);
let candidatePage = $state.raw<Page | null>(null);
let selectedBlockId = $state<string | null>(null);
let pageRevision = $state<number | null>(null);
let boundSessionId: string | null = null;

function parseStored(raw: unknown): Page | null {
	if (raw == null) return null;
	try {
		return parsePage(raw);
	} catch {
		return null;
	}
}

function persistBound(): void {
	if (!boundSessionId) return;
	const record: StoredPageRecord = {
		applied: currentPage,
		candidate: candidatePage,
		selectedBlockId,
		revision: pageRevision
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
		selectedBlockId = null;
		pageRevision = null;
		return;
	}
	restoreRecord(readSessionPages(sessionId));
}

export function getBoundPageSessionId(): string | null {
	return boundSessionId;
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
	const next = parsePage(page);
	currentPage = next;
	candidatePage = null;
	pageRevision = revision;
	syncSelection(next);
	persistBound();
}

export function setCandidatePage(page: Page): void {
	candidatePage = parsePage(page);
	syncSelection(candidatePage);
	persistBound();
}

export function discardCandidate(): void {
	candidatePage = null;
	syncSelection(currentPage);
	persistBound();
}

export function applyCandidate(revision: number | null = null): boolean {
	if (!candidatePage) return false;
	currentPage = candidatePage;
	candidatePage = null;
	pageRevision = revision ?? (pageRevision ?? 0) + 1;
	syncSelection(currentPage);
	persistBound();
	return true;
}

/** Blank Workspace for a new / unbound session. Never loads the demo fixture. */
export function clearCurrentPage(): void {
	currentPage = null;
	candidatePage = null;
	selectedBlockId = null;
	pageRevision = null;
	persistBound();
}

/** Mock-mode only: seed the North Harbor fixture. */
export function loadMockFixturePage(): void {
	setCurrentPage(mockLandingPage, 1);
}

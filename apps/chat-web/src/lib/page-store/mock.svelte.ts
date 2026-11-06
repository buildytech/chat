import { parsePage, type Page, type PageBlock } from "@buildytech/page-contract";
import { mockLandingPage } from "./fixture";
import { findBlock, firstBlockId, hasBlock } from "./tree";

export { mockLandingPage };

/**
 * Client page state. Unbound sessions keep `null` (blank Workspace — not the North Harbor fixture).
 * `$state.raw` avoids proxying the DTO. Do not introduce shared SSR module state.
 */
let currentPage = $state.raw<Page | null>(null);
let selectedBlockId = $state<string | null>(null);
let pageRevision = $state<number | null>(null);

function syncSelection(page: Page | null): void {
	if (!page) {
		selectedBlockId = null;
		return;
	}
	if (!hasBlock(page.layout.blocks, selectedBlockId)) {
		selectedBlockId = firstBlockId(page.layout.blocks);
	}
}

/** Pure read — do not mutate inside $derived. */
export function getCurrentPage(): Page | null {
	return currentPage;
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
	if (!currentPage) return null;
	return findBlock(currentPage.layout.blocks, selectedBlockId);
}

export function selectBlock(id: string): void {
	if (!currentPage || !hasBlock(currentPage.layout.blocks, id)) return;
	selectedBlockId = id;
}

/**
 * Replace the current page after central runtime validation.
 * Malformed input must not call this — callers parse first and keep the previous page on failure.
 */
export function setCurrentPage(page: Page, revision: number | null = null): void {
	const next = parsePage(page);
	currentPage = next;
	pageRevision = revision;
	syncSelection(next);
}

/** Blank Workspace for a new / unbound session. Never loads the demo fixture. */
export function clearCurrentPage(): void {
	currentPage = null;
	selectedBlockId = null;
	pageRevision = null;
}

/** Mock-mode only: seed the North Harbor fixture. */
export function loadMockFixturePage(): void {
	setCurrentPage(mockLandingPage, 1);
}

import { parsePage, type Page, type PageBlock } from "@buildytech/page-contract";
import { mockLandingPage } from "./fixture";
import { findBlock, firstBlockId, hasBlock } from "./tree";

export { mockLandingPage };

/**
 * Client-only in-memory Store (layout `ssr = false`). Reassigned as a whole page;
 * `$state.raw` avoids proxying the DTO. Do not introduce shared SSR module state.
 */
let currentPage = $state.raw<Page>(mockLandingPage);
/** Hydrated at module init — do not assign inside $derived. */
let selectedBlockId = $state<string | null>(firstBlockId(mockLandingPage.layout.blocks));

function syncSelection(page: Page): void {
	if (!hasBlock(page.layout.blocks, selectedBlockId)) {
		selectedBlockId = firstBlockId(page.layout.blocks);
	}
}

/** Pure read — do not mutate inside $derived. */
export function getCurrentPage(): Page {
	return currentPage;
}

/** Pure read — do not mutate inside $derived. */
export function getSelectedBlockId(): string | null {
	return selectedBlockId;
}

/** Pure read — do not mutate inside $derived. */
export function getSelectedBlock(): PageBlock | null {
	return findBlock(currentPage.layout.blocks, selectedBlockId);
}

export function selectBlock(id: string): void {
	if (!hasBlock(currentPage.layout.blocks, id)) return;
	selectedBlockId = id;
}

/**
 * Replace the current page after central runtime validation.
 * Resets selection when the id is missing from the new tree.
 * Call from event handlers / loaders — never from $derived.
 */
export function setCurrentPage(page: Page): void {
	const next = parsePage(page);
	currentPage = next;
	syncSelection(next);
}

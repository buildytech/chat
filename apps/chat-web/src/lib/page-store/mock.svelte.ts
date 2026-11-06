import { mockLandingPage } from "./fixture";
import type { CreatorPage, PageBlock } from "./page";
import { findBlock, firstBlockId, hasBlock } from "./tree";

export { mockLandingPage };

let currentPage = $state<CreatorPage>(mockLandingPage);
/** Hydrated at module init — do not assign inside $derived. */
let selectedBlockId = $state<string | null>(firstBlockId(mockLandingPage.layout.blocks));

function syncSelection(page: CreatorPage): void {
	if (!hasBlock(page.layout.blocks, selectedBlockId)) {
		selectedBlockId = firstBlockId(page.layout.blocks);
	}
}

/** Pure read — do not mutate inside $derived. */
export function getCurrentPage(): CreatorPage {
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
 * Replace the current page. Resets selection when the id is missing from the new tree.
 * Call from event handlers / loaders — never from $derived.
 */
export function setCurrentPage(page: CreatorPage): void {
	currentPage = page;
	syncSelection(page);
}

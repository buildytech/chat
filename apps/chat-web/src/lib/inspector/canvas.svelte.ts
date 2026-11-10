/**
 * Canvas state of the Build editor shared by the preview frame, the block tree and the overlay: the hovered block
 * and a request to bring a block into view (selection from the tree). Selection itself stays in the page store.
 */
let hovered = $state<string | null>(null);
let reveal = $state<{ id: string; seq: number } | null>(null);
let seq = 0;

export const canvas = {
	get hovered(): string | null {
		return hovered;
	},
	hover(id: string | null): void {
		hovered = id;
	},
	/** The last reveal request; the overlay scrolls the frame to it once per request. */
	get reveal(): { id: string; seq: number } | null {
		return reveal;
	},
	requestReveal(id: string): void {
		seq += 1;
		reveal = { id, seq };
	}
};

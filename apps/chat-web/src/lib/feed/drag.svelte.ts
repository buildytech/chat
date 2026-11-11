/**
 * Dragging a Blocks feed card (ADR 0024 step C): a block, or a screen (t150u: its renderable sections). Only the card
 * being dragged lives here, not in the DataTransfer (unreadable during dragover); whether it fits is computed from
 * the item and the page at the moment it is asked (drop.svelte.ts), never cached from the result page it came from,
 * so the preview drop layer and the Sections list can show where it lands or why it cannot. A drop runs the same inspector add operation as "+" at the slot (every gate, one undo step, no
 * model call). The feed status line is shared, so a drop in the preview is announced where "+" is.
 */
import type { StockSearchItem } from "@buildytech/builder-core";

/** DataTransfer type of a feed card drag (its value is the item id). */
export const FEED_DRAG_TYPE = "application/x-buildy-block";

let item = $state<StockSearchItem | null>(null);
let status = $state<{ ok: boolean; text: string } | null>(null);

export const feedDrag = {
	get item(): StockSearchItem | null {
		return item;
	},
	get active(): boolean {
		return item !== null;
	},
	start(next: StockSearchItem): void {
		item = next;
	},
	end(): void {
		item = null;
	},
	/** The feed status line ("+", Start page and drops). */
	get status(): { ok: boolean; text: string } | null {
		return status;
	},
	set status(next: { ok: boolean; text: string } | null) {
		status = next;
	}
};

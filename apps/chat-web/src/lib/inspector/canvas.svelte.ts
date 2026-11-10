/**
 * Canvas state of the Build editor shared by the preview frame, the block tree and the overlay: the hovered block
 * and a request to bring a block into view (selection from the tree), plus the selected field of the selected block
 * (field-level selection, ADR 0021): its pointer and where the pick came from (a preview click or an inspector focus),
 * so the overlay outlines the field and the frame or the inspector brings it into view. Selection itself stays in the
 * page store.
 */
let hovered = $state<string | null>(null);
let reveal = $state<{ id: string; seq: number } | null>(null);
let seq = 0;
let field = $state<{ blockId: string; pointer: string; from: "preview" | "inspector"; seq: number } | null>(null);
let fieldSeq = 0;

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
	},
	/** The field picked on the selected block: its prop pointer and whether a preview click or an inspector focus set it. */
	get field(): { blockId: string; pointer: string; from: "preview" | "inspector"; seq: number } | null {
		return field;
	},
	selectField(blockId: string, pointer: string, from: "preview" | "inspector"): void {
		fieldSeq += 1;
		field = { blockId, pointer, from, seq: fieldSeq };
	},
	clearField(): void {
		field = null;
	}
};

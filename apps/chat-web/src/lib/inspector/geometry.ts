/**
 * Canvas geometry of the Build inspector: which page block a canvas element belongs to, and where it sits in the
 * chat document. The outline and label of a block are drawn by the chat (parent document) over the preview iframe,
 * never inside the page, so the page DOM stays the registry output. Pure functions, no Svelte, no DOM globals.
 */
import type { BlockV2 } from "@buildytech/page-contract";

/** The wrapper attribute of a page block in the preview (its value is the block id). */
export const BLOCK_ID_ATTR = "data-block-id";

export type CanvasRect = { x: number; y: number; width: number; height: number };

/** The top-level block that holds `id` (itself when it is top level); null when the page has no such block. */
export function topLevelBlockId(blocks: readonly Pick<BlockV2, "id">[], id: string | null | undefined): string | null {
	if (!id) return null;
	return blocks.find((block) => block.id === id)?.id ?? null;
}

/** CSS selector of a block wrapper; the id is quoted as a CSS string, so any id is safe. */
export function blockSelector(id: string): string {
	return `[${BLOCK_ID_ATTR}="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

/**
 * A rect measured in the iframe viewport (CSS px of the frame) mapped into the overlay layer, which shares the
 * iframe's top-left corner and its scale. Rects fully outside the frame viewport give null (nothing to draw).
 */
export function overlayRect(rect: CanvasRect, scale: number, viewport: { width: number; height: number }): CanvasRect | null {
	if (rect.width <= 0 || rect.height <= 0) return null;
	if (rect.y + rect.height <= 0 || rect.y >= viewport.height || rect.x + rect.width <= 0 || rect.x >= viewport.width) return null;
	const s = scale > 0 ? scale : 1;
	return { x: rect.x * s, y: rect.y * s, width: rect.width * s, height: rect.height * s };
}

export function sameRect(a: CanvasRect | null, b: CanvasRect | null): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

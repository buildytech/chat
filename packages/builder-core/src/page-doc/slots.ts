/**
 * Slot rules of a page-spec/v2 page (ADR 0034): header-like items (registry metadata: top edge) stay in the leading run,
 * footer-like items (bottom edge) in the trailing run, sections between. The same rule the gate enforces, as a cheap
 * pure check for drop feedback and the add / move ops.
 */
import type { BlockV2 } from "@buildytech/page-contract";
import { itemInfo } from "./items.ts";

export type SlotCheck = { ok: true } | { ok: false; code: "index_out_of_range" | "above_header" | "below_footer" | "header_top" | "footer_end"; message: string };

const edgeOf = (block: Pick<BlockV2, "item">) => itemInfo(block.item)?.edge ?? null;

/** Which edge a registry item keeps to: "top" (header-like), "bottom" (footer-like), or null (a section). */
export function itemEdge(item: string): "top" | "bottom" | null {
	return itemInfo(item)?.edge ?? null;
}

/** Whether a new item may go to slot `at` (0 = before the first block, length = after the last). */
export function addSlotCheck(blocks: readonly Pick<BlockV2, "item">[], item: string, at: number): SlotCheck {
	if (!Number.isInteger(at) || at < 0 || at > blocks.length) return { ok: false, code: "index_out_of_range", message: `A section goes to slot 0..${blocks.length}.` };
	let leading = 0;
	while (leading < blocks.length && edgeOf(blocks[leading]!) === "top") leading += 1;
	let trailing = blocks.length;
	while (trailing > leading && edgeOf(blocks[trailing - 1]!) === "bottom") trailing -= 1;
	const edge = itemEdge(item);
	if (edge === "top") return at <= leading ? { ok: true } : { ok: false, code: "header_top", message: "A header goes at the top of the page." };
	if (edge === "bottom") return at >= trailing ? { ok: true } : { ok: false, code: "footer_end", message: "A footer goes at the end of the page." };
	if (at < leading) return { ok: false, code: "above_header", message: "Sections go below the header." };
	if (at > trailing) return { ok: false, code: "below_footer", message: "Sections go above the footer." };
	return { ok: true };
}

/** The same rules for a block that moves from `from` to final index `to`. */
export function moveSlotCheck(blocks: readonly Pick<BlockV2, "item">[], from: number, to: number): SlotCheck {
	const moving = blocks[from];
	if (!moving || !Number.isInteger(to) || to < 0 || to >= blocks.length) return { ok: false, code: "index_out_of_range", message: `A section moves to 1..${blocks.length}.` };
	return addSlotCheck(
		blocks.filter((_, index) => index !== from),
		moving.item,
		to
	);
}

/** Where a new item goes when nobody said: header-like first, footer-like last, a section before the trailing footer run. */
export function naturalIndex(blocks: readonly Pick<BlockV2, "item">[], item: string): number {
	const edge = itemEdge(item);
	if (edge === "top") return 0;
	if (edge === "bottom") return blocks.length;
	let end = blocks.length;
	while (end > 0 && edgeOf(blocks[end - 1]!) === "bottom") end -= 1;
	return end;
}

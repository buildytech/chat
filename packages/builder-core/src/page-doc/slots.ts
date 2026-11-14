/**
 * Slots of a page-spec/v2 page. A page is composed freely (ADR 0037): any block may stand at any slot, and header-like and
 * footer-like items have no position or count rule (a banner above a header, several headers, a footer in the middle). The
 * only check left is that the slot exists. `naturalIndex` is a default for an add nobody gave a slot to, never a rule.
 */
import type { BlockV2 } from "@buildytech/page-contract";
import { itemInfo } from "./items.ts";

export type SlotCheck = { ok: true } | { ok: false; code: "index_out_of_range"; message: string };

const roleOf = (block: Pick<BlockV2, "item">) => itemInfo(block.item)?.role ?? null;

/** The informational registry role of an item: "header", "footer", or null (a section). */
export function itemRole(item: string): "header" | "footer" | null {
	return itemInfo(item)?.role ?? null;
}

/** Whether slot `at` exists (0 = before the first block, length = after the last). */
export function addSlotCheck(blocks: readonly Pick<BlockV2, "item">[], _item: string, at: number): SlotCheck {
	if (!Number.isInteger(at) || at < 0 || at > blocks.length) return { ok: false, code: "index_out_of_range", message: `A block goes to slot 0..${blocks.length}.` };
	return { ok: true };
}

/** Whether a block may move from `from` to final index `to`: the index must exist. */
export function moveSlotCheck(blocks: readonly Pick<BlockV2, "item">[], from: number, to: number): SlotCheck {
	if (!blocks[from] || !Number.isInteger(to) || to < 0 || to >= blocks.length) return { ok: false, code: "index_out_of_range", message: `A block moves to 0..${blocks.length - 1}.` };
	return { ok: true };
}

/**
 * Where a new item goes when nobody said (a default, not a rule; an explicit slot is always honoured): a header-like item
 * at the start, a footer-like one at the end, any other section before the footers that close the page.
 */
export function naturalIndex(blocks: readonly Pick<BlockV2, "item">[], item: string): number {
	const role = itemRole(item);
	if (role === "header") return 0;
	if (role === "footer") return blocks.length;
	let end = blocks.length;
	while (end > 0 && roleOf(blocks[end - 1]!) === "footer") end -= 1;
	return end;
}

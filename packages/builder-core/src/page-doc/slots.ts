/**
 * Slots of a page-spec/v2 page. A page is composed freely (ADR 0037): any block may stand at any slot. The only check is that
 * the slot exists. `naturalIndex` is a default for an add nobody gave a slot to, never a rule.
 */
import type { BlockV2 } from "@buildytech/page-contract";

export type SlotCheck = { ok: true } | { ok: false; code: "index_out_of_range"; message: string };

/** Whether slot `at` exists (0 = before the first block, length = after the last). */
export function addSlotCheck(blocks: readonly Pick<BlockV2, "item">[], at: number): SlotCheck {
	if (!Number.isInteger(at) || at < 0 || at > blocks.length) return { ok: false, code: "index_out_of_range", message: `A block goes to slot 0..${blocks.length}.` };
	return { ok: true };
}

/** Whether a block may move from `from` to final index `to`: the index must exist. */
export function moveSlotCheck(blocks: readonly Pick<BlockV2, "item">[], from: number, to: number): SlotCheck {
	if (!blocks[from] || !Number.isInteger(to) || to < 0 || to >= blocks.length) return { ok: false, code: "index_out_of_range", message: `A block moves to 0..${blocks.length - 1}.` };
	return { ok: true };
}

/** Where a new item goes when nobody said: the end of the page (a default, not a rule; an explicit slot is always honoured). */
export function naturalIndex(blocks: readonly Pick<BlockV2, "item">[], _item: string): number {
	return blocks.length;
}

/**
 * Author operations on a page-spec/v2 page (the inspector, the Sections list, the Blocks feed, drag and +). Each one is
 * a plain JSON edit of the page document that goes through the one write (`writePage`: normalization, the gate, the
 * diff), so a hand edit and an agent edit follow exactly the same rules. Pure: returns the next page or why not.
 */
import { cloneJson, type BlockV2, type PageV2 } from "@buildytech/page-contract";
import { coerceEnumValue } from "../catalog/props-fill.ts";
import { addSlotCheck, moveSlotCheck, naturalIndex } from "./slots.ts";
import { screenItems } from "./start.ts";
import { catalogEntryBySpec } from "../catalog/sources.ts";
import { itemInfo, itemOfSpec } from "./items.ts";
import { sampleProps } from "./render.ts";
import { freshBlockId, writePage } from "./write.ts";
import { ensureParents, fail, done, liveProps, pruneEmpty, replaceProps, setAtPointer, type OpName, type OpResult, type PageOp } from "./ops-core.ts";
import { listRowOp, mapEntryOp } from "./ops-rows.ts";

export { setAtPointer };
export type { OpName, OpResult, PageOp };

/** Whether a Stock catalog block variant can be added to a page (the Blocks feed "+" and drag): a registry item that renders. */
export type AddCheck =
	| { ok: true; item: string; variant: string }
	| { ok: false; code: "unknown_block" | "no_renderer" | "unknown_variant"; message: string };

export function checkAdd(spec: string, variant?: string | null): AddCheck {
	const entry = catalogEntryBySpec(spec);
	if (!entry?.available) return { ok: false, code: "unknown_block", message: `${spec} is not a Stock catalog block.` };
	const item = itemOfSpec(spec);
	const info = item ? itemInfo(item) : null;
	if (!item || !info) return { ok: false, code: "no_renderer", message: `${spec} has no registry item that renders in this BuildY version yet.` };
	const want = variant || info.defaultVariant;
	if (!info.variants.includes(want)) return { ok: false, code: "unknown_variant", message: `${spec} has no variant ${want}.` };
	return { ok: true, item, variant: want };
}

const indexOfBlock = (page: PageV2, id: string) => page.blocks.findIndex((block) => block.id === id);

/** One page operation. An operation that changes nothing returns the very same page object (no step, no revision). */
export function applyOp(page: PageV2, input: PageOp): OpResult {
	const result = applyOpInner(page, input);
	return result.ok && result.diff.length === 0 ? { ...result, page } : result;
}

/** The registry item and variant an add or replace names, or why not. */
function itemAndVariant(item: string, variant: string | null | undefined): { ok: true; variant: string } | { ok: false; result: OpResult } {
	const info = itemInfo(item);
	if (!info) return { ok: false, result: fail("unknown_item", `${item} is not a registry item that renders.`) };
	const want = variant ?? info.defaultVariant;
	if (!info.variants.includes(want)) return { ok: false, result: fail("unknown_variant", `${item} has no variant ${want}.`) };
	return { ok: true, variant: want };
}

function pageFieldOp(page: PageV2, input: Extract<PageOp, { op: "page" }>): OpResult {
	const path = input.field === "seo.title" ? "/seo/title" : input.field === "seo.description" ? "/seo/description" : `/${input.field}`;
	const patch: Array<{ op: "add" | "replace"; path: string; value: unknown }> = [];
	if (path.startsWith("/seo/") && !page.seo) patch.push({ op: "add", path: "/seo", value: {} });
	patch.push({ op: path.startsWith("/seo/") && (page.seo as Record<string, unknown> | undefined)?.[path.slice(5)] === undefined ? "add" : "replace", path, value: input.value });
	return done(writePage(page, { patch }), "", "set_field", path);
}

function addOp(page: PageV2, input: Extract<PageOp, { op: "add" }>): OpResult {
	const named = itemAndVariant(input.item, input.variant);
	if (!named.ok) return named.result;
	const at = input.at ?? naturalIndex(page.blocks, input.item);
	const slot = addSlotCheck(page.blocks, input.item, at);
	if (!slot.ok) return fail(slot.code, slot.message);
	const result = writePage(page, { patch: [{ op: "add", path: `/blocks/${at}`, value: { item: input.item, variant: named.variant } }] });
	return done(result, result.ok ? result.page.blocks[at]!.id : "", input.at === undefined ? "add" : "insert");
}

function setOp(page: PageV2, index: number, block: BlockV2, input: Extract<PageOp, { op: "set" }>): OpResult {
	if (!input.pointer.startsWith("/")) return fail("bad_pointer", "A prop pointer starts with /.", input.pointer);
	const live = liveProps(block);
	const base = input.value === undefined ? live : ensureParents(block.item, live, input.pointer);
	const written = base ? setAtPointer(base, input.pointer, coerceEnumValue(block.item, input.pointer, input.value)) : null;
	const next = written && input.value === undefined ? pruneEmpty(block.item, written, input.pointer) : written;
	if (!next) return fail("path_not_found", `${input.pointer} does not exist in the props of ${block.item}.`, input.pointer);
	return replaceProps(page, index, next, "set_field", input.pointer);
}

function setVariantOp(page: PageV2, index: number, block: BlockV2, variant: string): OpResult {
	if (!itemInfo(block.item)?.variants.includes(variant)) return fail("unknown_variant", `${block.item} has no variant ${variant}.`);
	return done(writePage(page, { patch: [{ op: "replace", path: `/blocks/${index}/variant`, value: variant }] }), block.id, "set_variant");
}

function moveOp(page: PageV2, index: number, block: BlockV2, to: number): OpResult {
	const slot = moveSlotCheck(page.blocks, index, to);
	if (!slot.ok) return fail(slot.code, slot.message);
	if (to === index) return { ok: true, page, blockId: block.id, op: "move", diff: [], warnings: [] };
	return done(writePage(page, { patch: [{ op: "move", from: `/blocks/${index}`, path: `/blocks/${to}` }] }), block.id, "move");
}

function duplicateOp(page: PageV2, index: number, block: BlockV2): OpResult {
	const id = freshBlockId(block.item, new Set(page.blocks.map((entry) => entry.id)));
	const copy: BlockV2 = { ...cloneJson(block), id };
	if (copy.props && typeof copy.props.id === "string") copy.props = { ...copy.props, id };
	return done(writePage(page, { patch: [{ op: "add", path: `/blocks/${index + 1}`, value: copy }] }), id, "insert");
}

function replaceOp(page: PageV2, index: number, block: BlockV2, input: Extract<PageOp, { op: "replace" }>): OpResult {
	const named = itemAndVariant(input.item, input.variant);
	if (!named.ok) return named.result;
	const patch: Array<{ op: "replace"; path: string; value: unknown }> = [
		{ op: "replace", path: `/blocks/${index}/item`, value: input.item },
		{ op: "replace", path: `/blocks/${index}/variant`, value: named.variant }
	];
	return done(writePage(page, { patch }), block.id, "replace");
}

function applyOpInner(page: PageV2, input: PageOp): OpResult {
	if (input.op === "page") return pageFieldOp(page, input);
	if (input.op === "add") return addOp(page, input);
	const index = indexOfBlock(page, input.blockId);
	if (index < 0) return fail("unknown_block", `No block ${input.blockId} on the page.`);
	const block = page.blocks[index]!;
	switch (input.op) {
		case "set":
			return setOp(page, index, block, input);
		case "set_variant":
			return setVariantOp(page, index, block, input.variant);
		case "reset":
			return replaceProps(page, index, sampleProps(block.item, block.variant, block.id), "replace");
		case "move":
			return moveOp(page, index, block, input.to);
		case "duplicate":
			return duplicateOp(page, index, block);
		case "remove":
			return done(writePage(page, { patch: [{ op: "remove", path: `/blocks/${index}` }] }), page.blocks[index + 1]?.id ?? page.blocks[index - 1]?.id ?? "", "remove");
		case "replace":
			return replaceOp(page, index, block, input);
		case "map_entry":
			return mapEntryOp(page, index, block, input);
		case "list_row":
			return listRowOp(page, index, block, input);
	}
}

/** Drop a Stock screen into a page: its renderable sections as adds at slot `at` (default: the end), in the screen's order; one result, one undo step. */
export function addScreen(page: PageV2, screenId: string, at?: number): (Extract<OpResult, { ok: true }> & { added: string[]; skipped: string[] }) | Extract<OpResult, { ok: false }> {
	const { items, missing } = screenItems(screenId);
	const skipped = [...missing];
	if (!items.length) return { ...(fail("no_sections", `${screenId} has no section this BuildY version renders.`) as Extract<OpResult, { ok: false }>) };
	let next = page;
	let slot = Math.max(0, Math.min(at ?? page.blocks.length, page.blocks.length));
	const added: string[] = [];
	let first: Extract<OpResult, { ok: false }> | null = null;
	let last: Extract<OpResult, { ok: true }> | null = null;
	for (const entry of items) {
		const result = applyOp(next, { op: "add", item: entry.item, variant: entry.variant, at: slot });
		if (!result.ok) {
			first ??= result;
			skipped.push(entry.item);
			continue;
		}
		next = result.page;
		last = result;
		added.push(result.blockId);
		slot += 1;
	}
	if (!last) return first ?? (fail("nothing_added", `No section of ${screenId} fits this page.`) as Extract<OpResult, { ok: false }>);
	return { ...last, page: next, blockId: added[0]!, op: "insert", added, skipped };
}

/**
 * Author operations on a page-spec/v2 page (the inspector, the Sections list, the Blocks feed, drag and +). Each one is
 * a plain JSON edit of the page document that goes through the one write (`writePage`: normalization, the gate, the
 * diff), so a hand edit and an agent edit follow exactly the same rules. Pure: returns the next page or why not.
 */
import type { BlockV2, PageV2, PropValueV2 } from "@buildytech/page-contract";
import { coerceEnumValue, mapKeyIssue, newPropsListRow, newPropsListValue, newPropsMapValue, pointerInfo } from "../catalog/props-schema.ts";
import { addSlotCheck, moveSlotCheck, naturalIndex } from "./slots.ts";
import { screenItems } from "./start.ts";
import { catalogEntryBySpec } from "../catalog/sources.ts";
import { itemInfo, itemOfSpec } from "./items.ts";
import { pointerKey } from "./inspect.ts";
import { cloneJson, effectiveProps, sampleProps } from "./render.ts";
import { freshBlockId, writePage, type WriteResult } from "./write.ts";
import type { DocIssue } from "./gate.ts";
import type { DiffEntry } from "./diff.ts";

export type PageOp =
	| { op: "set"; blockId: string; pointer: string; value: PropValueV2 | undefined }
	| { op: "set_variant"; blockId: string; variant: string }
	| { op: "reset"; blockId: string }
	| { op: "move"; blockId: string; to: number }
	| { op: "duplicate"; blockId: string }
	| { op: "remove"; blockId: string }
	| { op: "add"; item: string; variant?: string | null; at?: number }
	| { op: "replace"; blockId: string; item: string; variant?: string | null }
	| { op: "list_row"; blockId: string; pointer: string; action: "add" | "remove" | "up" | "down" | "duplicate"; row?: number }
	| { op: "map_entry"; blockId: string; pointer: string; action: "add" | "remove" | "rename"; key?: string; to?: string }
	| { op: "page"; field: "title" | "slug" | "locale" | "seo.title" | "seo.description"; value: string };

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

/** The most entries a list holds in the Inspector (records and plain values alike), unless its schema says fewer. */
const MAX_ROWS = 24;

/** What a session history entry says an edit did (session 1.6.0 `op`). */
export type OpName = "set_field" | "set_variant" | "add" | "move" | "remove" | "insert" | "replace";

export type OpResult =
	| { ok: true; page: PageV2; blockId: string; op: OpName; path?: string; diff: DiffEntry[]; warnings: string[] }
	| { ok: false; code: string; message: string; pointer?: string; issues: DocIssue[] };

const fail = (code: string, message: string, pointer = ""): OpResult => ({ ok: false, code, message, pointer, issues: [{ path: pointer || "/", code, expected: message }] });

function done(result: WriteResult, blockId: string, op: OpName, path?: string): OpResult {
	if (!result.ok) return { ok: false, code: result.issues[0]?.code ?? "write_invalid", message: `${result.issues[0]?.path ?? "/"}: ${result.issues[0]?.expected ?? result.message}`, pointer: result.issues[0]?.path, issues: result.issues };
	return { ok: true, page: result.page, blockId, op, ...(path ? { path } : {}), diff: result.diff, warnings: result.warnings };
}

const indexOfBlock = (page: PageV2, id: string) => page.blocks.findIndex((block) => block.id === id);

function pointerParts(pointer: string): string[] {
	return pointer.split("/").slice(1).map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/** A copy of `props` with `value` written at `pointer` (undefined removes it); null when the path does not exist above the last key. */
export function setAtPointer(props: Record<string, unknown>, pointer: string, value: unknown): Record<string, unknown> | null {
	const parts = pointerParts(pointer);
	if (!parts.length) return null;
	const root = cloneJson(props);
	let at: unknown = root;
	for (const part of parts.slice(0, -1)) {
		if (at === null || typeof at !== "object") return null;
		at = (at as Record<string, unknown>)[part];
	}
	if (at === null || typeof at !== "object") return null;
	const last = parts[parts.length - 1]!;
	if (Array.isArray(at)) {
		const index = Number(last);
		if (!Number.isInteger(index) || index < 0 || index > at.length) return null;
		if (value === undefined) at.splice(index, 1);
		else at[index] = value;
	} else if (value === undefined) delete (at as Record<string, unknown>)[last];
	else (at as Record<string, unknown>)[last] = value;
	return root;
}

function valueAt(data: unknown, pointer: string): unknown {
	let current = data;
	for (const part of pointerParts(pointer)) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

/**
 * A copy of `props` where every optional object above `pointer` exists (`{}`; the write fills what the schema requires of it),
 * so an edit under an absent optional object creates just the path it needs. Null when a missing parent is not an object
 * of the schema (a missing list has no row to step into).
 */
function ensureParents(item: string, props: Record<string, unknown>, pointer: string): Record<string, unknown> | null {
	const parts = pointerParts(pointer);
	let next = props;
	for (let depth = 1; depth < parts.length; depth += 1) {
		const prefix = `/${parts.slice(0, depth).map((part) => part.replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`;
		const here = valueAt(next, prefix);
		if (here !== undefined && here !== null) continue;
		if (pointerInfo(item, prefix)?.kind !== "object") return null;
		const made = setAtPointer(next, prefix, {});
		if (!made) return null;
		next = made;
	}
	return next;
}

/** `props` without the optional objects `pointer` leaves empty once its own value is gone (a cleared edit never leaves `{}` behind). */
function pruneEmpty(item: string, props: Record<string, unknown>, pointer: string): Record<string, unknown> {
	let next = props;
	const parts = pointerParts(pointer);
	for (let depth = parts.length - 1; depth >= 1; depth -= 1) {
		const prefix = `/${parts.slice(0, depth).join("/")}`;
		const here = valueAt(next, prefix);
		const info = pointerInfo(item, prefix);
		if (!info || info.required || (info.kind !== "object" && info.kind !== "map") || !here || typeof here !== "object" || Array.isArray(here) || Object.keys(here).length) break;
		next = setAtPointer(next, prefix, undefined) ?? next;
	}
	return next;
}

/** The effective props of a block (what the component renders) as the base of an edit. */
function liveProps(block: BlockV2): Record<string, unknown> {
	return effectiveProps(block.item, block.variant, block.props);
}

function replaceProps(page: PageV2, index: number, props: Record<string, unknown>, op: OpName, path?: string): OpResult {
	const block = page.blocks[index]!;
	return done(writePage(page, { patch: [{ op: "replace", path: `/blocks/${index}/props`, value: props }] }), block.id, op, path);
}

/** One page operation. An operation that changes nothing returns the very same page object (no step, no revision). */
export function applyOp(page: PageV2, input: PageOp): OpResult {
	const result = applyOpInner(page, input);
	return result.ok && result.diff.length === 0 ? { ...result, page } : result;
}

function applyOpInner(page: PageV2, input: PageOp): OpResult {
	if (input.op === "page") {
		const path = input.field === "seo.title" ? "/seo/title" : input.field === "seo.description" ? "/seo/description" : `/${input.field}`;
		const patch: Array<{ op: "add" | "replace"; path: string; value: unknown }> = [];
		if (path.startsWith("/seo/") && !page.seo) patch.push({ op: "add", path: "/seo", value: {} });
		patch.push({ op: path.startsWith("/seo/") && (page.seo as Record<string, unknown> | undefined)?.[path.slice(5)] === undefined ? "add" : "replace", path, value: input.value });
		return done(writePage(page, { patch }), "", "set_field", path);
	}
	if (input.op === "add") {
		const info = itemInfo(input.item);
		if (!info) return fail("unknown_item", `${input.item} is not a registry item that renders.`);
		const variant = input.variant ?? info.defaultVariant;
		if (!info.variants.includes(variant)) return fail("unknown_variant", `${input.item} has no variant ${variant}.`);
		const at = input.at ?? naturalIndex(page.blocks, input.item);
		const slot = addSlotCheck(page.blocks, input.item, at);
		if (!slot.ok) return fail(slot.code, slot.message);
		const result = writePage(page, { patch: [{ op: "add", path: `/blocks/${at}`, value: { item: input.item, variant } }] });
		return done(result, result.ok ? result.page.blocks[at]!.id : "", input.at === undefined ? "add" : "insert");
	}
	const index = indexOfBlock(page, input.blockId);
	if (index < 0) return fail("unknown_block", `No block ${input.blockId} on the page.`);
	const block = page.blocks[index]!;
	switch (input.op) {
		case "set": {
			if (!input.pointer.startsWith("/")) return fail("bad_pointer", "A prop pointer starts with /.", input.pointer);
			const live = liveProps(block);
			const base = input.value === undefined ? live : ensureParents(block.item, live, input.pointer);
			const written = base ? setAtPointer(base, input.pointer, coerceEnumValue(block.item, input.pointer, input.value)) : null;
			const next = written && input.value === undefined ? pruneEmpty(block.item, written, input.pointer) : written;
			if (!next) return fail("path_not_found", `${input.pointer} does not exist in the props of ${block.item}.`, input.pointer);
			return replaceProps(page, index, next, "set_field", input.pointer);
		}
		case "set_variant": {
			const info = itemInfo(block.item);
			if (!info?.variants.includes(input.variant)) return fail("unknown_variant", `${block.item} has no variant ${input.variant}.`);
			return done(writePage(page, { patch: [{ op: "replace", path: `/blocks/${index}/variant`, value: input.variant }] }), block.id, "set_variant");
		}
		case "reset":
			return replaceProps(page, index, sampleProps(block.item, block.variant, block.id), "replace");
		case "move": {
			const slot = moveSlotCheck(page.blocks, index, input.to);
			if (!slot.ok) return fail(slot.code, slot.message);
			if (input.to === index) return { ok: true, page, blockId: block.id, op: "move", diff: [], warnings: [] };
			return done(writePage(page, { patch: [{ op: "move", from: `/blocks/${index}`, path: `/blocks/${input.to}` }] }), block.id, "move");
		}
		case "duplicate": {
			if (itemInfo(block.item)?.edge) return fail("edge_item", "A header or footer is on the page once.");
			const id = freshBlockId(block.item, new Set(page.blocks.map((entry) => entry.id)));
			const copy: BlockV2 = { ...cloneJson(block), id };
			if (copy.props && typeof copy.props.id === "string") copy.props = { ...copy.props, id };
			const result = writePage(page, { patch: [{ op: "add", path: `/blocks/${index + 1}`, value: copy }] });
			return done(result, id, "insert");
		}
		case "remove":
			return done(writePage(page, { patch: [{ op: "remove", path: `/blocks/${index}` }] }), page.blocks[index + 1]?.id ?? page.blocks[index - 1]?.id ?? "", "remove");
		case "replace": {
			const info = itemInfo(input.item);
			if (!info) return fail("unknown_item", `${input.item} is not a registry item that renders.`);
			const variant = input.variant ?? info.defaultVariant;
			if (!info.variants.includes(variant)) return fail("unknown_variant", `${input.item} has no variant ${variant}.`);
			const patch: Array<{ op: "replace"; path: string; value: unknown }> = [
				{ op: "replace", path: `/blocks/${index}/item`, value: input.item },
				{ op: "replace", path: `/blocks/${index}/variant`, value: variant }
			];
			return done(writePage(page, { patch }), block.id, "replace");
		}
		case "map_entry": {
			let props = liveProps(block);
			const shape = pointerInfo(block.item, input.pointer);
			if (shape?.kind !== "map") return fail("not_a_map", `${input.pointer} is not a map of values.`, input.pointer);
			let map = valueAt(props, input.pointer);
			// an optional map that is absent: `add` creates it (and the optional objects above it)
			if (map === undefined || map === null) {
				const parents = input.action === "add" ? ensureParents(block.item, props, input.pointer) : null;
				if (!parents) return fail("not_a_map", `${input.pointer} has no entries.`, input.pointer);
				props = parents;
				map = {};
			}
			if (typeof map !== "object" || Array.isArray(map)) return fail("not_a_map", `${input.pointer} is not a map of values.`, input.pointer);
			const entries = Object.entries(map as Record<string, unknown>);
			const keys = entries.map(([key]) => key);
			const max = Math.min(shape.maxItems ?? MAX_ROWS, MAX_ROWS);
			const issue = (code: "empty_key" | "duplicate_key" | "bad_key", key: string) =>
				fail(code, code === "empty_key" ? "A key is not empty." : code === "duplicate_key" ? `The key "${key}" is already used.` : `"${key}" is not a key a page may write here: a letter first, then letters, digits or _ (48 at most)${shape.keyPattern ? `, and ${shape.keyPattern}` : ""}.`, input.pointer);
			let next: Array<[string, unknown]>;
			let touched = input.key ?? "";
			let name: OpName = "set_field";
			if (input.action === "add") {
				if (keys.length >= max) return fail("max_rows", `${input.pointer} holds at most ${max} entries.`, input.pointer);
				let key = input.key;
				if (key === undefined) {
					let n = keys.length + 1;
					while (keys.includes(`key${n}`)) n += 1;
					key = `key${n}`;
				}
				const bad = mapKeyIssue(key, keys, shape.keyPattern);
				if (bad) return issue(bad, key);
				const value = newPropsMapValue(block.item, input.pointer, Object.values(map as Record<string, unknown>));
				if (value === undefined) return fail("not_a_map", `${input.pointer} is not a map the Inspector adds to.`, input.pointer);
				next = [...entries, [key, value]];
				touched = key;
				name = "add";
			} else {
				const key = input.key ?? "";
				if (!keys.includes(key)) return fail("unknown_key", `${input.pointer} has no key "${key}".`, input.pointer);
				if (input.action === "remove") {
					if (keys.length - 1 < (shape.minItems ?? 0) && !(keys.length === 1 && shape.required === false)) return fail("min_rows", `${input.pointer} needs at least ${shape.minItems} entries.`, input.pointer);
					next = entries.filter(([k]) => k !== key);
					name = "remove";
				} else {
					const to = input.to ?? "";
					const bad = to === key ? null : mapKeyIssue(to, keys.filter((k) => k !== key), shape.keyPattern);
					if (bad) return issue(bad, to);
					next = entries.map(([k, v]) => (k === key ? [to, v] : [k, v]));
					touched = to;
				}
			}
			const emptied = !next.length && shape.required === false;
			const written = setAtPointer(props, input.pointer, emptied ? undefined : Object.fromEntries(next));
			const result = written && emptied ? pruneEmpty(block.item, written, input.pointer) : written;
			if (!result) return fail("path_not_found", `${input.pointer} does not exist.`, input.pointer);
			return replaceProps(page, index, result, name, `${input.pointer}/${pointerKey(touched)}`);
		}
		case "list_row": {
			let props = liveProps(block);
			let rows = valueAt(props, input.pointer);
			// an optional list that is absent: `add` creates it (and the optional objects above it), the other actions have no row
			if (rows === undefined && input.action === "add" && pointerInfo(block.item, input.pointer)?.kind === "array") {
				const parents = ensureParents(block.item, props, input.pointer);
				if (parents) {
					props = parents;
					rows = [];
				}
			}
			if (!Array.isArray(rows)) return fail("not_a_list", `${input.pointer} is not a list.`, input.pointer);
			const row = input.row ?? rows.length - 1;
			const list = [...rows];
			let name: OpName = "replace";
			const shape = pointerInfo(block.item, input.pointer);
			const max = Math.min(shape?.maxItems ?? MAX_ROWS, MAX_ROWS);
			if ((input.action === "add" || input.action === "duplicate") && list.length >= max) return fail("max_rows", `${input.pointer} holds at most ${max} entries.`, input.pointer);
			if (input.action === "add") {
				// a list of records adds a row of its required fields, a list of plain values one new entry
				const fresh = newPropsListRow(block.item, input.pointer, rows) ?? newPropsListValue(block.item, input.pointer, rows);
				if (fresh === undefined || fresh === null) return fail("not_a_record_list", `${input.pointer} is not a list the Inspector adds to.`, input.pointer);
				list.push(fresh);
				name = "add";
			} else if (input.action === "remove" && list.length - 1 < (shape?.minItems ?? 0) && !(list.length === 1 && shape?.required === false)) {
				return fail("min_rows", `${input.pointer} needs at least ${shape?.minItems} entries.`, input.pointer);
			} else if (!Number.isInteger(row) || row < 0 || row >= list.length) return fail("index_out_of_range", `Row ${row + 1} is not in the list.`, input.pointer);
			else if (input.action === "remove") {
				list.splice(row, 1);
				name = "remove";
			} else if (input.action === "duplicate") {
				const copy = cloneJson(list[row]) as Record<string, unknown>;
				if (copy && typeof copy.id === "string") copy.id = `${copy.id}-copy`.slice(0, 64);
				list.splice(row + 1, 0, copy);
				name = "insert";
			} else {
				const to = input.action === "up" ? row - 1 : row + 1;
				if (to < 0 || to >= list.length) return fail("index_out_of_range", `Row ${row + 1} cannot move ${input.action}.`, input.pointer);
				[list[row], list[to]] = [list[to], list[row]];
				name = "move";
			}
			// the last row of an optional list taken away leaves the list absent, not an empty (maybe invalid) one
			const emptied = !list.length && pointerInfo(block.item, input.pointer)?.required === false;
			const written = setAtPointer(props, input.pointer, emptied ? undefined : list);
			const next = written && emptied ? pruneEmpty(block.item, written, input.pointer) : written;
			if (!next) return fail("path_not_found", `${input.pointer} does not exist.`, input.pointer);
			return replaceProps(page, index, next, name, `${input.pointer}/${input.action === "add" ? list.length - 1 : row}`);
		}
	}
}

/** Drop a Stock screen into a page: its renderable sections as adds at slot `at` (default: the end); one result, one undo step. */
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
		const edge = itemInfo(entry.item)?.edge ?? null;
		if (edge && next.blocks.some((block) => itemInfo(block.item)?.edge === edge)) {
			skipped.push(entry.item);
			continue;
		}
		const target = edge === "top" ? 0 : edge === "bottom" ? next.blocks.length : slot;
		const result = applyOp(next, { op: "add", item: entry.item, variant: entry.variant, at: target });
		if (!result.ok) {
			first ??= result;
			skipped.push(entry.item);
			continue;
		}
		next = result.page;
		last = result;
		added.push(result.blockId);
		if (edge === "top") slot += 1;
		else if (!edge) slot = target + 1;
	}
	if (!last) return first ?? (fail("nothing_added", `No section of ${screenId} fits this page.`) as Extract<OpResult, { ok: false }>);
	return { ...last, page: next, blockId: added[0]!, op: "insert", added, skipped };
}

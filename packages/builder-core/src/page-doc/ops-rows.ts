/**
 * The two row operations of the Inspector on a block's props: a map of values (`map_entry`) and a list (`list_row`).
 * Each returns the next page through the one write, or why not (`ops-core.ts`).
 */
import { cloneJson, type PageV2, type BlockV2 } from "@buildytech/page-contract";
import { mapKeyIssue, newPropsListRow, newPropsListValue, newPropsMapValue } from "../catalog/props-fill.ts";
import { pointerInfo } from "../catalog/props-schema.ts";
import { pointerKey } from "./inspect.ts";
import { MAX_ROWS, ensureParents, fail, liveProps, pruneEmpty, replaceProps, setAtPointer, valueAt, type OpName, type OpResult, type PageOp } from "./ops-core.ts";

export function mapEntryOp(page: PageV2, index: number, block: BlockV2, input: Extract<PageOp, { op: "map_entry" }>): OpResult {
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

export function listRowOp(page: PageV2, index: number, block: BlockV2, input: Extract<PageOp, { op: "list_row" }>): OpResult {
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
		let name: OpName;
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

/**
 * Block props overrides (page-spec 1.3.0, ADR 0024 inspector P1): `block.props` maps JSON Pointers of the props of the
 * registry item a top-level block renders (registry.buildy.tw/props/v0.json: `/actions/secondary`, `/content/card/title`,
 * `/content/features`) to plain JSON values. They are merged last, over the variant preset and the page content, so the
 * preview, the props gate and the exported Svelte source see exactly the same props. Pure data, no Svelte.
 *
 * Pointers never overlap: writing `/content/features/0/title` while `/content/features` is overridden writes inside that
 * list value; writing `/content/features` drops every override below it.
 */
import type { PageBlock, PagePropValue } from "@buildytech/page-contract";
import { propsFieldTree, type PropsFieldNode } from "./props-schema.ts";

type Json = unknown;
export type PropsOverrides = Record<string, PagePropValue>;

function isObject(value: Json): value is Record<string, Json> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `/content/features/0/title` -> ["content", "features", "0", "title"] (RFC 6901 unescaped). */
export function pointerParts(pointer: string): string[] {
	return pointer.split("/").slice(1).map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function clone<T>(value: T): T {
	return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/** A copy of `target` with `value` at `parts` (missing objects / arrays are created; undefined removes the key). */
export function setAt(target: Json, parts: readonly string[], value: Json): Json {
	if (!parts.length) return clone(value);
	const [head, ...rest] = parts as [string, ...string[]];
	const index = /^\d+$/.test(head) ? Number(head) : null;
	if (Array.isArray(target) || (index !== null && !isObject(target))) {
		const list = Array.isArray(target) ? [...target] : [];
		const at = index ?? list.length;
		if (rest.length === 0 && value === undefined) list.splice(at, 1);
		else list[at] = setAt(list[at], rest, value);
		return list;
	}
	const obj: Record<string, Json> = isObject(target) ? { ...target } : {};
	if (rest.length === 0 && value === undefined) delete obj[head];
	else obj[head] = setAt(obj[head], rest, value);
	return obj;
}

export function valueAtPointer(data: Json, pointer: string): Json {
	let current = data;
	for (const part of pointerParts(pointer)) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, Json>)[part];
	}
	return current;
}

/** Overrides merged over the rendered props, shortest pointer first (an override of a list, then fields inside it). */
export function applyPropsOverrides(base: Record<string, unknown>, overrides: PropsOverrides | undefined): Record<string, unknown> {
	if (!overrides) return base;
	let out: Json = base;
	for (const pointer of Object.keys(overrides).sort((a, b) => a.length - b.length)) out = setAt(out, pointerParts(pointer), overrides[pointer]);
	return out as Record<string, unknown>;
}

/**
 * The schema field a pointer names in a registry item's props (`/content/features/2/title` -> the `title` field of a
 * features row), or null when the schema has no such prop. List indices step into the row record.
 */
export function propsNodeAt(item: string, pointer: string): PropsFieldNode | null {
	const tree = propsFieldTree(item);
	if (!tree) return null;
	let nodes: PropsFieldNode[] | undefined = tree;
	let node: PropsFieldNode | null = null;
	let inList = false;
	for (const part of pointerParts(pointer)) {
		if (inList) {
			if (!/^\d+$/.test(part)) return null;
			inList = false;
			continue;
		}
		node = nodes?.find((entry) => entry.name === part) ?? null;
		if (!node) return null;
		if (node.kind === "list") {
			nodes = node.fields;
			inList = true;
		} else nodes = node.fields;
	}
	return node;
}

/** Whether `ancestor` is `pointer` or one of its parents (`/a` of `/a/b`). */
function covers(ancestor: string, pointer: string): boolean {
	return pointer === ancestor || pointer.startsWith(`${ancestor}/`);
}

/**
 * The block with `pointer` set to `value` in its props overrides (undefined removes it). An override that covers the
 * pointer (a list written whole) is updated in place; overrides below the pointer are dropped (no overlap).
 */
export function withPropsOverride(block: PageBlock, pointer: string, value: PagePropValue | undefined): PageBlock {
	const props: PropsOverrides = { ...block.props };
	const ancestor = Object.keys(props).find((key) => key !== pointer && covers(key, pointer));
	if (ancestor) {
		props[ancestor] = setAt(props[ancestor], pointerParts(pointer).slice(pointerParts(ancestor).length), value) as PagePropValue;
	} else {
		for (const key of Object.keys(props)) if (covers(pointer, key)) delete props[key];
		if (value !== undefined) props[pointer] = clone(value);
	}
	const next: PageBlock = { ...block, props };
	if (!Object.keys(props).length) delete next.props;
	return next;
}

/** Overrides of the rows of a page-row list (`/features/<i>/...`) after the rows moved: `map(old)` = new index or null. */
export function remapRowOverrides(block: PageBlock, list: string, map: (index: number) => number | null): PageBlock {
	if (!block.props) return block;
	const props: PropsOverrides = {};
	const prefix = `/${list}/`;
	for (const [key, value] of Object.entries(block.props)) {
		if (!key.startsWith(prefix)) {
			props[key] = value;
			continue;
		}
		const [index, ...rest] = key.slice(prefix.length).split("/");
		const to = /^\d+$/.test(index ?? "") ? map(Number(index)) : null;
		if (to === null) continue;
		props[[`${prefix}${to}`, ...rest].join("/")] = value;
	}
	const next: PageBlock = { ...block, props };
	if (!Object.keys(props).length) delete next.props;
	return next;
}

/** Override pointers the item's schema does not have (an import or a model edit naming a prop that is not there). */
export function unknownOverridePointers(item: string, overrides: PropsOverrides | undefined): string[] {
	return Object.keys(overrides ?? {}).filter((pointer) => !propsNodeAt(item, pointer));
}

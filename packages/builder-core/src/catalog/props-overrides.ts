/**
 * Block props overrides of page-spec 1.x (ADR 0024; read by the 1.x -> 2.0 migration only, ADR 0034): `block.props` maps JSON Pointers of the props of the
 * registry item a top-level block renders (registry.buildy.tw/props/v0.json: `/actions/secondary`, `/content/card/title`,
 * `/content/features`) to plain JSON values. They are merged last, over the variant preset and the page content, so the
 * preview, the props gate and the exported Svelte source see exactly the same props. Pure data, no Svelte.
 *
 * Pointers never overlap: writing `/content/features/0/title` while `/content/features` is overridden writes inside that
 * list value; writing `/content/features` drops every override below it.
 */
import type { PagePropValue } from "@buildytech/page-contract";

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

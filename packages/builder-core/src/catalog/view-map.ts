/**
 * Resolve a block's generated view map (props-schema.ts `ViewMap`, codegen-x alexy-os/chaosbun#149) against a rendered
 * block: a prop pointer to the DOM element that shows it, and an element back to the pointer it renders. The map names
 * `data-slot` places (never `data-testid`, never a marker in the block), so this works on any minimal tree with
 * `{children, getAttribute, textContent}` — the preview document in the browser, or a hand-built tree in a unit test.
 *
 * A place is `in` (an ancestor frame slot), `s` (its own element's slot) and `k` (text, html, an attribute `a`, or a
 * Lucide icon). A list pointer writes `[]` for its index; its rows carry one of `map.rows[list]`. The block root and a
 * list row are transparent (they name the block / the row, not a field), so a field with no `in`/`s` sits on the scope
 * itself. Several places of one pointer are the branches of different variants; the one whose element exists (and, for
 * a text or attribute, whose rendered value matches) is the block's.
 */
import { viewMapFor, type ViewField, type ViewMap } from "./props-schema.ts";

export type { ViewField, ViewMap } from "./props-schema.ts";

/** The minimal DOM a view map resolves against: element children, attributes and text in document order. */
export type ViewElement = {
	readonly children: readonly ViewElement[];
	getAttribute(name: string): string | null;
	readonly textContent: string | null;
};

/** The generated view map of a registry item, or null for one (or an older pin) that carries none. */
export function viewMapOf(item: string): ViewMap | null {
	return viewMapFor(item);
}

/** A concrete pointer (`/features/2/title`) split into its map key (`/features/[]/title`) and the list rows it indexes. */
export function mapKey(pointer: string): { key: string; rows: Array<{ list: string; index: number }> } {
	const rows: Array<{ list: string; index: number }> = [];
	let key = "";
	for (const seg of pointer.split("/").slice(1)) {
		if (/^\d+$/.test(seg)) {
			rows.push({ list: key, index: Number(seg) });
			key += "/[]";
		} else key += `/${seg}`;
	}
	return { key, rows };
}

/** The leaf value a pointer reads from props as a string, or undefined when it is missing or not a primitive. */
export function valueAt(props: unknown, pointer: string): string | undefined {
	let cur: unknown = props;
	for (const seg of pointer.split("/").slice(1)) {
		if (cur == null || typeof cur !== "object") return undefined;
		cur = /^\d+$/.test(seg) ? (cur as unknown[])[Number(seg)] : (cur as Record<string, unknown>)[seg];
	}
	return typeof cur === "string" || typeof cur === "number" || typeof cur === "boolean" ? String(cur) : undefined;
}

/** Every concrete field pointer the map holds given the props (list keys expanded over the lists actually present). */
export function mappedPointers(map: ViewMap, props: unknown): string[] {
	const out: string[] = [];
	for (const key of Object.keys(map.fields)) {
		let prefixes: Array<{ ptr: string; ctx: unknown }> = [{ ptr: "", ctx: props }];
		for (const seg of key.split("/").slice(1)) {
			const next: Array<{ ptr: string; ctx: unknown }> = [];
			for (const { ptr, ctx } of prefixes) {
				if (seg === "[]") {
					if (Array.isArray(ctx)) for (let i = 0; i < ctx.length; i++) next.push({ ptr: `${ptr}/${i}`, ctx: ctx[i] });
				} else {
					const ctxObj = ctx != null && typeof ctx === "object" ? (ctx as Record<string, unknown>) : undefined;
					next.push({ ptr: `${ptr}/${seg}`, ctx: ctxObj ? ctxObj[seg] : undefined });
				}
			}
			prefixes = next;
		}
		for (const { ptr } of prefixes) out.push(ptr);
	}
	return out;
}

const slotOf = (el: ViewElement): string | null => el.getAttribute("data-slot");
const text = (el: ViewElement): string => (el.textContent ?? "").replace(/\s+/g, " ").trim();

/** Elements at or below `el` whose `data-slot` is `slot`, outermost only (a match is not searched for nested matches). */
function withSlot(el: ViewElement, slot: string, out: ViewElement[] = []): ViewElement[] {
	if (slotOf(el) === slot) {
		out.push(el);
		return out;
	}
	for (const child of el.children) withSlot(child, slot, out);
	return out;
}

/** The row elements of a list under a scope: the outermost descendants that carry one of the list's row slots. */
function rowsUnder(scope: ViewElement, slots: readonly string[], out: ViewElement[] = []): ViewElement[] {
	if (slots.includes(slotOf(scope) ?? "\0")) {
		out.push(scope);
		return out;
	}
	for (const child of scope.children) rowsUnder(child, slots, out);
	return out;
}

/** The scope a field sits in: the block root, then into each list row the pointer indexes. Null if a row is missing. */
function rowScope(root: ViewElement, map: ViewMap, rows: Array<{ list: string; index: number }>): ViewElement | null {
	let scope = root;
	for (const { list, index } of rows) {
		const slots = map.rows[list];
		if (!slots || slots.length === 0) return null;
		const row = rowsUnder(scope, slots)[index];
		if (!row) return null;
		scope = row;
	}
	return scope;
}

/** The row elements of a (concrete) list pointer in a rendered block, in document order. */
export function listRows(root: ViewElement, map: ViewMap, pointer: string): ViewElement[] {
	const { key, rows } = mapKey(pointer);
	const scope = rowScope(root, map, rows);
	const slots = map.rows[key];
	if (!scope || !slots || slots.length === 0) return [];
	return rowsUnder(scope, slots);
}

/** Candidate elements of one place within a scope: narrowed by `in`, then its own slot `s`, else the frame or the scope. */
function placeElements(scope: ViewElement, place: ViewField): ViewElement[] {
	const frames = place.in ? withSlot(scope, place.in) : [scope];
	const out: ViewElement[] = [];
	for (const frame of frames) {
		if (place.s) out.push(...withSlot(frame, place.s));
		else out.push(frame);
	}
	return out;
}

const iconName = (el: ViewElement): string | null => {
	const cls = el.getAttribute("class") ?? "";
	const hit = cls.match(/\blucide-([a-z0-9-]+)/);
	return hit ? hit[1]! : el.getAttribute("data-icon") ?? el.getAttribute("data-lucide");
};

/** The value a place shows on an element: an attribute, a Lucide icon name, or its (whitespace-collapsed) text. */
function shown(el: ViewElement, place: ViewField): string | null {
	if (place.k === "attr") return place.a ? el.getAttribute(place.a) : null;
	if (place.k === "icon") return iconName(el);
	return text(el);
}

const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * The element of a rendered block that shows `pointer`, or null. Among the pointer's places, the first whose element
 * exists; when the value is a known non-empty string (a text, html or attribute), the element whose rendered value is
 * or contains it, so sibling variants and repeats disambiguate. A pointer the current props do not render has no element.
 */
export function locateField(root: ViewElement, map: ViewMap, props: unknown, pointer: string): ViewElement | null {
	const { key, rows } = mapKey(pointer);
	const places = map.fields[key];
	if (!places) return null;
	const scope = rowScope(root, map, rows);
	if (!scope) return null;
	const want = valueAt(props, pointer);
	const strict = want != null && want !== "" && typeof want === "string";
	let fallback: ViewElement | null = null;
	for (const place of places) {
		for (const el of placeElements(scope, place)) {
			const v = shown(el, place);
			if (strict && (place.k === "text" || place.k === "html" || place.k === "attr") && v != null) {
				const a = norm(v);
				const b = norm(want);
				if (a === b || (place.k !== "attr" && b.length > 0 && a.includes(b))) return el;
			}
			// A fallback element must actually bear a value (a non-empty text, a present attribute, a resolved icon),
			// so a place the current props do not render does not claim the scope.
			if (!fallback && v != null && v !== "") fallback = el;
		}
	}
	return fallback;
}

const contains = (a: ViewElement, b: ViewElement): boolean => {
	if (a === b) return true;
	for (const child of a.children) if (contains(child, b)) return true;
	return false;
};

/**
 * The pointer whose element the target is in, or null. The best match is the one whose element is the smallest (a field
 * before the row or the list that holds it); on one element a shown text before an attribute or an icon.
 */
export function fieldAtElement(root: ViewElement, map: ViewMap, props: unknown, target: ViewElement): string | null {
	const rank = (pointer: string): number => {
		const places = map.fields[mapKey(pointer).key];
		if (!places) return 3;
		return places.some((p) => p.k === "text" || p.k === "html") ? 0 : places.some((p) => p.k === "icon") ? 1 : 2;
	};
	let best: { pointer: string; el: ViewElement; rank: number } | null = null;
	for (const pointer of mappedPointers(map, props)) {
		const el = locateField(root, map, props, pointer);
		if (!el || !contains(el, target)) continue;
		const r = rank(pointer);
		if (!best || (best.el !== el && contains(best.el, el)) || (best.el === el && r < best.rank)) best = { pointer, el, rank: r };
	}
	return best?.pointer ?? null;
}

/**
 * A page-spec/v2 proposal as a diff against its base page (ADR 0034): per page field and per block, never a value.
 * `added` / `removed` / `moved` name the block; `changed` lists the JSON Pointers that differ (`/item`, `/variant`, or
 * props pointers). One shape for Ask and Build proposals (session 1.8.0 `proposal.diff`).
 */
import type { PageV2 } from "@buildytech/page-contract";

export type DiffEntry = {
	scope: "page" | "block";
	change: "added" | "removed" | "moved" | "changed";
	id?: string;
	item?: string;
	variant?: string;
	from?: number;
	to?: number;
	paths?: string[];
};

const MAX_PATHS = 40;

function same(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const esc = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1");

/** Pointers where two JSON values differ (a list that changes length is one pointer: the list). */
export function changedPointers(before: unknown, after: unknown, at = "", out: string[] = []): string[] {
	if (out.length >= MAX_PATHS || same(before, after)) return out;
	if (isObject(before) && isObject(after)) {
		for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) changedPointers(before[key], after[key], `${at}/${esc(key)}`, out);
		return out;
	}
	if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
		before.forEach((entry, index) => changedPointers(entry, after[index], `${at}/${index}`, out));
		return out;
	}
	out.push(at || "/");
	return out;
}

/** Longest increasing subsequence of `values` (indices into it), to find the blocks that did not move. */
function lis(values: number[]): Set<number> {
	const tails: number[] = [];
	const prev: number[] = new Array(values.length).fill(-1);
	const at: number[] = [];
	values.forEach((value, i) => {
		let lo = 0;
		let hi = tails.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (values[tails[mid]!]! < value) lo = mid + 1;
			else hi = mid;
		}
		if (lo > 0) prev[i] = tails[lo - 1]!;
		tails[lo] = i;
		at[lo] = i;
	});
	const keep = new Set<number>();
	let k = tails.at(-1);
	while (k !== undefined && k >= 0) {
		keep.add(k);
		k = prev[k];
	}
	return keep;
}

export function diffPages(base: PageV2 | null | undefined, next: PageV2): DiffEntry[] {
	const out: DiffEntry[] = [];
	const pagePaths: string[] = [];
	if (base) {
		if (base.title !== next.title) pagePaths.push("/title");
		if (base.slug !== next.slug) pagePaths.push("/slug");
		if (base.locale !== next.locale) pagePaths.push("/locale");
		if ((base.seo?.title ?? "") !== (next.seo?.title ?? "")) pagePaths.push("/seo/title");
		if ((base.seo?.description ?? "") !== (next.seo?.description ?? "")) pagePaths.push("/seo/description");
	}
	if (pagePaths.length) out.push({ scope: "page", change: "changed", paths: pagePaths });
	const before = new Map((base?.blocks ?? []).map((block, index) => [block.id, { block, index }]));
	const after = new Map(next.blocks.map((block, index) => [block.id, { block, index }]));
	for (const [id, { block, index }] of before) {
		if (!after.has(id)) out.push({ scope: "block", change: "removed", id, item: block.item, from: index });
	}
	const kept = next.blocks.map((block, index) => ({ block, index })).filter(({ block }) => before.has(block.id));
	const unmoved = lis(kept.map(({ block }) => before.get(block.id)!.index));
	kept.forEach(({ block, index }, rank) => {
		const prior = before.get(block.id)!;
		const paths: string[] = [];
		if (prior.block.item !== block.item) paths.push("/item");
		if ((prior.block.variant ?? "") !== (block.variant ?? "")) paths.push("/variant");
		if (prior.block.item === block.item) paths.push(...changedPointers(prior.block.props ?? {}, block.props ?? {}).map((pointer) => `/props${pointer === "/" ? "" : pointer}`));
		else if (!same(prior.block.props, block.props)) paths.push("/props");
		if (!unmoved.has(rank)) out.push({ scope: "block", change: "moved", id: block.id, item: block.item, from: prior.index, to: index });
		if (paths.length) out.push({ scope: "block", change: "changed", id: block.id, item: block.item, ...(block.variant ? { variant: block.variant } : {}), paths: paths.slice(0, MAX_PATHS) });
	});
	for (const { block, index } of next.blocks.map((entry, i) => ({ block: entry, index: i }))) {
		if (!before.has(block.id)) out.push({ scope: "block", change: "added", id: block.id, item: block.item, ...(block.variant ? { variant: block.variant } : {}), to: index });
	}
	return out;
}

export function diffIsEmpty(diff: readonly DiffEntry[]): boolean {
	return diff.length === 0;
}

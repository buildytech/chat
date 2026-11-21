/**
 * The pictures the list records of a block draw (`items[i].image`, `members[i].avatar`, ...), read from the registry blocks
 * themselves (scripts/lib/registry-derive.mjs -> pictures.json), never listed by hand here. Each has its frame ratio and a
 * size class, both possibly a case of one layout prop: small is an icon-size frame (a fixed size-N up to 48px), large a frame
 * that follows its column, logo a brand logo. Media mode draws only the large ones (ADR 0063).
 */
import raw from "./pictures.json" with { type: "json" };

type Expr = { value: string } | { cases: Array<{ prop: string; eq: string; value: string }>; else: string };
type Entry = { list: string; field: string; alt: string; ratio: Expr; size: Expr };
export type PictureSize = "small" | "large" | "logo";
/** One record picture of a block for its current props: the list prop, the picture field, the alt field, the ratio ("4/3") and size. */
export type RecordPicture = { list: string; field: string; alt: string; ratio: string; size: PictureSize };

const BLOCKS: Record<string, Entry[]> = raw.blocks;
const sizeOf = (value: string): PictureSize => (value === "small" || value === "logo" ? value : "large");

function valueOf(expr: Expr, props: Record<string, unknown>): string {
	if ("value" in expr) return expr.value;
	return expr.cases.find((c) => String(props[c.prop] ?? "") === c.eq)?.value ?? expr.else;
}

/** The record pictures of an item for the given block props (layout props pick the case), in block order. */
export function recordPictures(item: string, props: Record<string, unknown> = {}): RecordPicture[] {
	return (BLOCKS[item] ?? []).map((e) => ({ list: e.list, field: e.field, alt: e.alt, ratio: valueOf(e.ratio, props), size: sizeOf(valueOf(e.size, props)) }));
}

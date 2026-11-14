/**
 * Render of a page-spec/v2 block (ADR 0034): the props the registry component receives are the block's props merged
 * over the preset of its variant and filled with what the props schema requires. The preview, the code pane and the ZIP
 * export call this one function (`renderBlock`); there is no copy slot, row or children mapping any more.
 */
import type { BlockV2, PropValueV2 } from "@buildytech/page-contract";
import { fillProps, humanizeName, propShapeFor, propsEventsFor, propsFieldTree, type PropsFieldNode } from "../catalog/props-schema.ts";
import { variantPreset } from "../catalog/organism.ts";
import { itemInfo } from "./items.ts";

export type BlockRender = {
	item: string;
	variant: string;
	/** Block file inside the registry tree, e.g. blocks/feature-grid.svelte. */
	organism: string;
	props: Record<string, unknown>;
	/** Callbacks and snippets of the block: wired by the host, never page data. */
	events: string[];
	slots: string[];
};

type Json = unknown;
const isObject = (value: Json): value is Record<string, Json> => typeof value === "object" && value !== null && !Array.isArray(value);

function merge(base: Json, over: Json): Json {
	if (!isObject(base) || !isObject(over)) return over === undefined ? base : over;
	const out: Record<string, Json> = { ...base };
	for (const [key, value] of Object.entries(over)) out[key] = merge(base[key], value);
	return out;
}

export function cloneJson<T>(value: T): T {
	return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/** props = fill(merge(variant preset, block props)): what `<Item {...props} />` receives. */
export function effectiveProps(item: string, variant: string | null | undefined, props: Record<string, PropValueV2> | undefined, options: { blank?: boolean; rows?: number } = {}): Record<string, unknown> {
	const info = itemInfo(item);
	const name = variant && info?.variants.includes(variant) ? variant : (info?.defaultVariant ?? "");
	return fillProps(item, merge(variantPreset(item, name), cloneJson(props ?? {})) as Record<string, unknown>, options);
}

/** The registry block a v2 block renders as, or null when the registry has no such item (the host rejects those on write). */
export function renderBlock(block: Pick<BlockV2, "item" | "variant" | "props">): BlockRender | null {
	const info = itemInfo(block.item);
	if (!info) return null;
	const variant = block.variant && info.variants.includes(block.variant) ? block.variant : info.defaultVariant;
	const { events, slots } = propsEventsFor(block.item);
	return { item: block.item, variant, organism: info.organism, props: effectiveProps(block.item, variant, block.props), events, slots };
}

/** Rows a new block's required list starts with, so the block shows something. */
const SAMPLE_ROWS = 2;
const SAMPLE_TITLE_PROPS = ["title", "heading", "name"];

/**
 * The sample props of a new block (ADR 0034): the preset of the variant's layout axes plus the minimum the props schema
 * requires (required text blank, required icons the neutral glyph), with the catalog title of the block as its heading when the schema has a heading prop. The registry
 * publishes structure, not copy: a new block starts empty of invented text (no "Why this page"); the agent or the author
 * writes the content. The block id fills the item's `id` prop when it has one.
 */
export function sampleProps(item: string, variant: string | null | undefined, id: string): Record<string, PropValueV2> {
	const info = itemInfo(item);
	const shape = propShapeFor(item);
	const seed: Record<string, PropValueV2> = {};
	if (shape?.props.includes("id")) seed.id = id;
	const heading = shape?.text.find((name) => SAMPLE_TITLE_PROPS.includes(name));
	if (heading && info) seed[heading] = info.title;
	return effectiveProps(item, variant, seed, { blank: true, rows: SAMPLE_ROWS }) as Record<string, PropValueV2>;
}

/** UI label dictionaries (`labels`, aria strings) are component chrome: reported as one path while none of their words is written. */
/** A text the sample left as its neutral placeholder (the humanized key, "Home") is as unwritten as an empty one. */
const unwritten = (key: string, value: unknown) => value === "" || value === humanizeName(key);
const CHROME_OBJECTS = new Set(["labels", "aria", "a11y"]);

/**
 * Required text props a block leaves empty (JSON Pointers into its props): the places its component would show nothing or
 * its own placeholder. A write reports them so the content goes in with the structure (ADR 0034: props are the single source).
 */
export function blankRequired(block: Pick<BlockV2, "item" | "props">, limit = 12): string[] {
	const tree = propsFieldTree(block.item);
	const out: string[] = [];
	const walk = (value: unknown, nodes: PropsFieldNode[] | undefined, base: string) => {
		if (!nodes || out.length >= limit) return;
		const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
		for (const node of nodes) {
			if (node.name === "id") continue;
			const here = `${base}/${node.name}`;
			const inner = record[node.name];
			if (CHROME_OBJECTS.has(node.name)) {
				// The UI words of the block (button and aria labels): reported once when none of them is written.
				const words = inner && typeof inner === "object" ? Object.entries(inner as Record<string, unknown>) : [];
				if (node.required && !words.some(([key, word]) => typeof word === "string" && !unwritten(key, word))) out.push(here);
				continue;
			}
			if (node.kind === "text") {
				if (node.required && (inner === undefined || unwritten(node.name, inner))) out.push(here);
			} else if (node.kind === "object") walk(inner, node.fields, here);
			else if (node.kind === "list" && Array.isArray(inner)) inner.forEach((row, index) => walk(row, node.fields, `${here}/${index}`));
			if (out.length >= limit) return;
		}
	};
	walk(block.props ?? {}, tree ?? undefined, "");
	return out;
}

/**
 * What the agent reads about registry items (ADR 0034): a one-line index of every item, the compact outline of one
 * item's props schema, and the get_block result (variants, outline, sample props). All of it is derived from the pinned
 * registry data (sources.json, props.json, blocks.json: ADR 0059); nothing is hand-written per block.
 */
import { LUCIDE_ICON_HINT, propsEventsFor, propsFieldTree, type PropsFieldNode } from "@buildytech/builder-core";
import { allItems, catalogBlock, itemInfo, layoutAxes, variantProps } from "@buildytech/builder-core";
import { convertProps, sampleProps } from "@buildytech/builder-core";

const HIDDEN = new Set(["id", "class", "className", "landmarkLabel"]);

/** An enum member as JSON: text in quotes ("3"), numbers and booleans bare (2), so the model writes the schema's type. */
const member = (value: unknown): string => JSON.stringify(value) ?? String(value);

function kindText(node: PropsFieldNode): string {
	if (node.kind === "enum") {
		const values = node.enumValues ?? node.enum ?? [];
		return `enum ${values.slice(0, 12).map(member).join("|")}${values.length > 12 ? "|..." : ""}`;
	}
	if (node.kind === "text") return node.maxLength ? `text<=${node.maxLength}` : "text";
	return node.kind;
}

function record(fields: PropsFieldNode[] | undefined): string {
	return (fields ?? [])
		.filter((field) => field.name !== "class" && field.name !== "className")
		.map((field) => `${field.name}${field.required ? "" : "?"}:${field.kind === "object" ? `{${record(field.fields)}}` : field.kind === "list" ? `[${field.fields ? `{${record(field.fields)}}` : "text"}]` : kindText(field)}`)
		.join(" ");
}

/**
 * The props of an item as short lines (`features[]: id:text title:text icon:icon`; `?` marks optional), or null. The
 * layout axes (`media`, `cols`, `surface`) are not listed: the variant sets them (write.ts), the model writes `variant`.
 */
export function propsOutline(item: string): string[] | null {
	const tree = propsFieldTree(item);
	if (!tree) return null;
	const { events, slots } = propsEventsFor(item);
	const skip = new Set([...HIDDEN, ...events, ...slots, ...layoutAxes(item)]);
	return tree
		.filter((node) => !skip.has(node.name))
		.map((node) => {
			const mark = node.required ? "" : "?";
			if (node.kind === "list") return `${node.name}${mark}[]${node.maxItems ? ` (max ${node.maxItems})` : ""}: ${node.fields ? record(node.fields) : "text"}`;
			if (node.kind === "object") return `${node.name}${mark}: {${record(node.fields)}}`;
			return `${node.name}${mark}: ${kindText(node)}`;
		});
}

/** `item (title; category; variants)` per block of the catalog: the whole vocabulary of a page. */
export function itemIndex(): string[] {
	return allItems().map((item) => {
		const info = itemInfo(item)!;
		return `${item} (${info.title}; ${info.category}; ${info.variants.join("|")})`;
	});
}

function withoutAxes(props: Record<string, unknown>, axes: readonly string[]): Record<string, unknown> {
	const out = { ...props };
	for (const axis of axes) delete out[axis];
	return out;
}

type BlockReadOk = {
	ok: true;
	item: string;
	title: string;
	description: string;
	category: string;
	install: string;
	defaultVariant: string;
	/** Every variant: its label, the layout axes it sets and the settings it renders with by default (block-contract/v1). */
	variants: Array<{ id: string; label: string; axes: Record<string, string>; settings?: Record<string, unknown> }>;
	/** What each variant sets apart from the default (layout axes). */
	variantSets: Record<string, string>;
	/** The layout axes the variant sets (not in props: write `variant`, the host sets them). */
	layout?: string;
	/** The props of the item: names, kinds, enums, rows. Write exactly these. */
	props: string[];
	/** What a new block of the variant starts with (no invented copy). */
	sample: Record<string, unknown>;
	icons: string;
};

type BlockReadUnknown = { ok: false; code: "unknown_item"; message: string; near: string[] };

type BlockRead = BlockReadOk | BlockReadUnknown;

/** get_block: one block of the catalog as the agent needs it to write its props. */
export function readBlock(id: unknown, variant?: unknown): BlockRead {
	const item = String(id ?? "").trim().split("/")[0]!;
	const info = item ? itemInfo(item) : null;
	const block = item ? catalogBlock(item) : null;
	if (!info || !block) {
		const needle = item.toLowerCase();
		const near = allItems().filter((name) => needle && (name.includes(needle) || needle.includes(name))).slice(0, 8);
		return { ok: false, code: "unknown_item", message: `${String(id ?? "") || "(empty)"} is not a block of the catalog. Blocks: ${allItems().join(", ")}.`, near: near.length ? near : allItems() };
	}
	const want = typeof variant === "string" && info.variants.includes(variant) ? variant : info.defaultVariant;
	const axes = layoutAxes(item);
	const flat = (value: unknown): string[] =>
		value && typeof value === "object" ? Object.entries(value as Record<string, unknown>).flatMap(([key, inner]) => (inner && typeof inner === "object" ? flat(inner).map((row) => `${key}.${row}`) : [`${key}=${String(inner)}`])) : [];
	const base = new Set(flat(variantProps(item, info.defaultVariant)));
	const variantSets = Object.fromEntries(info.variants.map((name) => [name, flat(variantProps(item, name)).filter((row) => !base.has(row)).join(" ") || "defaults"]));
	return {
		ok: true,
		item,
		title: info.title,
		description: block.description,
		category: info.category,
		install: `npx ui8kit add ${item} --framework svelte`,
		defaultVariant: info.defaultVariant,
		variants: block.contract.variants.map((v) => ({ id: v.id, label: v.label, axes: v.axes, ...(v.settings ? { settings: { ...v.settings } } : {}) })),
		variantSets,
		...(axes.length ? { layout: `variant sets ${axes.join(", ")}; write variant, not these props` } : {}),
		props: propsOutline(item) ?? [],
		// The model reads money in major units (the stored sample is in minor units). The axes come from the variant.
		sample: withoutAxes(convertProps(item, sampleProps(item, want, `block-${item}`), "view"), axes),
		icons: LUCIDE_ICON_HINT
	};
}

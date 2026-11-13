/**
 * What the agent reads about registry items (ADR 0034): a one-line index of every item, the compact outline of one
 * item's props schema, and the get_block result (variants, outline, sample props). All of it is derived from the pinned
 * registry data (sources.json, props.json); nothing is hand-written per block.
 */
import { catalogEntryBySpec, catalogSourceFor } from "../catalog/sources.ts";
import { LUCIDE_ICON_HINT, propsEventsFor, propsFieldTree, type PropsFieldNode } from "../catalog/props-schema.ts";
import { allItems, itemInfo, itemOfSpec } from "../page-doc/items.ts";
import { sampleProps } from "../page-doc/render.ts";
import { blockAssetUrl, blockThumbUrl } from "../catalog/provenance.ts";

const HIDDEN = new Set(["id", "class", "className", "landmarkLabel"]);

function kindText(node: PropsFieldNode): string {
	if (node.kind === "enum") return `enum ${(node.enum ?? []).slice(0, 12).join("|")}${(node.enum?.length ?? 0) > 12 ? "|..." : ""}`;
	if (node.kind === "text") return node.maxLength ? `text<=${node.maxLength}` : "text";
	return node.kind;
}

function record(fields: PropsFieldNode[] | undefined): string {
	return (fields ?? [])
		.filter((field) => field.name !== "class" && field.name !== "className")
		.map((field) => `${field.name}${field.required ? "" : "?"}:${field.kind === "object" ? `{${record(field.fields)}}` : field.kind === "list" ? `[${field.fields ? `{${record(field.fields)}}` : "text"}]` : kindText(field)}`)
		.join(" ");
}

/** The props of an item as short lines (`features[]: id:text title:text icon:icon`; `?` marks optional), or null. */
export function propsOutline(item: string): string[] | null {
	const tree = propsFieldTree(item);
	if (!tree) return null;
	const { events, slots } = propsEventsFor(item);
	const skip = new Set([...HIDDEN, ...events, ...slots]);
	return tree
		.filter((node) => !skip.has(node.name))
		.map((node) => {
			const mark = node.required ? "" : "?";
			if (node.kind === "list") return `${node.name}${mark}[]${node.maxItems ? ` (max ${node.maxItems})` : ""}: ${node.fields ? record(node.fields) : "text"}`;
			if (node.kind === "object") return `${node.name}${mark}: {${record(node.fields)}}`;
			return `${node.name}${mark}: ${kindText(node)}`;
		});
}

/** `item (title; variants[; header|footer])` per registry item that renders: the whole vocabulary of a page in ~7 KB. */
export function itemIndex(): string[] {
	return allItems().map((item) => {
		const info = itemInfo(item)!;
		return `${item} (${info.title}; ${info.variants.join("|")}${info.edge === "top" ? "; header" : info.edge === "bottom" ? "; footer" : ""})`;
	});
}

/** An item by its registry name, Stock spec (`block.features`), or Stock label (`features`). */
export function resolveItem(id: unknown): string | null {
	const raw = String(id ?? "").trim();
	if (!raw) return null;
	if (itemInfo(raw)) return raw;
	const spec = raw.split("/")[0]!;
	return itemOfSpec(spec.startsWith("block.") ? spec : `block.${spec}`);
}

export type BlockRead =
	| {
			ok: true;
			item: string;
			title: string;
			install: string;
			role: "header" | "footer" | "section";
			defaultVariant: string;
			variants: string[];
			/** What each variant sets apart from the default (layout axes). */
			variantSets: Record<string, string>;
			/** The props of the item: names, kinds, enums, rows. Write exactly these. */
			props: string[];
			/** What a new block of the default variant starts with (no invented copy). */
			sample: Record<string, unknown>;
			icons: string;
			stockUrl?: string | null;
			thumb?: string | null;
	  }
	| { ok: false; code: "unknown_item"; message: string; near: string[] };

/** get_block: one registry item as the agent needs it to write its props. */
export function readBlock(id: unknown, variant?: unknown): BlockRead {
	const item = resolveItem(id);
	const info = item ? itemInfo(item) : null;
	if (!item || !info) {
		const needle = String(id ?? "").toLowerCase();
		const near = allItems().filter((name) => needle && (name.includes(needle) || needle.includes(name))).slice(0, 8);
		return { ok: false, code: "unknown_item", message: `${String(id ?? "") || "(empty)"} is not a registry item that renders. Use an item name from the index.`, near };
	}
	const source = catalogSourceFor(info.spec);
	const entry = catalogEntryBySpec(info.spec);
	const want = typeof variant === "string" && info.variants.includes(variant) ? variant : info.defaultVariant;
	const flat = (value: unknown): string[] =>
		value && typeof value === "object" ? Object.entries(value as Record<string, unknown>).flatMap(([key, inner]) => (inner && typeof inner === "object" ? flat(inner).map((row) => `${key}.${row}`) : [`${key}=${String(inner)}`])) : [];
	const base = new Set(flat(source?.variants[info.defaultVariant]));
	const variantSets = Object.fromEntries(info.variants.map((name) => [name, flat(source?.variants[name]).filter((row) => !base.has(row)).join(" ") || "defaults"]));
	return {
		ok: true,
		item,
		title: info.title,
		install: `npx ui8kit add ${item} --framework svelte`,
		role: info.edge === "top" ? "header" : info.edge === "bottom" ? "footer" : "section",
		defaultVariant: info.defaultVariant,
		variants: info.variants,
		variantSets,
		props: propsOutline(item) ?? [],
		sample: sampleProps(item, want, `block-${item}`),
		icons: LUCIDE_ICON_HINT,
		stockUrl: entry ? blockAssetUrl(info.spec, want) : null,
		thumb: entry ? blockThumbUrl(info.spec, want) : null
	};
}

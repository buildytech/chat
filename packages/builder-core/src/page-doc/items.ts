/**
 * Registry items as the page document (page-spec/v2, ADR 0034) names them: `item` = the registry item of
 * `npx ui8kit add`. Everything here is read from the pinned registry data (sources.json, props.json) and the catalog
 * snapshot; nothing is hand-written. The header / footer role of an item comes from the catalog's renderer-kind map of
 * its Stock block (registry metadata), never from the page; it is informational (ADR 0037).
 */
import { catalogSources } from "../catalog/sources.ts";
import { catalogEntryBySpec } from "../catalog/sources.ts";
import { rendererKindForLabel } from "../catalog/renderer-kind.ts";
import { hasPropsSchema } from "../catalog/props-schema.ts";
import type { PageBlockKind } from "@buildytech/page-contract";

/** Informational role of page chrome (header, side navigation / footer, bottom navigation): registry metadata, never a placement rule. */
function chromeRole(kind: string): "header" | "footer" | null {
	return kind === "nav" || kind === "sidenav" ? "header" : kind === "footer" || kind === "bottomnav" ? "footer" : null;
}

export type ItemInfo = {
	item: string;
	/** Stock catalog block of the item (`block.features`). */
	spec: string;
	title: string;
	organism: string;
	defaultVariant: string;
	variants: string[];
	/** Renderer kind of its Stock block (registry metadata): a ranking hint for the Blocks feed, never a rule. */
	kind: PageBlockKind | null;
	/** "header" / "footer": the registry role of the item (a label for the Blocks feed and the agent's vocabulary); null: a section.
	 *  Informational only (ADR 0037): no position or count rule follows from it, a page may hold any number of them anywhere. */
	role: "header" | "footer" | null;
};

const CACHE = new Map<string, ItemInfo | null>();

/** What the registry says about an item, or null when the registry snapshot has no such renderable item. */
export function itemInfo(item: string): ItemInfo | null {
	if (CACHE.has(item)) return CACHE.get(item)!;
	const block = Object.hasOwn(catalogSources.blocks, item) ? catalogSources.blocks[item] : undefined;
	let info: ItemInfo | null = null;
	if (block && hasPropsSchema(item)) {
		const entry = catalogEntryBySpec(block.spec);
		const kind = entry ? rendererKindForLabel(entry.blockId) : null;
		info = {
			item,
			spec: block.spec,
			title: entry?.title ?? item,
			organism: block.organism,
			defaultVariant: block.defaultVariant,
			variants: Object.keys(block.variants),
			kind,
			role: kind ? chromeRole(kind) : null
		};
	}
	CACHE.set(item, info);
	return info;
}

/** Every renderable registry item of the snapshot, in registry order. */
export function allItems(): string[] {
	return Object.keys(catalogSources.blocks).filter((item) => itemInfo(item) !== null);
}

/** The registry item of a Stock catalog block spec (`block.features` -> `feature-grid`), or null. */
export function itemOfSpec(spec: string | null | undefined): string | null {
	return spec ? (catalogSources.specs[spec]?.item ?? null) : null;
}

/** The variant of an item the page document calls `variant` (default variant when null / empty). */
export function variantOrDefault(item: string, variant: string | null | undefined): string | null {
	const info = itemInfo(item);
	if (!info) return null;
	if (!variant) return info.defaultVariant;
	return info.variants.includes(variant) ? variant : null;
}

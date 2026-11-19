/**
 * Registry items as the page document (page-spec/v2, ADR 0034) names them: `item` = the registry item of
 * `npx ui8kit add`. Everything here is read from the pinned registry data (sources.json, props.json, blocks.json, ADR 0059);
 * nothing is hand-written.
 */
import { catalogSources } from "../catalog/sources.ts";
import { catalogBlock } from "../catalog/blocks.ts";
import { hasPropsSchema } from "../catalog/props-schema.ts";

export type ItemInfo = {
	item: string;
	title: string;
	/** The registry `meta.group` (hero, company, ...): the feed's category. */
	category: string;
	organism: string;
	defaultVariant: string;
	variants: string[];
};

const CACHE = new Map<string, ItemInfo | null>();

/** What the registry says about an item, or null when the registry snapshot has no such renderable item. */
export function itemInfo(item: string): ItemInfo | null {
	if (CACHE.has(item)) return CACHE.get(item)!;
	const block = Object.hasOwn(catalogSources.blocks, item) ? catalogSources.blocks[item] : undefined;
	let info: ItemInfo | null = null;
	const catalog = catalogBlock(item);
	if (block && catalog && hasPropsSchema(item)) {
		info = {
			item,
			title: catalog.title,
			category: catalog.category,
			organism: block.organism,
			defaultVariant: block.defaultVariant,
			variants: Object.keys(block.variants)
		};
	}
	CACHE.set(item, info);
	return info;
}

/** Every renderable registry item of the catalog, in catalog order. */
export function allItems(): string[] {
	return Object.keys(catalogSources.blocks).filter((item) => itemInfo(item) !== null);
}

/** The variant of an item the page document calls `variant` (default variant when null / empty). */
export function variantOrDefault(item: string, variant: string | null | undefined): string | null {
	const info = itemInfo(item);
	if (!info) return null;
	if (!variant) return info.defaultVariant;
	return info.variants.includes(variant) ? variant : null;
}

/**
 * The catalog (ADR 0059): the simple-line blocks of the pinned registry, in config order (catalog/snapshot.config.json),
 * each with its block-contract/v1 (@ui8kit/contract 0.4.0), content model and prototype. Generated into blocks.json by
 * scripts/registry-snapshot.mjs; nothing here is hand-written data.
 */
import raw from "./blocks.json" with { type: "json" };
import type { BlockContractV1 } from "@buildytech/page-contract";

export type CatalogBlock = {
	item: string;
	title: string;
	description: string;
	/** The registry `meta.group` of the item (hero, company, ...): the feed's category. */
	category: string;
	/** File name of the generated prototype (wireframe) under prototypes/svelte/blocks. */
	prototype: string;
	contract: BlockContractV1;
	/** The content model (JSON Schema 2020-12) of the block's props. */
	model: Record<string, unknown>;
};

type BlocksFile = { format: "buildy-catalog-blocks"; version: number; registry: string; digest: string; blocks: CatalogBlock[] };

/** The generated file, read as its declared shape (scripts/registry-snapshot.mjs writes it from the pinned contracts). */
const data: unknown = raw;
const FILE = data as BlocksFile;

/** Every block of the catalog, in catalog order. */
export function catalogBlocks(): readonly CatalogBlock[] {
	return FILE.blocks;
}

/** One block by registry item, or null. */
export function catalogBlock(item: string): CatalogBlock | null {
	return FILE.blocks.find((block) => block.item === item) ?? null;
}

/** The setting values a variant renders with: the contract defaults, then the variant's own settings (block-contract/v1). */
function variantSettings(item: string, variant: string): Record<string, string | number | boolean> {
	const contract = catalogBlock(item)?.contract;
	if (!contract) return {};
	const out: Record<string, string | number | boolean> = {};
	for (const [key, setting] of Object.entries(contract.settings ?? {})) if (setting.default !== undefined) out[key] = setting.default;
	return { ...out, ...(contract.variants.find((v) => v.id === variant)?.settings ?? {}) };
}

/** The layout axes of a block (block-contract/v1 `axes`: `media`, `cols`, `surface`): the variant sets them, never the content. */
export function layoutAxes(item: string): string[] {
	return Object.keys(catalogBlock(item)?.contract.axes ?? {});
}

/** The axis values of a variant (`cards3` -> cols "3", surface "cards"), the contract defaults under them; null for an unknown variant. */
export function variantAxisValues(item: string, variant: string): Record<string, string> | null {
	const contract = catalogBlock(item)?.contract;
	const found = contract?.variants.find((v) => v.id === variant);
	if (!contract || !found) return null;
	const out: Record<string, string> = {};
	for (const axis of Object.keys(contract.axes ?? {})) {
		const value = found.axes[axis] ?? contract.defaults?.[axis];
		if (value !== undefined) out[axis] = String(value);
	}
	return out;
}

/** The column axis of a block: the one contract axis whose values are all whole numbers (team-simple `cols`), else null.
 *  Read from the contract data, never from a block id (the rule of the generated wireframe: codegen-x prototypes `countAxis`). */
export function columnAxis(item: string): string | null {
	const counts = Object.entries(catalogBlock(item)?.contract.axes ?? {}).filter(
		([, values]) => Array.isArray(values) && values.length > 0 && values.every((v) => /^[1-9][0-9]?$/.test(String(v))),
	);
	return counts.length === 1 ? counts[0]![0] : null;
}

/** The columns a variant lays its list out in (`cols4` -> 4, `cards3` -> 3), or null when the block has no column axis. */
export function variantColumns(item: string, variant: string): number | null {
	const axis = columnAxis(item);
	const value = axis ? variantAxisValues(item, variant)?.[axis] : undefined;
	return value ? Number(value) : null;
}

/** The setting a variant renders with when the author set none (`align` of mediaTop is "center"), or undefined. */
export function variantSettingDefault(item: string, variant: string, name: string): string | number | boolean | undefined {
	return variantSettings(item, variant)[name];
}

/** The settings any variant of a block sets on its own (hero-simple: `align` of mediaTop). */
export function variantSettingNames(item: string): string[] {
	const names = new Set<string>();
	for (const v of catalogBlock(item)?.contract.variants ?? []) for (const key of Object.keys(v.settings ?? {})) names.add(key);
	return [...names];
}

/** Props of a variant's prototype (wireframe): its settings and its axes (block-contract/v1), as the generated prototype takes them. */
export function prototypeProps(item: string, variant: string): Record<string, string | number | boolean> {
	const found = catalogBlock(item)?.contract.variants.find((v) => v.id === variant);
	return found ? { ...variantSettings(item, variant), ...found.axes } : {};
}

export type CatalogCard = { id: string; item: string; variant: string; title: string; label: string; category: string; isDefault: boolean };

export type CatalogQuery = { q?: string | null; category?: string | null };

export type CatalogResult = {
	total: number;
	items: CatalogCard[];
	categories: Array<{ value: string; count: number }>;
};

/** Every block variant as a card, filtered by free text (title, item, variant, category) and category. */
export function catalogSearch(query: CatalogQuery = {}): CatalogResult {
	const words = (query.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
	const all: CatalogCard[] = FILE.blocks.flatMap((block) =>
		block.contract.variants.map((variant) => ({
			id: `${block.item}/${variant.id}`,
			item: block.item,
			variant: variant.id,
			title: block.title,
			label: variant.label,
			category: block.category,
			isDefault: variant.id === block.contract.defaultVariant
		}))
	);
	const text = (card: CatalogCard) => `${card.item} ${card.title} ${card.variant} ${card.label} ${card.category}`.toLowerCase();
	const matched = all.filter((card) => words.every((word) => text(card).includes(word)));
	const counts = new Map<string, number>();
	for (const card of matched) counts.set(card.category, (counts.get(card.category) ?? 0) + 1);
	const items = query.category ? matched.filter((card) => card.category === query.category) : matched;
	return { total: items.length, items, categories: [...counts].map(([value, count]) => ({ value, count })) };
}

/** Identity of the pinned catalog (sha256 of the registry files, contracts, models and prototypes): traces and the contract fingerprint. */
export function catalogDigest(): string {
	return FILE.digest;
}

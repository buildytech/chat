import type { PageBlock, PageBlockKind } from "@buildytech/page-contract";
import { catalogSnapshot } from "./snapshot.ts";
import { getBlockIndex, rendererKindForLabel, screenSlots } from "./compatibility.ts";
import { getScreenById } from "./search.ts";
import type { CatalogScreen } from "./types.ts";
import { catalogSourceFor } from "./sources.ts";
import type { OrganismRender } from "./organism.ts";

/**
 * Program-level catalog provenance (deterministic code, never the model).
 *
 * Every top-level Page block must map to a Stock block label of the selected Stock
 * screen (or, for app-shell edits, of a sibling screen in the same Stock spec family,
 * e.g. screen.theme-dashboard-console/home and /layouts) and to an available block in
 * the pinned catalog blockIndex. Child rows are
 * content inside that catalog block and must use the child kind the parent renders.
 * Catalog refs (titles, ids, links, facets) are generated from the bundled snapshot only.
 */

/** Public Stock app. Hash routes: `#/asset/<id>` and `#/search?<facets>` (see app bundle router). */
export const STOCK_APP_URL = "https://app.codegen-x.com/";

export type CatalogFilters = Record<string, string | string[]>;

export type CatalogScreenRef = {
	catalogId: string;
	title: string;
	url: string;
	searchUrl: string;
	filters: CatalogFilters;
};

export type CatalogBlockRef = {
	blockId: string;
	kind: PageBlockKind;
	catalogLabel: string;
	catalogId: string;
	title: string;
	variants: string[];
	url: string;
	filters: CatalogFilters;
	rows: number;
	/** Stock screen the block label comes from (the selected screen or a same-spec sibling). */
	sourceScreenId: string;
	/** Catalog variant the block renders (page-spec 1.1.0), when set. */
	variant?: string;
	/** Pinned registry item the block renders with (`npx ui8kit add <item>`), when the snapshot has one. */
	registryItem?: string;
};

export type CatalogRefs = {
	catalogDigest: string;
	pinnedCommit: string;
	screen: CatalogScreenRef | null;
	blocks: CatalogBlockRef[];
};

export type CatalogValidationError = {
	ok: false;
	code:
		| "catalog_digest_mismatch"
		| "catalog_screen_unknown"
		| "catalog_block_unknown"
		| "catalog_block_not_in_screen"
		| "catalog_child_kind_invalid"
		| "catalog_ref_mismatch"
		| "unknown_catalog_block"
		| "catalog_block_kind_mismatch"
		| "unknown_variant"
		| "variant_without_catalog_block"
		| "props_invalid"
		| "props_gate_unavailable";
	message: string;
	path?: string;
	/** props_invalid: what the published props schema rejected, in the block's own prop names. */
	issues?: PropsIssue[];
};

/** One problem of the merged props of a registry block, as the published props schema reports it. */
export type PropsIssue = {
	/** JSON Pointer into the block props, e.g. /features/2/icon. */
	pointer: string;
	keyword: string;
	message: string;
	/** The value that was rejected, when there is one. */
	value?: unknown;
	/** enum: every allowed value (the icon enum of the contract, a layout axis). */
	allowed?: unknown[];
};

/** Validates the merged props of a registry block against its published schema (props-gate.ts installs it). */
export type PropsValidator = (render: OrganismRender) => PropsIssue[];

let PROPS_VALIDATOR: PropsValidator | null = null;

/**
 * Install the props validator. The gate is fail-closed: a page with a registry block is rejected while none is
 * installed (the browser loads props-gate.ts lazily before its first proposal; the runtime installs it at start).
 */
export function setPropsValidator(validator: PropsValidator | null): void {
	PROPS_VALIDATOR = validator;
}

export function propsValidatorInstalled(): boolean {
	return PROPS_VALIDATOR !== null;
}

/** Issues of the props of one registry item; null while no validator is installed (the gate is fail-closed). */
export function validateItemProps(item: string, props: Record<string, unknown>): PropsIssue[] | null {
	return PROPS_VALIDATOR ? PROPS_VALIDATOR({ item, props } as OrganismRender) : null;
}

/** Sibling Stock screens sharing the spec (theme family), selected screen first. */
export function screenFamily(screen: CatalogScreen): CatalogScreen[] {
	const siblings = catalogSnapshot.screens
		.filter((row) => row.spec === screen.spec && row.screenId !== screen.screenId)
		.sort((a, b) => a.order - b.order);
	return [screen, ...siblings];
}

/**
 * Catalog source of top-level blocks (page-spec 1.1.0): a block without catalogBlock gets the Stock catalog block of
 * its kind in the screen family; a block whose catalog block has a pinned registry organism gets the catalog default
 * variant when none is set. Explicit values (the model's, the author's) are kept; validateCatalogProvenance checks them.
 */
export function attachCatalogSources(blocks: PageBlock[], screen: CatalogScreen | null): PageBlock[] {
	return blocks.map((node) => {
		let next = node;
		if (!next.catalogBlock && screen) {
			const found = kindSourceFor(screen, next.kind);
			const entry = found ? getBlockIndex(found.label) : null;
			if (entry?.available) next = { ...next, catalogBlock: entry.spec };
		}
		const source = catalogSourceFor(next.catalogBlock);
		if (source && !next.variant) next = { ...next, variant: source.defaultVariant };
		return next;
	});
}

/** Stock label for a renderer kind in the screen, else in its spec family. */
export function familyLabelForKind(
	screen: CatalogScreen,
	kind: PageBlockKind
): { label: string; screenId: string } | null {
	for (const row of screenFamily(screen)) {
		const label = labelForKind(screenSlots(row).map((slot) => slot.block), kind);
		if (label) return { label, screenId: row.screenId };
	}
	return null;
}

/**
 * Screens a block of any kind is sourced from when the page's own screen family has no such section (ADR 0027): the
 * four start families in order, then every other catalog screen. A screen family is advisory and never rejects a
 * block that has a Stock catalog block and a renderer.
 */
export const FAMILY_HOME_SCREENS = [
	"screen.theme-marketing-landing/home",
	"screen.theme-food-grill/home",
	"screen.theme-restaurant-house/home",
	"screen.theme-dashboard-console/home"
] as const;

/** The Stock label of `kind` in the screen's family, else in the first screen family that has it (null: none has). */
export function kindSourceFor(screen: CatalogScreen | null, kind: PageBlockKind): { label: string; screenId: string } | null {
	const own = screen ? familyLabelForKind(screen, kind) : null;
	if (own) return own;
	const seen = new Set<string>(screen ? [screen.spec] : []);
	const order = [...FAMILY_HOME_SCREENS.map((id) => getScreenById(id)).filter((row): row is CatalogScreen => row !== null), ...catalogSnapshot.screens];
	for (const row of order) {
		if (seen.has(row.spec)) continue;
		seen.add(row.spec);
		const found = familyLabelForKind(row, kind);
		if (found && getBlockIndex(found.label)?.available) return found;
	}
	return null;
}

function enc(value: string): string {
	return encodeURIComponent(value).replace(/%2C/gi, ",");
}

export function stockAssetUrl(catalogId: string): string {
	return `${STOCK_APP_URL}#/asset/${catalogId}`;
}

/** Absolute URL of a Stock thumbnail path (`thumbs/<id>.webp?v=...` of the snapshot), or null when there is none. */
export function stockThumbUrl(thumb: string | null | undefined): string | null {
	return thumb && /^thumbs\/[\w.-]+\.webp(\?v=[0-9a-f]+)?$/.test(thumb) ? `${STOCK_APP_URL}${thumb}` : null;
}

function blockBySpec(spec: string) {
	return catalogSnapshot.blockIndex.find((row) => row.spec === spec) ?? null;
}

/** The Stock variant a block card shows: the given one when the block has it, else the registry default, else the first. */
export function stockVariantOf(spec: string, variant?: string | null): string | null {
	const entry = blockBySpec(spec);
	if (!entry || entry.variants.length === 0) return null;
	if (variant && entry.variants.includes(variant)) return variant;
	const fallback = catalogSourceFor(spec)?.defaultVariant;
	return fallback && entry.variants.includes(fallback) ? fallback : entry.variants[0]!;
}

/** Stock asset page of one block variant (`#/asset/<spec>/<variant>`), or null for an unknown block. */
export function blockAssetUrl(spec: string, variant?: string | null): string | null {
	const shown = stockVariantOf(spec, variant);
	return shown ? stockAssetUrl(`${spec}/${shown}`) : null;
}

/** Thumbnail URL of one block variant (same variant choice as blockAssetUrl), or null when Stock has no picture. */
export function blockThumbUrl(spec: string, variant?: string | null): string | null {
	const shown = stockVariantOf(spec, variant);
	return shown ? stockThumbUrl(blockBySpec(spec)?.thumbs?.[shown]) : null;
}

/** Thumbnail URL of a Stock screen, or null. */
export function screenThumbUrl(screenId: string): string | null {
	return stockThumbUrl(getScreenById(screenId)?.thumb);
}

/** Stock search URL. Keys follow the app's own serializer: q, facets (type, section, job, industry, ...), spec. */
export function stockSearchUrl(params: Array<[string, string]>): string {
	const query = params
		.filter(([, value]) => value)
		.map(([key, value]) => `${key}=${enc(value)}`)
		.join("&");
	return `${STOCK_APP_URL}#/search${query ? `?${query}` : ""}`;
}

function labelForKind(labels: string[], kind: PageBlockKind): string | null {
	// The block named like the kind first (`features` for features), then the others in the given order.
	const ordered = labels.includes(kind) ? [kind, ...labels.filter((label) => label !== kind)] : labels;
	for (const label of ordered) {
		if (rendererKindForLabel(label) !== kind) continue;
		const entry = getBlockIndex(label);
		if (entry?.available) return label;
	}
	return null;
}

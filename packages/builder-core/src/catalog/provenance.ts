import type { Page, PageBlock, PageBlockKind } from "@buildytech/page-contract";
import { catalogSnapshot } from "./snapshot.ts";
import { getBlockIndex, rendererKindForLabel } from "./compatibility.ts";
import { getScreenById } from "./search.ts";
import { childKindFor } from "../content.ts";
import type { CatalogScreen } from "./types.ts";
import { catalogSourceFor, isLucideIcon, lucideIconHint, resolveCatalogChoice } from "./sources.ts";

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
		| "unknown_icon";
	message: string;
	path?: string;
};

function allowedChild(parent: PageBlockKind, child: PageBlockKind): boolean {
	return childKindFor(parent) === child;
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
			const found = familyLabelForKind(screen, next.kind);
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
		const label = labelForKind(row.labels.blocks, kind);
		if (label) return { label, screenId: row.screenId };
	}
	return null;
}

function enc(value: string): string {
	return encodeURIComponent(value).replace(/%2C/gi, ",");
}

export function stockAssetUrl(catalogId: string): string {
	return `${STOCK_APP_URL}#/asset/${catalogId}`;
}

/** Stock search URL. Keys follow the app's own serializer: q, facets (type, section, job, industry, ...), spec. */
export function stockSearchUrl(params: Array<[string, string]>): string {
	const query = params
		.filter(([, value]) => value)
		.map(([key, value]) => `${key}=${enc(value)}`)
		.join("&");
	return `${STOCK_APP_URL}#/search${query ? `?${query}` : ""}`;
}

function screenRef(screenId: string): CatalogScreenRef | null {
	const screen = getScreenById(screenId);
	if (!screen) return null;
	const facets: Array<[string, string]> = [["type", "screen"]];
	if (screen.labels.section.length) facets.push(["section", screen.labels.section.join(",")]);
	if (screen.labels.industry.length) facets.push(["industry", screen.labels.industry.join(",")]);
	facets.push(["spec", screen.spec]);
	return {
		catalogId: screen.screenId,
		title: screen.subtitle ? `${screen.title} / ${screen.subtitle}` : screen.title,
		url: stockAssetUrl(screen.screenId),
		searchUrl: stockSearchUrl(facets),
		filters: {
			type: screen.labels.type,
			section: screen.labels.section,
			job: screen.labels.job,
			blocks: screen.labels.blocks,
			industry: screen.labels.industry,
			spec: screen.spec,
			variant: screen.variant
		}
	};
}

function labelForKind(labels: string[], kind: PageBlockKind): string | null {
	for (const label of labels) {
		if (rendererKindForLabel(label) !== kind) continue;
		const entry = getBlockIndex(label);
		if (entry?.available) return label;
	}
	return null;
}

/**
 * Validate a Page against the pinned Stock catalog and build its catalog refs.
 * `catalogDigest` is the digest the proposal claims; it must equal the bundled snapshot.
 */
export function validateCatalogProvenance(input: {
	page: Page;
	screenId: string | null;
	catalogDigest?: string | null;
}): { ok: true; refs: CatalogRefs } | CatalogValidationError {
	const digest = catalogSnapshot.sourceDigest;
	if (input.catalogDigest != null && input.catalogDigest !== digest) {
		return {
			ok: false,
			code: "catalog_digest_mismatch",
			message: `Proposal catalog digest ${input.catalogDigest} does not match the bundled Stock catalog ${digest}. Nothing was rendered.`
		};
	}
	const blocks = input.page.layout.blocks;
	if (!input.screenId) {
		if (blocks.length === 0) {
			return { ok: true, refs: { catalogDigest: digest, pinnedCommit: catalogSnapshot.pinnedCommit, screen: null, blocks: [] } };
		}
		return {
			ok: false,
			code: "catalog_screen_unknown",
			message: "Proposal has blocks but no Stock screen id. Blocks must come from a Stock catalog screen. Nothing was rendered."
		};
	}
	const screen = getScreenById(input.screenId);
	const sref = screen ? screenRef(screen.screenId) : null;
	if (!screen || !sref) {
		return {
			ok: false,
			code: "catalog_screen_unknown",
			message: `Stock screen ${input.screenId} is not in the bundled catalog. Nothing was rendered.`
		};
	}
	const refs: CatalogBlockRef[] = [];
	for (const [index, node] of blocks.entries()) {
		const path = `layout.blocks[${index}]`;
		const found = familyLabelForKind(screen, node.kind);
		const label = found?.label ?? null;
		if (!found || !label) {
			const anywhere = catalogSnapshot.blockIndex.some(
				(entry) => entry.available && rendererKindForLabel(entry.blockId) === node.kind
			);
			return {
				ok: false,
				code: anywhere ? "catalog_block_not_in_screen" : "catalog_block_unknown",
				message: anywhere
					? `Block ${node.id} (${node.kind}) is not part of Stock screen ${screen.screenId} or its ${screen.spec} family. Nothing was rendered.`
					: `Block ${node.id} (${node.kind}) has no Stock catalog block. Invented blocks are rejected. Nothing was rendered.`,
				path
			};
		}
		const entry = getBlockIndex(label)!;
		if (node.variant && !node.catalogBlock) {
			return {
				ok: false,
				code: "variant_without_catalog_block",
				message: `Block ${node.id} names variant ${node.variant} without its catalogBlock. Nothing was rendered.`,
				path: `${path}.variant`
			};
		}
		if (node.catalogBlock) {
			const choice = resolveCatalogChoice({ kind: node.kind, catalogBlock: node.catalogBlock, variant: node.variant });
			if (!choice.ok || choice.catalogBlock !== node.catalogBlock) {
				return {
					ok: false,
					code: choice.ok ? "unknown_catalog_block" : choice.code,
					message: `${choice.ok ? `${node.catalogBlock} is not a catalog block spec.` : choice.message} Nothing was rendered.`,
					path: `${path}.${!choice.ok && choice.code === "unknown_variant" ? "variant" : "catalogBlock"}`
				};
			}
		}
		for (const [ci, child] of (node.children ?? []).entries()) {
			if (child.catalogBlock || child.variant) {
				return {
					ok: false,
					code: "catalog_child_kind_invalid",
					message: `Row ${child.id} cannot carry its own catalog block or variant. Nothing was rendered.`,
					path: `${path}.children[${ci}]`
				};
			}
			if (child.copy?.icon !== undefined && !isLucideIcon(child.copy.icon)) {
				return {
					ok: false,
					code: "unknown_icon",
					message: `Row ${child.id}: ${child.copy.icon} is not a Lucide icon of the pinned registry snapshot. Use one of the allowed names or omit icon. ${lucideIconHint()}`,
					path: `${path}.children[${ci}].copy.icon`
				};
			}
			if (!allowedChild(node.kind, child.kind) || (child.children?.length ?? 0) > 0) {
				return {
					ok: false,
					code: "catalog_child_kind_invalid",
					message: `Row ${child.id} (${child.kind}) cannot live inside Stock block ${entry.spec}. Nothing was rendered.`,
					path: `${path}.children[${ci}]`
				};
			}
		}
		const facets: Array<[string, string]> = [
			["type", "block"],
			["spec", entry.spec]
		];
		refs.push({
			blockId: node.id,
			kind: node.kind,
			catalogLabel: label,
			catalogId: entry.spec,
			title: entry.title,
			variants: [...entry.variants],
			url: stockSearchUrl(facets),
			filters: {
				type: "block",
				spec: entry.spec,
				kind: node.kind,
				screen: found.screenId,
				section: screen.labels.section,
				job: screen.labels.job,
				industry: screen.labels.industry
			},
			rows: node.children?.length ?? 0,
			sourceScreenId: found.screenId,
			...(node.variant ? { variant: node.variant } : {}),
			...(catalogSourceFor(node.catalogBlock) ? { registryItem: catalogSourceFor(node.catalogBlock)!.item } : {})
		});
	}
	return {
		ok: true,
		refs: { catalogDigest: digest, pinnedCommit: catalogSnapshot.pinnedCommit, screen: sref, blocks: refs }
	};
}

/** Compare refs a remote runtime sent with refs recomputed from the bundled catalog. */
export function sameCatalogRefs(a: CatalogRefs | null | undefined, b: CatalogRefs): boolean {
	if (!a) return false;
	return JSON.stringify(a) === JSON.stringify(b);
}


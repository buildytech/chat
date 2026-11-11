import { unknownOverridePointers } from "./props-overrides.ts";
import type { Page, PageBlock, PageBlockKind } from "@buildytech/page-contract";
import { catalogSnapshot } from "./snapshot.ts";
import { getBlockIndex, rendererKindForLabel, screenSlots } from "./compatibility.ts";
import { getScreenById } from "./search.ts";
import { childKindFor } from "../content.ts";
import type { CatalogScreen } from "./types.ts";
import { catalogSourceFor, resolveCatalogChoice } from "./sources.ts";
import { organismFor, type OrganismRender } from "./organism.ts";

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

function quote(value: unknown): string {
	return typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value) ?? String(value);
}

/** The page-block field a prop came from: the longest origin prefix of the pointer. */
function originOf(render: OrganismRender, pointer: string): string | null {
	let at = pointer;
	while (at) {
		if (render.origins[at]) return render.origins[at]!;
		if (render.overrides.includes(at)) return `props["${at}"]`;
		at = at.slice(0, Math.max(0, at.lastIndexOf("/")));
	}
	return null;
}

function issueText(issue: PropsIssue): string {
	const where = issue.pointer || "(props)";
	const value = issue.value !== undefined ? ` ${quote(issue.value)}` : "";
	const allowed = issue.allowed?.length ? ` Allowed: ${issue.allowed.map(String).join(", ")}.` : "";
	return `${where}${value}: ${issue.message}.${allowed}`;
}

/** Merged props (variant preset + page content + schema defaults) of a top-level block against its props schema. */
export function checkBlockProps(node: PageBlock, path: string): CatalogValidationError | null {
	const render = organismFor(node);
	if (!render) {
		return node.props && Object.keys(node.props).length
			? { ok: false, code: "props_invalid", message: `Block ${node.id} has props overrides but no registry block to apply them to. Remove props.`, path: `${path}.props` }
			: null;
	}
	const unknown = unknownOverridePointers(render.item, node.props);
	if (unknown.length) {
		return {
			ok: false,
			code: "props_invalid",
			message: `Block ${node.id} (registry ${render.item}) has no prop ${unknown.slice(0, 3).join(", ")} in its published props schema. Use a pointer of registry.buildy.tw/props/v0.json ${render.item}.`,
			path: `${path}.props["${unknown[0]}"]`,
			issues: unknown.slice(0, 5).map((pointer) => ({ pointer, keyword: "unknown_prop", message: "no such prop in the published schema" }))
		};
	}
	if (!PROPS_VALIDATOR) {
		return {
			ok: false,
			code: "props_gate_unavailable",
			message: `Block ${node.id} renders registry item ${render.item}, but the props schema gate is not loaded. Nothing was rendered.`,
			path
		};
	}
	const issues = PROPS_VALIDATOR(render);
	if (!issues.length) return null;
	const origin = originOf(render, issues[0]!.pointer);
	return {
		ok: false,
		code: "props_invalid",
		message: `Block ${node.id} (${node.kind}, registry ${render.item} variant ${render.variant}) does not match its published props schema${
			origin ? ` at ${origin}` : ""
		}: ${issues.slice(0, 3).map(issueText).join(" ")} Fix that field and call again. Nothing was rendered.`,
		path: origin ? `${path}.${origin}` : path,
		issues: issues.slice(0, 5)
	};
}

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
	// The block named like the kind first (`features` for features), then the others in the given order.
	const ordered = labels.includes(kind) ? [kind, ...labels.filter((label) => label !== kind)] : labels;
	for (const label of ordered) {
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
		// ADR 0027: the screen family is advisory; a kind outside it is sourced from the first family that has it.
		const found = kindSourceFor(screen, node.kind);
		const label = found?.label ?? null;
		if (!found || !label) {
			return {
				ok: false,
				code: "catalog_block_unknown",
				message: `Block ${node.id} (${node.kind}) has no Stock catalog block. Invented blocks are rejected. Nothing was rendered.`,
				path
			};
		}
		// Outside the screen's own family a section must name its catalog block (the feed and edit ops always do):
		// a bare kind there is how an invented or tampered block would look.
		if (!familyLabelForKind(screen, node.kind) && !node.catalogBlock) {
			return {
				ok: false,
				code: "catalog_block_not_in_screen",
				message: `Block ${node.id} (${node.kind}) is outside the ${screen.spec} family and names no catalogBlock. Nothing was rendered.`,
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
					message: `Block ${node.id} (${node.kind}): ${choice.ok ? `${node.catalogBlock} is not a catalog block spec.` : choice.message} Nothing was rendered.`,
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
			if (!allowedChild(node.kind, child.kind) || (child.children?.length ?? 0) > 0) {
				return {
					ok: false,
					code: "catalog_child_kind_invalid",
					message: `Row ${child.id} (${child.kind}) cannot live inside Stock block ${entry.spec}. Nothing was rendered.`,
					path: `${path}.children[${ci}]`
				};
			}
		}
		const propsError = checkBlockProps(node, path);
		if (propsError) return propsError;
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
			url: blockAssetUrl(entry.spec, node.variant) ?? stockSearchUrl(facets),
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


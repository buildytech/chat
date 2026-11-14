import { PAGE_BLOCK_KINDS, type PageBlockKind } from "@buildytech/page-contract";
import { catalogProvenance, catalogSnapshot } from "./snapshot.ts";
import { getBlockIndex, getBlockIndexByCatalogId } from "./compatibility.ts";
import { rendererKindForLabel } from "./renderer-kind.ts";
import { getScreenById } from "./search.ts";
import { blockVariantSummary, catalogSourceFor, catalogVariantsFor, variantProps } from "./sources.ts";
import { blockAssetUrl, blockThumbUrl, stockSearchUrl } from "./provenance.ts";
import { LUCIDE_ICON_HINT, propsSummaryFor } from "./props-schema.ts";

export type BlockDetails = {
	id: string;
	spec: string;
	title: string;
	variants: string[];
	catalogIds: string[];
	rendererKind: PageBlockKind | null;
	rendererCompatible: boolean;
	provenance: ReturnType<typeof catalogProvenance>;
	inspected: true;
	/** The variant asked for (by name or catalog asset id), validated and kept. */
	variant?: string;
	/** Pinned registry organism of this catalog block (page-spec 1.1.0), when the snapshot has one. */
	registry?: {
		item: string;
		install: string;
		organism: string;
		defaultVariant: string;
		/** Organism props of the selected (or default) variant. */
		variantProps: Record<string, unknown>;
		/** page-spec slot -> organism prop. */
		slots: unknown;
		/** How copy.icon / items[].icon are named: any Lucide kebab-case name, checked against the props schema's enum. */
		icons: string;
		/** Rows, text props, events and slots from the published props schema. */
		schema: Record<string, string>;
	};
};

export type BlockDetailsError = {
	ok: false;
	code: "unknown_block" | "unknown_variant" | "unknown_target";
	id: string;
	variant?: string;
	target?: string;
};

const KIND_SET = new Set<string>(PAGE_BLOCK_KINDS);

export function getBlockDetails(input: {
	id: string;
	variant?: string;
	target?: string;
}): BlockDetails | BlockDetailsError {
	const id = String(input.id ?? "").trim();
	if (!id) return { ok: false, code: "unknown_block", id };
	if (id.includes("..") || id.startsWith("/") || id.startsWith("file:") || id.includes("://")) {
		return { ok: false, code: "unknown_block", id };
	}

	if (input.target && input.target !== "page-contract-v1" && input.target !== "browser-preview") {
		return { ok: false, code: "unknown_target", id, target: input.target };
	}

	// A page kind that is also a Stock catalog label (features, hero, ...) answers from the catalog: variants and the
	// registry organism. Row kinds without a catalog block answer from the page contract.
	const catalogEntry = getBlockIndex(id);
	if (KIND_SET.has(id) && !(catalogEntry?.available && rendererKindForLabel(id) === id)) {
		if (input.variant && input.variant !== "default") {
			return { ok: false, code: "unknown_variant", id, variant: input.variant };
		}
		return {
			id,
			spec: `page-contract:${id}`,
			title: id,
			variants: ["default"],
			catalogIds: [],
			rendererKind: id as PageBlockKind,
			rendererCompatible: true,
			provenance: catalogProvenance(),
			inspected: true
		};
	}

	const entry = getBlockIndexByCatalogId(id) ?? getBlockIndex(id) ?? catalogSnapshot.blockIndex.find((row) => row.spec === id) ?? null;
	if (!entry || !entry.available) {
		return { ok: false, code: "unknown_block", id };
	}
	// A catalog asset id (block.features/grid) names its variant.
	const assetVariant = id.startsWith(`${entry.spec}/`) ? id.slice(entry.spec.length + 1) : undefined;
	const requested = input.variant && input.variant !== "default" ? input.variant : assetVariant;
	const variants = catalogVariantsFor(entry.spec);
	if (requested && !variants.includes(requested)) {
		return { ok: false, code: "unknown_variant", id, variant: requested };
	}

	const kind = rendererKindForLabel(entry.blockId);
	const source = catalogSourceFor(entry.spec);
	return {
		id: entry.blockId,
		spec: entry.spec,
		title: entry.title,
		variants,
		catalogIds: entry.catalogIds,
		rendererKind: kind,
		rendererCompatible: Boolean(kind),
		provenance: catalogProvenance(),
		inspected: true,
		...(requested ? { variant: requested } : {}),
		...(source
			? {
					registry: {
						item: source.item,
						install: `npx ui8kit add ${source.item} --framework svelte`,
						organism: source.organismName,
						defaultVariant: source.defaultVariant,
						variantProps: variantProps(entry.spec, requested) ?? {},
						slots: source.props,
						icons: LUCIDE_ICON_HINT,
						schema: propsSummaryFor(source.item) ?? {}
					}
				}
			: {})
	};
}

/** A catalog block card of an Ask reply: what the block is, its variants, its registry item and its Stock link. */
export type AskBlockCard = {
	spec: string;
	label: string;
	title: string;
	kind: PageBlockKind | null;
	registryItem: string | null;
	install: string | null;
	defaultVariant: string | null;
	variants: string[];
	/** Stock asset page of the default variant (`#/asset/<spec>/<variant>`). */
	stockUrl: string;
	/** Stock thumbnail of the default variant, or null when Stock has no picture. */
	thumb: string | null;
};

function catalogEntryFor(rawId: string) {
	const id = String(rawId ?? "").trim();
	if (!id || id.includes("..") || id.startsWith("/") || id.startsWith("file:") || id.includes("://")) return null;
	const slash = id.indexOf("/");
	const spec = slash > 0 ? id.slice(0, slash) : id;
	const entry =
		getBlockIndexByCatalogId(id) ??
		getBlockIndex(spec) ??
		catalogSnapshot.blockIndex.find((row) => row.spec === spec || row.spec === `block.${spec}`) ??
		null;
	return entry?.available ? entry : null;
}

/** Card of one catalog block from the bundled catalog (spec, label or asset id), or null when it is not a catalog block. */
export function askBlockCard(id: string): AskBlockCard | null {
	const entry = catalogEntryFor(id);
	if (!entry) return null;
	const source = catalogSourceFor(entry.spec);
	return {
		spec: entry.spec,
		label: entry.blockId,
		title: entry.title,
		kind: rendererKindForLabel(entry.blockId),
		registryItem: source?.item ?? null,
		install: source ? `npx ui8kit add ${source.item} --framework svelte` : null,
		defaultVariant: source?.defaultVariant ?? null,
		variants: catalogVariantsFor(entry.spec),
		stockUrl:
			blockAssetUrl(entry.spec, source?.defaultVariant) ??
			stockSearchUrl([
				["type", "block"],
				["spec", entry.spec]
			]),
		thumb: blockThumbUrl(entry.spec, source?.defaultVariant)
	};
}

/**
 * get_block (Ask mode): the card plus every variant as the props that set it apart from the default and the row and
 * text fields of the published props schema. No icon list (get_block_details has it for Build).
 */
export function getAskBlock(id: string): ({ ok: true } & AskBlockCard & { variantCount: number; variantProps?: Record<string, string>; [key: string]: unknown }) | { ok: false; code: "unknown_block"; id: string } {
	const card = askBlockCard(id);
	if (!card) return { ok: false, code: "unknown_block", id: String(id ?? "") };
	const summary = blockVariantSummary(card.spec);
	const { kind: _kind, registryItem: _item, defaultVariant: _default, variants, ...schema } = summary ?? ({} as Record<string, unknown>);
	return {
		ok: true,
		...card,
		variantCount: card.variants.length,
		...(variants ? { variantProps: variants as Record<string, string> } : {}),
		...schema
	};
}

export function screenCanonicalJson(screenId: string): { json: unknown; bytes: number } | null {
	const screen = getScreenById(screenId);
	if (!screen) return null;
	const payload = {
		...screen,
		compatibility: undefined,
		snapshot: catalogProvenance()
	};
	const json = JSON.parse(JSON.stringify(payload));
	const bytes = new TextEncoder().encode(JSON.stringify(json)).length;
	return { json, bytes };
}

export { catalogSnapshot };

import { PAGE_BLOCK_KINDS, PAGE_COPY_KEYS, type PageBlockKind } from "@buildytech/page-contract";
import { catalogProvenance, catalogSnapshot } from "./snapshot.ts";
import { getBlockIndex, getBlockIndexByCatalogId, rendererKindForLabel } from "./compatibility.ts";
import { getScreenById } from "./search.ts";
import { catalogSourceFor, catalogSources, catalogVariantsFor, variantProps } from "./sources.ts";

export type BlockDetails = {
	id: string;
	spec: string;
	title: string;
	variants: string[];
	catalogIds: string[];
	rendererKind: PageBlockKind | null;
	rendererCompatible: boolean;
	copyKeys: readonly string[];
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
		/** Lucide names allowed in copy.icon / items[].icon. */
		icons: string[];
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
			copyKeys: PAGE_COPY_KEYS,
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
		copyKeys: kind ? PAGE_COPY_KEYS : [],
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
						icons: catalogSources.icons
					}
				}
			: {})
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

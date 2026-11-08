import { PAGE_BLOCK_KINDS, PAGE_COPY_KEYS, type PageBlockKind } from "@buildytech/page-contract";
import { catalogProvenance, catalogSnapshot } from "./snapshot.ts";
import { getBlockIndex, getBlockIndexByCatalogId, rendererKindForLabel } from "./compatibility.ts";
import { getScreenById } from "./search.ts";

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

	if (KIND_SET.has(id)) {
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

	const entry = getBlockIndexByCatalogId(id) ?? getBlockIndex(id);
	if (!entry || !entry.available) {
		return { ok: false, code: "unknown_block", id };
	}

	if (input.variant && !entry.variants.includes(input.variant) && input.variant !== "default") {
		return { ok: false, code: "unknown_variant", id, variant: input.variant };
	}

	const kind = rendererKindForLabel(entry.blockId);
	return {
		id: entry.blockId,
		spec: entry.spec,
		title: entry.title,
		variants: entry.variants,
		catalogIds: entry.catalogIds,
		rendererKind: kind,
		rendererCompatible: Boolean(kind),
		copyKeys: kind ? PAGE_COPY_KEYS : [],
		provenance: catalogProvenance(),
		inspected: true
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

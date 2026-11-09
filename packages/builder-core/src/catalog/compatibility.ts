import { PAGE_BLOCK_KINDS, type PageBlockKind } from "@buildytech/page-contract";
import { catalogSnapshot } from "./snapshot.ts";
import type { CatalogBlockIndexEntry, CatalogScreen, ScreenCompatibility } from "./types.ts";

const KIND_SET = new Set<string>(PAGE_BLOCK_KINDS);

export function getBlockIndex(label: string): CatalogBlockIndexEntry | null {
	return catalogSnapshot.blockIndex.find((b) => b.blockId === label) ?? null;
}

export function getBlockIndexByCatalogId(catalogId: string): CatalogBlockIndexEntry | null {
	return (
		catalogSnapshot.blockIndex.find((b) => b.catalogIds.includes(catalogId) || b.blockId === catalogId) ??
		null
	);
}

export function rendererKindForLabel(label: string): PageBlockKind | null {
	const mapped = catalogSnapshot.rendererMap[label];
	if (mapped && KIND_SET.has(mapped)) return mapped as PageBlockKind;
	if (KIND_SET.has(label)) return label as PageBlockKind;
	return null;
}

export function compatibilityFor(screen: CatalogScreen): ScreenCompatibility {
	const mapped: ScreenCompatibility["mapped"] = [];
	const missing: ScreenCompatibility["missing"] = [];
	for (const label of screen.labels.blocks) {
		const entry = getBlockIndex(label);
		const kind = rendererKindForLabel(label);
		const catalogIds = entry?.catalogIds ?? [];
		if (kind && entry?.available !== false) {
			mapped.push({ catalogLabel: label, rendererKind: kind, catalogIds });
		} else {
			missing.push({
				catalogLabel: label,
				catalogIds,
				reason: entry?.available === false ? "catalog_block_missing" : "renderer_unavailable"
			});
		}
	}
	return {
		screenId: screen.screenId,
		compatible: missing.length === 0 && mapped.length > 0,
		partial: mapped.length > 0 && missing.length > 0,
		mapped,
		missing
	};
}

export function sendBlockedByScreen(screen: CatalogScreen | null): boolean {
	if (!screen) return false;
	const compat = compatibilityFor(screen);
	return !compat.compatible && !compat.partial;
}

export type ScreenSupport = {
	mappedKinds: string[];
	missing: string[];
	mapped: number;
	missingCount: number;
	supported: boolean;
	score: number;
};

/** Browser-renderable coverage. supported means a complete enough Page, not a hollow chrome shell. */
export function screenSupport(screen: CatalogScreen): ScreenSupport {
	const compat = compatibilityFor(screen);
	const mappedKinds = [...new Set(compat.mapped.map((row) => row.rendererKind))];
	const missing = compat.missing.map((row) => row.catalogLabel);
	const score = mappedKinds.length - missing.length;
	const hasBody = mappedKinds.some(
		(kind) =>
			kind === "hero" ||
			kind === "features" ||
			kind === "menu" ||
			kind === "overview" ||
			kind === "metrics" ||
			kind === "chart" ||
			kind === "activity"
	);
	const hasFrame = mappedKinds.includes("nav") || mappedKinds.includes("footer") || mappedKinds.includes("cta");
	const supported =
		mappedKinds.length >= 3 && hasBody && hasFrame && (missing.length === 0 || missing.length < compat.mapped.length);
	return {
		mappedKinds,
		missing,
		mapped: compat.mapped.length,
		missingCount: missing.length,
		supported,
		score
	};
}

export function compareScreenSupport(a: CatalogScreen, b: CatalogScreen): number {
	const sa = screenSupport(a);
	const sb = screenSupport(b);
	if (sa.supported !== sb.supported) return sa.supported ? -1 : 1;
	if (sb.score !== sa.score) return sb.score - sa.score;
	if (sb.mappedKinds.length !== sa.mappedKinds.length) return sb.mappedKinds.length - sa.mappedKinds.length;
	return sa.missingCount - sb.missingCount;
}

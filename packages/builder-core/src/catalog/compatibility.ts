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

import { PAGE_BLOCK_KINDS, type PageBlockKind } from "@buildytech/page-contract";
import { catalogSnapshot } from "./snapshot.ts";
import type { CatalogBlockIndexEntry, CatalogScreen, CatalogScreenSlot, ScreenCompatibility } from "./types.ts";

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

/**
 * Stock blocks of a screen in screen order (the snapshot's composition), with the region each sits in; screens
 * without a composition fall back to their block labels (all body).
 */
export function screenSlots(screen: CatalogScreen): CatalogScreenSlot[] {
	if (screen.layout?.length) return screen.layout;
	return screen.labels.blocks.map((block) => ({ block, variant: "", region: "area" as const }));
}

export function compatibilityFor(screen: CatalogScreen): ScreenCompatibility {
	const mapped: ScreenCompatibility["mapped"] = [];
	const missing: ScreenCompatibility["missing"] = [];
	for (const { block: label } of screenSlots(screen)) {
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
	/** Body (region `area`) Stock blocks that render. */
	body: number;
	supported: boolean;
	score: number;
};

/**
 * Browser-renderable coverage. supported means every Stock block of the screen renders (frame and body) and the body
 * has at least one block that is not app-shell chrome: nothing on the screen is dropped silently. A screen with a
 * missing block is not supported; the Build reply names what it would drop.
 */
export function screenSupport(screen: CatalogScreen): ScreenSupport {
	const compat = compatibilityFor(screen);
	const mappedKinds = [...new Set(compat.mapped.map((row) => row.rendererKind))];
	const missing = compat.missing.map((row) => row.catalogLabel);
	const region = new Map(screenSlots(screen).map((slot) => [slot.block, slot.region]));
	// App-shell chrome (sidenav, bottomnav) is added from the screen family on Dashboards;
	// it does not make a screen a better body match.
	const body = compat.mapped.filter(
		(row) => region.get(row.catalogLabel) === "area" && row.rendererKind !== "sidenav" && row.rendererKind !== "bottomnav"
	).length;
	const score = body - missing.length;
	const supported = missing.length === 0 && body > 0;
	return {
		mappedKinds,
		missing,
		mapped: compat.mapped.length,
		missingCount: missing.length,
		body,
		supported,
		score
	};
}

export function compareScreenSupport(a: CatalogScreen, b: CatalogScreen): number {
	const sa = screenSupport(a);
	const sb = screenSupport(b);
	if (sa.supported !== sb.supported) return sa.supported ? -1 : 1;
	if (sb.score !== sa.score) return sb.score - sa.score;
	if (sb.mapped !== sa.mapped) return sb.mapped - sa.mapped;
	if (sb.mappedKinds.length !== sa.mappedKinds.length) return sb.mappedKinds.length - sa.mappedKinds.length;
	return sa.missingCount - sb.missingCount;
}

import { PAGE_BLOCK_KINDS, type PageBlockKind } from "@buildytech/page-contract";
import { catalogSnapshot } from "./snapshot.ts";

const KIND_SET = new Set<string>(PAGE_BLOCK_KINDS);

/**
 * Renderer kind of a Stock block label (registry metadata: a ranking / role hint). A leaf module on purpose: the bundled
 * Vercel entry (scripts/bundle-vercel-runtime.mjs) snapshots `const { x } = __req(...)` at load, so an import cycle
 * between catalog and page-doc modules leaves the name undefined there (it works with live ESM bindings only).
 */
export function rendererKindForLabel(label: string): PageBlockKind | null {
	const mapped = catalogSnapshot.rendererMap[label];
	if (mapped && KIND_SET.has(mapped)) return mapped as PageBlockKind;
	if (KIND_SET.has(label)) return label as PageBlockKind;
	return null;
}

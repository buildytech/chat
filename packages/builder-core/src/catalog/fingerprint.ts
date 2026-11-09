import { PAGE_BLOCK_KINDS } from "@buildytech/page-contract";
import { POLICY_VERSION } from "../policy.ts";
import { catalogSnapshot } from "./snapshot.ts";
import { SEARCH_INDEX_SOURCES } from "./text-search.ts";

/** FNV-1a 64-bit (BigInt-free, two 32-bit lanes). Identity check only, not security. */
function fnv1a64(text: string): string {
	let h1 = 0x811c9dc5;
	let h2 = 0xcbf29ce4;
	for (let i = 0; i < text.length; i++) {
		const c = text.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
		h2 = Math.imul(h2 ^ (c + 0x9e), 0x01000193) >>> 0;
	}
	return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

let cached: string | null = null;

/**
 * Identity of the page contract the browser and the runtime validate against: block kinds,
 * renderer map, Stock snapshot digest, search index sources and policy version. A browser tab
 * built from another deploy sends a different value and gets client_outdated instead of a
 * proposal its stale validator would reject.
 */
export function contractFingerprint(): string {
	if (cached) return cached;
	const rendererMap = Object.keys(catalogSnapshot.rendererMap)
		.sort()
		.map((key) => `${key}=${catalogSnapshot.rendererMap[key]}`);
	cached = `cf1-${fnv1a64(
		JSON.stringify({
			kinds: PAGE_BLOCK_KINDS,
			rendererMap,
			snapshot: catalogSnapshot.sourceDigest,
			index: SEARCH_INDEX_SOURCES,
			policy: POLICY_VERSION
		})
	)}`;
	return cached;
}

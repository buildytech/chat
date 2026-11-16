import { POLICY_VERSION } from "@buildytech/builder-core";
import { catalogSnapshot } from "@buildytech/builder-core";
import { SEARCH_INDEX_SOURCES } from "@buildytech/builder-core";
import { AGENT_TOOLS_VERSION } from "./agent/agent-tools.ts";

import { fnv1a64 } from "./identity.ts";

let cached: string | null = null;

/**
 * Identity of the page contract the browser and the runtime validate against: block kinds,
 * renderer map, Stock snapshot digest, search index sources, policy version and agent tools version. A browser tab
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
			kinds: catalogSnapshot.rendererKinds,
			rendererMap,
			snapshot: catalogSnapshot.sourceDigest,
			index: SEARCH_INDEX_SOURCES,
			policy: POLICY_VERSION,
			tools: AGENT_TOOLS_VERSION
		})
	)}`;
	return cached;
}

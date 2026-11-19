import { POLICY_VERSION } from "./policy.ts";
import { catalogDigest } from "@buildytech/builder-core";
import { AGENT_TOOLS_VERSION } from "./agent/agent-tools.ts";

import { fnv1a64 } from "./identity.ts";

let cached: string | null = null;

/**
 * Identity of the page contract the browser and the runtime validate against: the pinned catalog,
 * policy version and agent tools version. A browser tab
 * built from another deploy sends a different value and gets client_outdated instead of a
 * proposal its stale validator would reject.
 */
export function contractFingerprint(): string {
	if (cached) return cached;
	cached = `cf1-${fnv1a64(
		JSON.stringify({
			catalog: catalogDigest(),
			policy: POLICY_VERSION,
			tools: AGENT_TOOLS_VERSION
		})
	)}`;
	return cached;
}

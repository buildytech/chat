/**
 * Every derived catalog artifact in one place (ADR 0012, ADR 0039): the exact bytes `npm run snapshot:derive` writes and
 * `npm run snapshot:check` / scripts/m4-api-tests/catalog-artifacts.test.ts compare the files with. Pure: nothing is written here.
 *
 *   catalog/coverage.json                                   from the graph + policy
 *   packages/builder-core/src/catalog/snapshot.json         from the graph + policy (browser snapshot: blockIndex, rendererMap, roles)
 *   packages/builder-core/src/catalog/search-index.json     from the graph + policy
 *   packages/builder-core/src/catalog/sources.json          from the pinned registry files (registry-derive.mjs)
 *   packages/builder-core/src/catalog/props.json            from the pinned registry props (registry-derive.mjs)
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { coverage, deriveSearchIndex, deriveSnapshot, serialize, validatePolicy } from "./catalog-graph.mjs";
import { deriveRegistryArtifacts } from "./registry-derive.mjs";

export const COVERAGE = "catalog/coverage.json";
export const SNAPSHOT = "packages/builder-core/src/catalog/snapshot.json";
export const SEARCH = "packages/builder-core/src/catalog/search-index.json";
const PAGE_TYPES = "packages/page-contract/src/types.ts";

/** The Page DTO block kinds, read from the contract source (the policy may only name these; the v1 contract goes with item 4 of the refactor plan). */
export function pageBlockKinds(root) {
	const match = /PAGE_BLOCK_KINDS\s*=\s*\[([^\]]*)\]/.exec(readFileSync(join(root, PAGE_TYPES), "utf8"));
	if (!match) throw new Error(`${PAGE_TYPES}: PAGE_BLOCK_KINDS not found`);
	return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** path -> exact bytes of every derived artifact. Policy problems throw. */
export function derived(root, graph, policy) {
	const problems = validatePolicy(graph, policy, pageBlockKinds(root));
	if (problems.length) throw new Error(`catalog/policy.v0.json:\n  ${problems.join("\n  ")}`);
	return {
		[COVERAGE]: serialize(coverage(graph, policy), 3),
		[SNAPSHOT]: `${JSON.stringify(deriveSnapshot(graph, policy), null, 2)}\n`,
		[SEARCH]: `${serialize(deriveSearchIndex(graph, policy), 0).trimEnd()}\n`,
		...deriveRegistryArtifacts(root)
	};
}

/** The artifacts whose committed bytes differ from a fresh derivation (`read(path)` returns the committed text or null). */
export function driftOf(root, graph, policy, read = (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null)) {
	return Object.entries(derived(root, graph, policy)).filter(([path, text]) => read(path) !== text).map(([path]) => path);
}

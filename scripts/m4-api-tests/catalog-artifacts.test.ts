/**
 * One derivation for every catalog artifact (ADR 0039, audit B-01 / B-02): the committed files are exactly what a fresh
 * derivation writes, an item cannot exist in one artifact and not in another, and the header / footer role is generated
 * from the policy (no copy in the code).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { derived, driftOf } from "../lib/catalog-artifacts.mjs";
import { pageKindsOf } from "../lib/catalog-graph.mjs";
import { allItems, itemInfo } from "../../packages/builder-core/src/page-doc/items.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (p: string) => readFileSync(`${ROOT}${p}`, "utf8");
const readJson = (p: string) => JSON.parse(read(p));
const graph = readJson("catalog/stock-registry.v0.json");
const policy = readJson("catalog/policy.v0.json");
const OUT = {
	coverage: "catalog/coverage.json",
	snapshot: "packages/builder-core/src/catalog/snapshot.json",
	search: "packages/builder-core/src/catalog/search-index.json",
	sources: "packages/builder-core/src/catalog/sources.json",
	props: "packages/builder-core/src/catalog/props.json"
};

test("every derived artifact is byte-identical to a fresh derivation (in memory, no network)", () => {
	const fresh = derived(ROOT, graph, policy);
	assert.deepEqual(Object.keys(fresh).sort(), Object.values(OUT).sort());
	assert.deepEqual(driftOf(ROOT, graph, policy), []);
});

test("artifact drift fails: a stale or missing file is reported by path", () => {
	const fresh = derived(ROOT, graph, policy);
	const committed = (path: string) => fresh[path];
	assert.deepEqual(driftOf(ROOT, graph, policy, committed), []);
	assert.deepEqual(driftOf(ROOT, graph, policy, (path) => (path === OUT.sources ? fresh[path].replace('"about-company"', '"about-company-x"') : fresh[path])), [OUT.sources]);
	assert.deepEqual(driftOf(ROOT, graph, policy, (path) => (path === OUT.snapshot ? null : fresh[path])), [OUT.snapshot]);
	assert.deepEqual(driftOf(ROOT, graph, policy, (path) => (path === OUT.search ? `${fresh[path]} ` : fresh[path])), [OUT.search]);
});

test("one item list: the graph, sources.json, props.json and the registry files name the same blocks", () => {
	const sources = readJson(OUT.sources);
	const compact = readJson(OUT.props);
	const variantsFile = readJson("registry/variants.v0.json");
	const registryProps = readJson("registry/props.v0.json");
	const graphItems = graph.edges["block-implemented-by-item"].map((e: { to: string }) => e.to);
	const sorted = (list: string[]) => [...new Set(list)].sort();
	const graphProps = graph.edges["item-has-props"].map((e: { from: string }) => e.from);
	// the blocks Stock uses (sources.json) are the registry items with variants; props.json holds those and the registry-only blocks
	assert.deepEqual(sorted(Object.keys(sources.blocks)), sorted(Object.keys(variantsFile.items)));
	assert.deepEqual(sorted(Object.keys(sources.blocks)), sorted(graphItems));
	assert.deepEqual(sorted(Object.keys(compact.items)), sorted(Object.keys(registryProps.items)));
	assert.deepEqual(sorted(Object.keys(compact.items)), sorted(graphProps));
	for (const item of Object.keys(sources.blocks)) assert.ok(compact.items[item], `${item} has no props schema`);
	// every Stock variant that a registry item implements is an asset of sources.json, and the other way round
	const implemented = Object.fromEntries(graph.edges["variant-implemented-by-item"].map((e: { from: string; to: string }) => [e.from, e.to]));
	assert.deepEqual(sorted(Object.keys(sources.assets)), sorted(Object.keys(implemented)));
	for (const [asset, row] of Object.entries(sources.assets) as Array<[string, { item: string }]>) assert.equal(row.item, implemented[asset], asset);
});

test("one block list: blockIndex, rendererMap and coverage name the Stock blocks of the graph", () => {
	const snapshot = readJson(OUT.snapshot);
	const coverage = readJson(OUT.coverage);
	const specs = Object.keys(graph.entities.block).sort();
	assert.deepEqual(snapshot.blockIndex.map((row: { spec: string }) => row.spec).sort(), specs);
	assert.equal(coverage.summary.stockBlocks, specs.length);
	for (const blockId of Object.keys(snapshot.rendererMap)) assert.ok(graph.entities.block[`block.${blockId}`], `rendererMap names an unknown block ${blockId}`);
	assert.deepEqual(snapshot.rendererKinds, pageKindsOf(policy));
	assert.equal(snapshot.screens.length, Object.keys(graph.entities.screen).length);
	assert.equal(Object.keys(readJson(OUT.search).screens).length, snapshot.screens.length);
	assert.deepEqual(Object.keys(readJson(OUT.search).screens).sort(), snapshot.screens.map((screen: { screenId: string }) => screen.screenId).sort());
});

test("role: generated from policy.kindRoles into the snapshot, read by itemInfo, no copy in the code", () => {
	const snapshot = readJson(OUT.snapshot);
	for (const row of snapshot.blockIndex as Array<{ blockId: string; rendererKind: string | null; role: string | null }>) {
		assert.equal(row.role, row.rendererKind ? (policy.kindRoles[row.rendererKind] ?? null) : null, row.blockId);
	}
	const roles = Object.fromEntries(allItems().map((item) => [item, itemInfo(item)!.role]));
	assert.deepEqual(
		Object.entries(roles).filter(([, role]) => role).map(([item, role]) => `${item}:${role}`).sort(),
		["bottom-nav:footer", "footer-split:footer", "nav-bar:header", "sidebar-nav:header", "site-footer:footer", "site-header:header", "sitemap-footer:footer"]
	);
	assert.equal(policy.pageKinds, undefined, "the renderer kinds are derived from pageKindOfBlock");
	assert.doesNotMatch(read("packages/builder-core/src/page-doc/items.ts"), /chromeRole/);
	assert.doesNotMatch(read("packages/builder-core/src/catalog/renderer-kind.ts"), /PAGE_BLOCK_KINDS/);
});

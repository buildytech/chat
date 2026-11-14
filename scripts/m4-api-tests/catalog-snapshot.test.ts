/**
 * Unified catalog snapshot (ADR 0012): one graph of codegen-x Stock + the UI8Kit registry, every edge resolves,
 * every variant preset passes its props schema, coverage is computed, derived artifacts regenerate byte-identically.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
	EDGE_TYPES,
	ENTITY_TYPES,
	coverage,
	deriveSearchIndex,
	deriveSnapshot,
	serialize,
	validateGraph,
	validatePolicy
} from "../lib/catalog-graph.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (p: string) => readFileSync(`${ROOT}${p}`, "utf8");
const graphText = read("catalog/stock-registry.v0.json");
const graph = JSON.parse(graphText);
const policy = JSON.parse(read("catalog/policy.v0.json"));
const props = JSON.parse(read("registry/props.v0.json"));
const variants = JSON.parse(read("registry/variants.v0.json"));
const KINDS = [...read("packages/page-contract/src/types.ts").matchAll(/^\t"([a-z-]+)",?$/gm)].map((m) => m[1]);
const clone = () => JSON.parse(graphText);

test("snapshot --check: lock, graph, derived artifacts and the registry CLI tree all match (offline)", () => {
	const run = spawnSync(process.execPath, ["scripts/snapshot.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
	assert.equal(run.status, 0, run.stderr || run.stdout);
	assert.match(run.stdout, /lock and derived artifacts match/);
});

test("graph: every entity type and edge type is present, counts are exact, every edge resolves, presets validate", () => {
	assert.deepEqual(Object.keys(graph.entities), ENTITY_TYPES);
	assert.deepEqual(Object.keys(graph.edges), Object.keys(EDGE_TYPES));
	for (const type of ENTITY_TYPES) assert.ok(Object.keys(graph.entities[type]).length > 0, type);
	for (const type of Object.keys(EDGE_TYPES)) assert.ok(graph.edges[type].length > 0, type);
	assert.deepEqual(validateGraph(graph, props), []);
	assert.equal(graph.counts.entities.screen, 80);
	assert.equal(graph.counts.entities.variant, graph.catalog.assetCounts.block);
	assert.equal(graph.counts.edges["variant-sets-props"], graph.counts.entities.variant);
});

test("graph: a dangling edge, a missing composition variant and a preset outside its schema are reported", () => {
	const g = clone();
	g.edges["screen-contains-block"][0].to = "block.nope";
	g.edges["screen-contains-block"][1].variant = "block.hero/nope";
	const preset = g.edges["variant-sets-props"].find((e: { to: string }) => e.to === "about-company");
	preset.props = { ...preset.props, layout: "diagonal" };
	const problems = validateGraph(g, props);
	assert.ok(problems.some((p) => /screen-contains-block: to block block\.nope does not exist/.test(p)), problems.join("\n"));
	assert.ok(problems.some((p) => /variant block\.hero\/nope does not exist/.test(p)), problems.join("\n"));
	assert.ok(problems.some((p) => /variant-sets-props: block\.about\/\w+ -> about-company/.test(p)), problems.join("\n"));
});

test("graph: block -> registry item mapping comes from data (assets registry field = variants.v0.json catalog assets)", () => {
	const fromVariants = new Set<string>();
	for (const [name, item] of Object.entries<{ spec: string }>(variants.items)) fromVariants.add(`${item.spec}>${name}`);
	const fromGraph = new Set(graph.edges["block-implemented-by-item"].map((e: { from: string; to: string }) => `${e.from}>${e.to}`));
	assert.deepEqual([...fromGraph].sort(), [...fromVariants].sort());
	for (const e of graph.edges["variant-implemented-by-item"]) {
		assert.equal(variants.items[e.to].variants[graph.entities.variant[e.from].variant].asset, e.from);
	}
});

test("graph: screen compositions are ordered and agree with the screen block labels", () => {
	const home = graph.edges["screen-contains-block"].filter((e: { from: string }) => e.from === "screen.site/home");
	assert.deepEqual(
		home.map((e: { to: string; region: string; order: number }) => `${e.order}:${e.region}:${e.to}`),
		["0:before:block.header", "1:area:block.hero", "2:area:block.features", "3:area:block.cta", "4:after:block.footer"]
	);
	assert.deepEqual(JSON.parse(read("catalog/coverage.json")).stock.screensWhoseBlockLabelsDifferFromComposition, []);
});

test("derived: snapshot.json, search-index.json and coverage.json are exactly what the graph + policy give", () => {
	assert.equal(`${JSON.stringify(deriveSnapshot(graph, policy), null, 2)}\n`, read("packages/builder-core/src/catalog/snapshot.json"));
	assert.equal(`${serialize(deriveSearchIndex(graph, policy), 0).trimEnd()}\n`, read("packages/builder-core/src/catalog/search-index.json"));
	assert.equal(serialize(coverage(graph, policy), 3), read("catalog/coverage.json"));
	assert.equal(serialize(graph, 3), graphText, "the graph is in canonical (deterministic) form");
});

test("coverage: computed numbers match the graph; registry-only blocks and BuildY page kinds are listed", () => {
	const cov = coverage(graph, policy);
	assert.equal(cov.summary.stockBlocks, Object.keys(graph.entities.block).length);
	assert.equal(cov.summary.stockBlocksWithRegistryItem, cov.summary.stockBlocks - cov.stock.blocksWithoutRegistryItem.length);
	assert.equal(cov.summary.registryBlocks - cov.summary.registryBlocksWithStockBlock, cov.registry.blocksWithoutStockBlock.length);
	assert.equal(cov.summary.stockBlocksWithPageKind + cov.buildy.blocksWithoutPageKind.length, cov.summary.stockBlocks);
	for (const spec of cov.buildy.blocksWithoutPageKind) assert.equal(policy.pageKindOfBlock[spec.slice(6)], undefined);
});

test("policy: the only hand-written catalog data; stale names fail", () => {
	assert.deepEqual(validatePolicy(graph, policy, KINDS), []);
	const bad = structuredClone(policy);
	bad.pageKindOfBlock.nope = "hero";
	bad.pageKindOfBlock.hero = "banner";
	bad.ownerFilters.landing.section = "nowhere";
	const problems = validatePolicy(graph, bad, KINDS);
	assert.ok(problems.some((p) => /block\.nope is not a Stock block/.test(p)));
	assert.ok(problems.some((p) => /banner is not a Page DTO kind/.test(p)));
	assert.ok(problems.some((p) => /ownerFilters\.landing\.section: nowhere/.test(p)));
});

test("generated catalog files are ASCII (locale labels stay as \\u escapes)", () => {
	for (const p of ["catalog/stock-registry.v0.json", "catalog/coverage.json", "catalog/snapshot.lock.json"]) {
		assert.doesNotMatch(read(p), /[^\x00-\x7f]/, p);
	}
	assert.equal(graph.entities.facetValue["section/marketing"].label.ru.length > 0, true);
});

test("ADR 0013/0034: every supported non-dashboard screen starts a page of all its Stock blocks in screen order, as registry items that pass the page gate", async () => {
	const core = await import("../../packages/builder-core/src/index.ts");
	const supported = core.catalogSnapshot.screens.filter((screen) => core.screenSupport(screen).supported && !screen.labels.section.includes("dashboard"));
	assert.ok(supported.length >= 8, `supported screens: ${supported.length}`);
	for (const screen of supported) {
		const shown = core.screenItems(screen.screenId);
		assert.deepEqual(shown.missing, [], screen.screenId);
		const started = core.addScreen(core.emptyPage({ title: "Start", locale: "en", now: "2026-11-10T00:00:00.000Z" }), screen.screenId);
		assert.ok(started.ok, `${screen.screenId}: ${JSON.stringify(!started.ok && started)}`);
		if (!started.ok) continue;
		// Every section of the screen is added in screen order, header and footer included (ADR 0037: no count rule).
		assert.equal(started.skipped.length, 0, screen.screenId);
		assert.deepEqual(started.page.blocks.map((block) => block.item), shown.items.map((entry) => entry.item), screen.screenId);
		assert.ok(core.checkPageDoc(started.page).ok, screen.screenId);
		for (const block of started.page.blocks) {
			// A new block carries the registry sample props: structure only, no invented copy.
			assert.ok(core.renderBlock(block), `${screen.screenId} ${block.id} has a registry block`);
			assert.deepEqual((await import("../../packages/builder-core/src/catalog/provenance.ts")).validateItemProps(block.item, core.effectiveProps(block.item, block.variant, block.props)), [], `${screen.screenId} ${block.id} props`);
		}
	}
});

test("ADR 0013: screen support is strict; a screen that would drop a block is named, not rendered hollow", async () => {
	const core = await import("../../packages/builder-core/src/index.ts");
	for (const screen of core.catalogSnapshot.screens) {
		const support = core.screenSupport(screen);
		assert.equal(support.supported, support.missing.length === 0 && support.body > 0, screen.screenId);
	}
	const cov = JSON.parse(read("catalog/coverage.json"));
	assert.equal(cov.summary.stockBlocksWithPageKind, 34);
	assert.equal(cov.summary.screensFullyPageKinded, 10);
});

test("ADR 0012 addendum: two codegen-x pins; Stock content descends from the registry build and publishes the same variants and props", () => {
	const config = JSON.parse(read("catalog/snapshot.config.json"));
	const lock = JSON.parse(read("catalog/snapshot.lock.json"));
	assert.equal(lock.codegenX.commit, config.codegenX.commit);
	assert.equal(lock.ui8kit.sourceCommit, config.ui8kit.sourceCommit ?? config.codegenX.commit);
	assert.equal(lock.codegenX.files["variants.v0.json"].sha256, lock.ui8kit.files["variants/v0.json"].sha256);
	assert.equal(lock.codegenX.files["props.v0.json"].sha256, lock.ui8kit.files["props/v0.json"].sha256);
});

test("site type facet: a Landing and a Website search pick different screens of their own site type; every screen has one site type", async () => {
	const core = await import("../../packages/builder-core/src/index.ts");
	const first = (site: string) => {
		const out = core.executeCatalogTool({ name: "search_catalog", arguments: { site } }, { mode: "build" });
		assert.ok(out.ok);
		return (out.result as { items: Array<{ screenId: string }> }).items[0]!.screenId;
	};
	const landing = first("landing");
	const website = first("website");
	assert.notEqual(landing, website);
	for (const [id, site] of [[landing, "landing"], [website, "website"]] as const) {
		const screen = core.catalogSnapshot.screens.find((s) => s.screenId === id)!;
		assert.ok(screen.labels.site.includes(site), screen.screenId);
		assert.equal(core.screenSupport(screen).supported, true, screen.screenId);
	}
	for (const screen of core.catalogSnapshot.screens) assert.equal(screen.labels.site.length, 1, screen.screenId);
});

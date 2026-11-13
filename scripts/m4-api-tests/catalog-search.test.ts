/**
 * Catalog search and screen support (ADR 0034): the agent's search_catalog ranks Stock screens by the catalog's own
 * facets and text; a screen is supported when the registry renders its blocks (no kind list, no hand-added topic data).
 * Starting a page from any screen always yields a page the gate accepts.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	catalogSnapshot,
	addScreen,
	checkPageDoc,
	emptyPage,
	executeCatalogTool,
	screenItems,
	screenSupport,
	type CompactSearchPayload
} from "../../packages/builder-core/src/index.ts";

const LAYOUTS = "screen.theme-dashboard-console/layouts";

function search(args: Record<string, unknown>): CompactSearchPayload {
	const result = executeCatalogTool({ name: "search_catalog", arguments: args }, { mode: "build" });
	assert.equal(result.ok, true, JSON.stringify(result).slice(0, 400));
	return (result as { result: CompactSearchPayload }).result;
}

test("screen support is the registry's: a screen is supported when every Stock block of it has a renderable registry item", () => {
	for (const screen of catalogSnapshot.screens) {
		const support = screenSupport(screen);
		const shown = screenItems(screen.screenId);
		assert.equal(support.supported, shown.missing.length === 0 && support.body > 0, screen.screenId);
		assert.deepEqual(support.missing.map((m) => m.catalogLabel).sort(), [...shown.missing].sort(), screen.screenId);
	}
	// The food blocks the v1 renderer had no kind for are renderable now.
	for (const id of ["screen.theme-food-delivery/home", "screen.theme-food-grill/home", "screen.theme-restaurant-house/home"]) {
		const screen = catalogSnapshot.screens.find((s) => s.screenId === id)!;
		assert.equal(screenSupport(screen).supported, true, id);
	}
});

test("Stock has app-shell screens; the layouts screen is found by its blocks facet", () => {
	assert.ok(catalogSnapshot.screens.some((screen) => screen.screenId === LAYOUTS));
	assert.equal(screenSupport(catalogSnapshot.screens.find((s) => s.screenId === LAYOUTS)!).supported, true);
	const shell = search({ q: "shell" });
	assert.ok(shell.items.length > 0);
	const side = search({ blocks: ["sidenav"] });
	assert.ok(side.items.some((item) => item.screenId === LAYOUTS), side.items.map((i) => i.screenId).join(" "));
	const many = search({ section: "dashboard", blocks: ["dashshell", "sidenav", "kanban", "overview", "metrics"] });
	assert.ok(many.items.length > 0, "an over-specified blocks list must not return zero screens");
});

test("zero-hit query returns nearest catalog terms and the vocabulary for one re-query", () => {
	// A Russian word that is not a catalog term: the model re-queries in catalog words.
	const miss = search({ q: "\u0441\u0430\u0439\u0434\u0431\u0430\u0440" });
	assert.equal(miss.noFit, true);
	assert.ok(miss.vocabulary && "blocks" in (miss.vocabulary as object));
	assert.ok((miss.vocabulary as { blocks: string[] }).blocks.includes("sidenav"));
	const typo = executeCatalogTool({ name: "search_catalog", arguments: { blocks: ["sidenv"] } }, { mode: "build" });
	assert.ok(JSON.stringify(typo).includes("sidenav"), "nearest suggests sidenav for a typo");
	const es = search({ q: "navegaci\u00f3n" });
	assert.ok(es.items.length > 0, "facet labels in other locales come from the catalog, not from code");
});

test("property: every Stock screen starts a page the gate accepts, or is reported as not renderable; edge items are never doubled", () => {
	let started = 0;
	for (const screen of catalogSnapshot.screens) {
		const r = addScreen(emptyPage({ title: "Page", locale: "ru", now: "2026-11-13T12:00:00.000Z" }), screen.screenId);
		if (!r.ok) {
			assert.ok(["no_sections", "nothing_added"].includes(r.code), `${screen.screenId}: ${r.code}`);
			continue;
		}
		assert.ok(screenItems(screen.screenId).items.length > 0, screen.screenId);
		const gate = checkPageDoc(r.page);
		assert.ok(gate.ok, `${screen.screenId}: ${JSON.stringify(!gate.ok && gate.issues.slice(0, 2))}`);
		started += 1;
		// A second screen on the same page: still valid, one header and one footer.
		const twice = addScreen(r.page, screen.screenId);
		if (twice.ok) assert.ok(checkPageDoc(twice.page).ok, `${screen.screenId} twice`);
	}
	assert.ok(started >= 80, `started ${started}`);
});

test("search index is generated from the pinned catalog commit; contract fingerprint covers it", async () => {
	const { SEARCH_INDEX_SOURCES, contractFingerprint } = await import("../../packages/builder-core/src/index.ts");
	const sources = SEARCH_INDEX_SOURCES as { assets: { digest: string } };
	assert.equal(sources.assets.digest, catalogSnapshot.sourceDigest);
	assert.match(contractFingerprint(), /^cf1-[0-9a-f]{16}$/);
	assert.equal(contractFingerprint(), contractFingerprint());
});

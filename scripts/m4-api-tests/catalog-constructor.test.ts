import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PAGE_BLOCK_KINDS, parsePage } from "../../packages/page-contract/src/index.ts";
import {
	ALLOWED_TOOLS,
	OWNER_FILTERS,
	SCENARIO_IDS,
	catalogSnapshot,
	compatibilityFor,
	catalogToolParameterSchema,
	executeTool,
	parseLayoutCopyEdits,
	toolLoopProposalFailure,
	getBlockDetails,
	isClearPageCommand,
	parseCatalogSnapshot,
	proposeLayout,
	rejectFabricatedLayout,
	displayTitleFromBrief,
	runConstructorTools,
	scenarioCatalogContext,
	searchCatalog
} from "../../packages/builder-core/src/index.ts";

const SNAPSHOT_PATH = new URL("../../packages/builder-core/src/catalog/snapshot.json", import.meta.url);
const fileUnknown: unknown = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
const raw = parseCatalogSnapshot(fileUnknown);

test("production snapshot is pinned codegen-x Stock, not a synthetic TEST fixture", () => {
	assert.equal(raw.provider, "codegen-x");
	assert.equal(raw.repo, "codegen-x/ui8kit");
	assert.equal(raw.sourceArtifact, "apps/stock/content/assets.v0.json");
	assert.equal(raw.sourceDigest, "sha256:a9d256e6935c6a8d579f86d634eebb46dfe36cacd02d9e4e2a0fdce4ff41664a");
	assert.equal(raw.counts.screen, 80);
	assert.equal(raw.screens.length, 80);
	assert.equal(catalogSnapshot.screens.length, 80);
	assert.equal(JSON.stringify(raw).includes("search_blocks"), false);
	assert.equal(
		raw.screens.some((screen) => /synthetic|TEST block/i.test(`${screen.screenId} ${screen.title}`)),
		false
	);
});

test("search_catalog uses bounded Stock facet enums; hero is a job not a section", () => {
	const vocab = raw.facetVocabulary;
	assert.ok(vocab.section.includes("dashboard"));
	assert.ok(vocab.section.includes("marketing"));
	assert.equal(vocab.section.includes("hero"), false);
	assert.ok(vocab.job.includes("hero"));
	const schema = catalogToolParameterSchema();
	assert.deepEqual(schema.section.enum, vocab.section);
	assert.deepEqual(schema.job.enum, vocab.job);

	const misplaced = searchCatalog({ section: "hero" });
	assert.equal(misplaced.noFit, true);
	assert.equal(misplaced.code, "catalog_facet_unknown");
	assert.equal(misplaced.misplaced?.tryFacet, "job");
	assert.equal(misplaced.total, 0);

	const byJob = searchCatalog({ job: "hero" });
	assert.equal(byJob.noFit, false);
	assert.ok(byJob.total > 0);
	assert.ok(byJob.total <= 80);
	assert.ok(byJob.items.every((item) => item.labels.job.includes("hero")));

	const dashboard = searchCatalog({ section: OWNER_FILTERS.dashboard.section });
	assert.ok(dashboard.total > 0);
	const landing = searchCatalog({ section: OWNER_FILTERS.landing.section });
	assert.ok(landing.total > 0);
});

test("owner filters match the pinned snapshot and paginate at 12", () => {
	assert.deepEqual(OWNER_FILTERS.dashboard, raw.ownerFilters.dashboard);
	assert.deepEqual(OWNER_FILTERS.landing, raw.ownerFilters.landing);
	assert.deepEqual(OWNER_FILTERS.website, raw.ownerFilters.website);
	const page = searchCatalog({ type: "screen", page: 1 });
	assert.equal(page.pageSize, 12);
	assert.equal(page.items.length, 12);
	assert.equal(page.total, 80);
	assert.ok(page.pageCount > 1);
});

test("get_block_details inspects real Stock or page-contract ids and rejects unknowns", () => {
	const real = raw.blockIndex.find((entry) => entry.available && entry.rendererCompatible);
	assert.ok(real);
	const details = getBlockDetails({ id: real.blockId });
	assert.equal("ok" in details && details.ok === false, false);
	if (!("ok" in details)) {
		assert.equal(details.inspected, true);
		assert.equal(details.id, real.blockId);
	}
	const missing = getBlockDetails({ id: "synthetic-test-block" });
	assert.equal("ok" in missing && missing.ok === false, true);
	const hero = getBlockDetails({ id: "hero" });
	assert.equal("ok" in hero && hero.ok === false, false);
});

test("propose_layout rejects unsolicited empty generation and accepts explicit clear-page", () => {
	assert.equal(isClearPageCommand("clear the page"), true);
	assert.equal(isClearPageCommand("Create a blank landing page"), false);
	const empty = proposeLayout({
		brief: "Invent a page from nothing",
		scenarioId: null,
		screenId: null,
		expectedRevision: 0
	});
	assert.equal(empty.ok, false);
	if (!empty.ok) assert.equal(empty.code, "needs_clarification");

	const cleared = proposeLayout({
		brief: "clear the page",
		scenarioId: null,
		screenId: null,
		expectedRevision: 0
	});
	assert.equal(cleared.ok, true);
	if (cleared.ok) {
		assert.equal(cleared.page.layout.blocks.length, 0);
		assert.equal(cleared.applied, false);
	}
});

test("snapshot parse narrows ownerFilters and rejects a widened type", () => {
	assert.equal(catalogSnapshot.ownerFilters.blank.type, "screen");
	assert.equal(catalogSnapshot.ownerFilters.dashboard.type, "screen");
	assert.equal(catalogSnapshot.ownerFilters.landing.type, "screen");
	assert.equal(catalogSnapshot.ownerFilters.website.type, "screen");
	const clone = JSON.parse(JSON.stringify(fileUnknown)) as {
		ownerFilters: Record<string, { type?: string; section?: string; job?: string }>;
	};
	clone.ownerFilters.dashboard = { type: "hero", section: "dashboard" };
	assert.throws(
		() => parseCatalogSnapshot(clone),
		(err: Error & { code?: string }) => err.code === "catalog_snapshot_invalid" && /ownerFilters\.dashboard\.type/.test(err.message)
	);
});

test("cta note is taken from the actual screen object", () => {
	const search = searchCatalog({ ...OWNER_FILTERS.dashboard, page: 1 });
	const screen =
		search.items.find((item) => item.compatibility.compatible || item.compatibility.partial) ?? search.items[0];
	assert.ok(screen);
	const withScreen = proposeLayout({
		brief: "Create a responsive dashboard using UI8Kit rules and contracts.",
		scenarioId: "dashboard",
		screenId: screen.screenId,
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(withScreen.ok, true);
	if (withScreen.ok) {
		const cta = withScreen.page.layout.blocks.find((block) => block.kind === "cta");
		if (cta?.copy) assert.equal(cta.copy.note, `Stock screen ${screen.screenId}`);
	}
});

test("scenario proposal is catalog-grounded and schema-valid", () => {
	const proposal = proposeLayout({
		brief: "Create a responsive dashboard using UI8Kit rules and contracts.",
		scenarioId: "dashboard",
		screenId: null,
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(proposal.ok, true);
	if (proposal.ok) {
		assert.ok(proposal.page.layout.blocks.length > 0);
		assert.equal(proposal.liveModel, false);
		assert.equal(proposal.source, "local-catalog-assembler");
		assert.equal(proposal.provenance.assembler, "local-catalog-assembler");
		assert.equal(proposal.applied, false);
		assert.equal(proposal.provenance.catalog.sourceDigest, raw.sourceDigest);
		assert.ok(proposal.provenance.screenId === null || typeof proposal.provenance.screenId === "string");
	}
});

test("constructor tools reject synthetic names and honor no-fit", () => {
	assert.equal(ALLOWED_TOOLS.includes("search_blocks" as never), false);
	assert.equal(ALLOWED_TOOLS.includes("propose_page" as never), false);
	const fake = executeTool({ name: "search_blocks", arguments: { section: "hero" } });
	assert.equal(fake.ok, false);
	if (!fake.ok) assert.equal(fake.code, "unknown_tool");

	const facet = executeTool({ name: "search_catalog", arguments: { section: "hero" } });
	assert.equal(facet.ok, false);
	if (!facet.ok) assert.equal(facet.code, "catalog_facet_unknown");

	const okSearch = executeTool({ name: "search_catalog", arguments: { job: "hero" } });
	assert.equal(okSearch.ok, true);

	const run = runConstructorTools({
		brief: "Create a responsive website using UI8Kit rules and contracts.",
		scenarioId: "website",
		screenId: null,
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(run.ok, true);
	if (run.ok) assert.ok(run.page.layout.blocks.length > 0);

	const fabricated = rejectFabricatedLayout({
		id: "page-draft",
		slug: "invented",
		status: "draft",
		title: "Invented",
		layout: { version: 1, blocks: [{ id: "block-x", kind: "not-a-kind", title: "X", summary: "no" }] },
		seo: {},
		locale: "en",
		createdAt: "2026-11-08T00:00:00.000Z",
		updatedAt: "2026-11-08T00:00:00.000Z"
	});
	assert.equal("ok" in fabricated && fabricated.ok === false, true);
});

test("constructor integration uses real Stock screens for all three ideas", () => {
	const kinds = new Set<string>(PAGE_BLOCK_KINDS);
	const snapshotSrc = readFileSync(new URL("../../packages/builder-core/src/catalog/snapshot.ts", import.meta.url), "utf8");
	assert.match(snapshotSrc, /with \{ type: "json" \}/);
	assert.equal(
		readFileSync(new URL("../../packages/builder-core/src/catalog/snapshot.json.d.ts", import.meta.url), "utf8").includes(
			"CatalogSnapshot"
		),
		true
	);

	for (const scenarioId of SCENARIO_IDS) {
		const search = searchCatalog({ ...OWNER_FILTERS[scenarioId], page: 1 });
		assert.equal(search.noFit, false, scenarioId);
		assert.ok(search.items.length > 0, scenarioId);
		const screen =
			search.items.find((item) => item.compatibility.compatible || item.compatibility.partial) ?? search.items[0];
		assert.ok(screen, scenarioId);

		for (const label of screen.labels.blocks.slice(0, 12)) {
			const details = getBlockDetails({ id: label });
			if ("ok" in details && details.ok === false) continue;
			if ("rendererKind" in details && details.rendererKind) {
				assert.equal(kinds.has(details.rendererKind), true, `${scenarioId} ${details.rendererKind}`);
			}
		}

		const proposal = proposeLayout({
			brief: `Create a ${scenarioId} using UI8Kit rules and contracts.`,
			scenarioId,
			screenId: screen.screenId,
			expectedRevision: 0,
			now: "2026-11-08T00:00:00.000Z"
		});
		assert.equal(proposal.ok, true, `${scenarioId} propose ${screen.screenId}`);
		if (!proposal.ok) continue;
		parsePage(proposal.page);
		assert.ok(proposal.page.layout.blocks.length > 0, scenarioId);
		for (const block of proposal.page.layout.blocks) {
			assert.equal(kinds.has(block.kind), true, `${scenarioId} ${block.kind}`);
		}

		const run = runConstructorTools({
			brief: `Create a ${scenarioId} using UI8Kit rules and contracts.`,
			scenarioId,
			screenId: screen.screenId,
			expectedRevision: 0,
			now: "2026-11-08T00:00:00.000Z"
		});
		assert.equal(run.ok, true, `${scenarioId} tools`);
		if (run.ok) assert.ok(run.page.layout.blocks.length > 0, scenarioId);
	}
});

test("natural language landing request: the model sets scenarioId, no scenario badge needed", () => {
	assert.equal(displayTitleFromBrief("Create a New Year landing page for Barbecue at Home, a grill food delivery restaurant."), "Barbecue at Home");
	const run = runConstructorTools({
		brief:
			"Create a New Year landing page for Barbecue at Home, a grill food delivery restaurant. Include a hero, menu and contact section using existing Stock blocks. Use no invented reviews or discounts.",
		scenarioId: "landing",
		screenId: null,
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(run.ok, true);
	if (!run.ok) return;
	parsePage(run.page);
	assert.equal(run.liveModel, false);
	assert.equal(run.source, "local-catalog-assembler");
	assert.equal(run.provenance.assembler, "local-catalog-assembler");
	assert.equal(run.page.title, "Barbecue at Home");
	assert.ok(run.page.layout.blocks.some((block) => block.kind === "hero"));
	const hero = run.page.layout.blocks.find((block) => block.kind === "hero");
	assert.equal(hero?.copy?.headline, "Barbecue at Home");
	assert.match(String(hero?.copy?.lede ?? ""), /Barbecue at Home/);
	assert.match(String(hero?.copy?.lede ?? ""), /New Year/);
	const cta = run.page.layout.blocks.find((block) => block.kind === "cta");
	assert.notEqual(cta?.copy?.action, "Apply when ready");
	assert.doesNotMatch(JSON.stringify(run.page), /Apply when ready/);
	assert.doesNotMatch(JSON.stringify(run.page), /qalanding1109/i);
});

test("search_catalog tool payload is a compact shortlist without preview or snapshot dump", () => {
	const full = searchCatalog({ job: "hero", page: 1, supportedOnly: true });
	const tool = executeTool({ name: "search_catalog", arguments: { job: "hero", page: 1 } });
	assert.equal(tool.ok, true);
	if (!tool.ok) return;
	const compact = tool.result as {
		items: Array<Record<string, unknown>>;
		pick: { screenId: string } | null;
		next: string;
		vocabulary?: unknown;
	};
	assert.ok(compact.items.length <= 4);
	assert.ok(compact.items.length > 0);
	assert.equal(compact.next, "propose_layout");
	assert.equal(compact.pick?.screenId, full.items[0]?.screenId);
	assert.equal("vocabulary" in compact, false);
	for (const item of compact.items) {
		assert.equal("preview" in item, false);
		assert.equal("spec" in item, false);
		assert.equal("group" in item, false);
		assert.ok(item.screenId);
		assert.ok(item.labels);
		// Block labels (catalog words such as sidenav) let the model check requireBlocks coverage.
		assert.ok(Array.isArray((item.labels as { blocks?: unknown }).blocks));
	}
	const details = executeTool({ name: "get_block_details", arguments: { id: "hero" } });
	assert.equal(details.ok, true);
	if (details.ok) {
		const body = details.result as Record<string, unknown>;
		assert.equal("provenance" in body, false);
		assert.equal(typeof body.catalogDigest, "string");
	}
});

test("live xAI tool host tags source xai-runtime but keeps the local assembler", () => {
	const live = executeTool(
		{
			name: "propose_layout",
			arguments: {
				brief: "Create a New Year landing page for Barbecue at Home, a grill food delivery restaurant.",
				scenarioId: "landing"
			}
		},
		{ liveTurn: true }
	);
	assert.equal(live.ok, true);
	if (!live.ok) return;
	const proposal = live.result as {
		source: string;
		liveModel: boolean;
		provenance: { assembler: string };
		page: { title: string; layout: { blocks: Array<{ kind: string; copy?: { action?: string; headline?: string } }> } };
	};
	assert.equal(proposal.source, "xai-runtime");
	assert.equal(proposal.liveModel, true);
	assert.equal(proposal.provenance.assembler, "local-catalog-assembler");
	assert.equal(proposal.page.title, "Barbecue at Home");
	const cta = proposal.page.layout.blocks.find((block) => block.kind === "cta");
	assert.notEqual(cta?.copy?.action, "Apply when ready");
});

test("search ranks supported screens and rejects hollow commerce shop for website", () => {
	const hero = searchCatalog({ job: "hero", page: 1 });
	assert.equal(hero.items[0]?.screenId, "screen.site/home");
	assert.equal(hero.items[0]?.compatibility.missing.length, 0);
	const compact = executeTool({ name: "search_catalog", arguments: { job: "hero", page: 1 } });
	assert.equal(compact.ok, true);
	if (compact.ok) {
		const first = (compact.result as { items: Array<{ screenId: string; supported: boolean }> }).items[0];
		assert.equal(first.supported, true);
		assert.equal(first.screenId, "screen.site/home");
	}
	const shop = proposeLayout({
		brief: "Create a website with a menu, overview, and contact using existing Stock blocks.",
		scenarioId: "website",
		screenId: "screen.theme-commerce-shop/home",
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(shop.ok, false);
	if (!shop.ok) {
		assert.ok(shop.code === "screen_not_renderable" || shop.code === "scenario_screen_mismatch");
		assert.ok(shop.suggestedScreenIds?.includes("screen.site/home"));
	}
});

test("dashboard and website natural language use renderable Stock coverage", () => {
	assert.equal(displayTitleFromBrief("Create a Dashboard for Orders. No invented figures."), "Orders");
	const dash = proposeLayout({
		brief: "Create a Dashboard for Orders. No invented figures.",
		scenarioId: "dashboard",
		screenId: null,
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(dash.ok, true);
	if (dash.ok) {
		assert.equal(dash.provenance.screenId, "screen.theme-dashboard-console/home");
		// App shell: Stock sidenav + mobile bottomnav from the dashboard-console family; the
		// marketing sitemap footer is omitted unless the author asks for a footer.
		assert.deepEqual(
			dash.page.layout.blocks.map((block) => block.kind),
			["sidenav", "nav", "pagehead", "overview", "metrics", "chart", "activity", "bottomnav"]
		);
		assert.deepEqual(dash.missing, []);
		assert.ok(dash.warnings.some((line) => /sitemap footer omitted/.test(line)));
		assert.equal(dash.page.title, "Orders");
		assert.equal(dash.page.layout.blocks.find((block) => block.kind === "nav")?.copy?.brand, "Orders");
		assert.equal(dash.page.layout.blocks.find((block) => block.kind === "sidenav")?.copy?.brand, "Orders");
		assert.deepEqual(
			(dash.page.layout.blocks.find((block) => block.kind === "sidenav")?.children ?? []).map((child) => child.title),
			["Overview", "Orders", "Activity"]
		);
		assert.equal(dash.page.layout.blocks.find((block) => block.kind === "nav")?.children, undefined);
		assert.deepEqual(
			(dash.page.layout.blocks.find((block) => block.kind === "bottomnav")?.children ?? []).map((child) => child.title),
			["Overview", "Orders", "Activity"]
		);
		assert.equal(dash.page.layout.blocks.find((block) => block.kind === "activity")?.title, "Orders");
		assert.match(String(dash.page.layout.blocks.find((block) => block.kind === "activity")?.copy?.lede ?? ""), /No orders in this draft/);
		assert.match(String(dash.page.layout.blocks.find((block) => block.kind === "overview")?.copy?.lede ?? ""), /No orders in this draft/);
		assert.doesNotMatch(JSON.stringify(dash.page.layout.blocks.find((block) => block.kind === "nav")), /"Home"|"Menu"|"Delivery"|"Contact"/);
		assert.doesNotMatch(JSON.stringify(dash.page), /this page/);
		assert.doesNotMatch(JSON.stringify(dash.page), /Blank page|Catalog only|Apply when ready/);
		assert.doesNotMatch(JSON.stringify(dash.page), /grill plate|menuboard/);
		assert.ok(dash.warnings.some((line) => /screen\.theme-dashboard-console\/home/.test(line)));
	}
	const dashSearch = executeTool({ name: "search_catalog", arguments: { section: "dashboard" } });
	assert.equal(dashSearch.ok, true);
	if (dashSearch.ok) {
		const body = dashSearch.result as {
			pick: { screenId: string; supported: boolean } | null;
			items: Array<{ screenId: string; supported: boolean }>;
			next: string;
		};
		assert.equal(body.next, "propose_layout");
		assert.equal(body.pick?.screenId, "screen.theme-dashboard-console/home");
		assert.equal(body.pick?.supported, true);
		assert.ok(body.items.every((item) => item.supported));
		assert.ok(!body.items.some((item) => /restaurant|menu/.test(item.screenId)));
	}
	const seed = scenarioCatalogContext("dashboard");
	assert.equal(seed?.pick?.screenId, "screen.theme-dashboard-console/home");
	const fromSeed = proposeLayout({
		brief: "Create a Dashboard for Orders. No invented figures.",
		scenarioId: "dashboard",
		screenId: seed?.pick?.screenId ?? null,
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(fromSeed.ok, true);
	if (fromSeed.ok) {
		assert.equal(fromSeed.source, "local-catalog-assembler");
		assert.equal(fromSeed.provenance.screenId, "screen.theme-dashboard-console/home");
		assert.equal(fromSeed.provenance.assembler, "local-catalog-assembler");
	}
	const restaurant = proposeLayout({
		brief: "Create a Dashboard for Orders. No invented figures.",
		scenarioId: "dashboard",
		screenId: "screen.theme-restaurant-house/menu",
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(restaurant.ok, false);
	if (!restaurant.ok) {
		assert.equal(restaurant.code, "scenario_screen_mismatch");
		assert.ok(restaurant.suggestedScreenIds?.includes("screen.theme-dashboard-console/home"));
	}
	const mixed = proposeLayout({
		brief: "Create a dashboard for Orders with menu and delivery. No invented figures.",
		scenarioId: "dashboard",
		screenId: null,
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(mixed.ok, true);
	if (mixed.ok) {
		assert.deepEqual(
			(mixed.page.layout.blocks.find((block) => block.kind === "sidenav")?.children ?? []).map((child) => child.title),
			["Overview", "Orders", "Activity"]
		);
		assert.doesNotMatch(JSON.stringify(mixed.page.layout.blocks.find((block) => block.kind === "sidenav")), /"Home"|"Menu"|"Delivery"/);
	}
	const site = proposeLayout({
		brief: "Create a Website with menu, overview and contact using existing Stock blocks.",
		scenarioId: "website",
		content: { blocks: [], requireBlocks: ["menu", "hours"] },
		screenId: null,
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(site.ok, true);
	if (site.ok) {
		assert.equal(site.provenance.screenId, "screen.site/home");
		// Catalog provenance gate: screen.site/home has no menu or hours Stock block, so they are
		// reported as missing instead of invented.
		assert.ok(!site.page.layout.blocks.some((block) => block.kind === "menu"));
		assert.ok(!site.page.layout.blocks.some((block) => block.kind === "hours"));
		assert.ok(site.missing.includes("menu"));
		assert.ok(site.missing.includes("hours"));
		assert.ok(site.page.layout.blocks.some((block) => block.kind === "nav"));
		assert.ok(site.page.layout.blocks.some((block) => block.kind === "footer"));
		assert.equal(site.page.layout.blocks[0]?.kind, "nav");
		assert.equal(site.page.layout.blocks.at(-1)?.kind, "footer");
		assert.ok(site.warnings.some((line) => /has no such block/.test(line)));
	}
});

test("site.home layout is nav, hero, features, cta, footer", () => {
	const page = proposeLayout({
		brief: "Create a landing page named Harbor",
		scenarioId: "landing",
		screenId: "screen.site/home",
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(page.ok, true);
	if (page.ok) {
		assert.deepEqual(
			page.page.layout.blocks.map((block) => block.kind),
			["nav", "hero", "features", "cta", "footer"]
		);
	}
});

test("follow-up applies the model's typed headline edit and keeps other blocks", () => {
	const first = proposeLayout({
		brief: "Create a New Year landing page for Barbecue at Home, a grill food delivery restaurant.",
		scenarioId: "landing",
		screenId: "screen.site/home",
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(first.ok, true);
	if (!first.ok) return;
	const footer = first.page.layout.blocks.find((block) => block.kind === "footer");
	const follow = proposeLayout({
		brief: "Change only the hero headline to New Year Grill Delivery. Keep all other sections and their content unchanged.",
		scenarioId: "landing",
		screenId: "screen.site/home",
		expectedRevision: 1,
		currentPage: first.page,
		edits: [{ kind: "hero", field: "headline", value: "New Year Grill Delivery" }],
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(follow.ok, true);
	if (!follow.ok) return;
	assert.equal(follow.page.id, first.page.id);
	assert.deepEqual(
		follow.page.layout.blocks.map((block) => block.id),
		first.page.layout.blocks.map((block) => block.id)
	);
	const hero = follow.page.layout.blocks.find((block) => block.kind === "hero");
	assert.equal(hero?.copy?.headline, "New Year Grill Delivery");
	assert.doesNotMatch(String(hero?.copy?.headline ?? ""), /Change only/);
	assert.deepEqual(
		follow.page.layout.blocks.find((block) => block.kind === "footer")?.copy,
		footer?.copy
	);
	const pathEdits = parseLayoutCopyEdits([
		{ path: "hero.headline", value: "New Year Grill Delivery" }
	]);
	assert.deepEqual(pathEdits, [{ kind: "hero", field: "headline", value: "New Year Grill Delivery" }]);
	const viaTool = executeTool(
		{
			name: "propose_layout",
			arguments: {
				brief: "Change only the hero headline to New Year Grill Delivery. Keep all other sections and their content unchanged.",
				scenarioId: "landing",
				screenId: "screen.site/home",
				expectedRevision: 1,
				edits: [{ path: "hero.headline", value: "New Year Grill Delivery" }]
			}
		},
		{ currentPage: first.page }
	);
	assert.equal(viaTool.ok, true);
	if (viaTool.ok) {
		const page = (viaTool.result as { page: { layout: { blocks: Array<{ kind: string; copy?: { headline?: string } }> } } }).page;
		assert.equal(page.layout.blocks.find((block) => block.kind === "hero")?.copy?.headline, "New Year Grill Delivery");
	}
	const rejected = toolLoopProposalFailure({
		toolsCalled: ["search_catalog", "propose_layout", "propose_layout"],
		rejections: [{ code: "scenario_screen_mismatch" }, { code: "screen_not_renderable", path: "/layout/blocks/0" }]
	});
	assert.equal(rejected.code, "propose_layout_rejected");
	assert.match(rejected.message, /propose_layout was called 2 time/);
	assert.doesNotMatch(rejected.message, /did not call propose_layout/);
	assert.doesNotMatch(rejected.message, /Change only|New Year/);
	const inherit = proposeLayout({
		brief: "Change only the hero headline to New Year Grill Delivery. Keep all other sections and their content unchanged.",
		scenarioId: "landing",
		screenId: null,
		expectedRevision: 1,
		currentPage: first.page,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(inherit.ok, true);
	if (inherit.ok) {
		assert.equal(inherit.provenance.screenId, "screen.site/home");
		assert.notEqual(String(inherit.provenance.screenId), "null");
		const cta = inherit.page.layout.blocks.find((block) => block.kind === "cta");
		assert.equal(cta?.copy?.note, "Stock screen screen.site/home");
	}
});

test("missing-renderer warnings include faq, pricing, authpage, and wizard", () => {
	const labels = ["faq", "pricing", "authpage", "wizard"];
	for (const label of labels) {
		const screen = catalogSnapshot.screens.find((item) => item.labels.blocks.includes(label));
		assert.ok(screen, `catalog has ${label}`);
		const compat = compatibilityFor(screen!);
		assert.ok(
			compat.missing.some((row) => row.catalogLabel === label),
			`${label} is reported missing`
		);
	}
	const pricing = proposeLayout({
		brief: "Create a pricing page",
		scenarioId: "landing",
		screenId: "screen.site/pricing",
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	if (pricing.ok) {
		assert.ok(pricing.missing.includes("faq") || pricing.missing.includes("pricing"));
		assert.ok(pricing.warnings.some((line) => /Not rendered/.test(line)));
	} else {
		assert.equal(pricing.code, "screen_not_renderable");
		assert.match(pricing.message, /faq|pricing/);
	}
});

test("ambiguous briefs still do not invent a layout", () => {
	const run = proposeLayout({
		brief: "Make something nice please",
		scenarioId: null,
		screenId: null,
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(run.ok, false);
	if (!run.ok) assert.equal(run.code, "needs_clarification");
});

test("unknown_screen names nearest real screens and the tool-loop failure reports the screen id sent", async () => {
	const core = await import("../../packages/builder-core/src/index.ts");
	const r = core.executeTool({ name: "propose_layout", arguments: { brief: "Dashboard", screenId: "screen.dashboard-console/home", locale: "en", blocks: [] } }, { liveTurn: true });
	assert.equal(r.ok, false);
	assert.equal((r as { code: string }).code, "unknown_screen");
	const suggested = ((r as { result: { suggestedScreenIds: string[] } }).result.suggestedScreenIds ?? []);
	assert.ok(suggested.length > 0 && suggested.every((id) => core.getScreenById(id)), JSON.stringify(suggested));
	assert.match((r as { message: string }).message, /search_catalog/);
	const row = core.toolLoopRejection({ screenId: "screen.dashboard-console/home" }, r as { code: string });
	const failure = core.toolLoopProposalFailure({ toolsCalled: ["propose_layout"], rejections: [row] });
	assert.match(failure.message, /screen ids screen\.dashboard-console\/home/);
	assert.equal(core.toolLoopRejection({ screenId: "<b>hi</b> there" }, r as { code: string }).screenId, "(not a catalog token)");
});

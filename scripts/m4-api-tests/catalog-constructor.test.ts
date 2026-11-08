import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	ALLOWED_TOOLS,
	OWNER_FILTERS,
	catalogSnapshot,
	catalogToolParameterSchema,
	executeTool,
	getBlockDetails,
	isClearPageCommand,
	proposeLayout,
	rejectFabricatedLayout,
	runConstructorTools,
	searchCatalog
} from "../../packages/builder-core/src/index.ts";

const SNAPSHOT_PATH = new URL("../../packages/builder-core/src/catalog/snapshot.json", import.meta.url);
const raw = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as typeof catalogSnapshot;

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

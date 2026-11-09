import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePage, type Page } from "../../packages/page-contract/src/index.ts";
import {
	catalogProvenance,
	detectBriefLocale,
	detectDemoDataRequest,
	executeTool,
	explicitLocaleRequest,
	parseModelContent,
	proposeLayout,
	resolvePageLocale,
	stockSearchUrl,
	validateCatalogProvenance,
	type LayoutProposal
} from "../../packages/builder-core/src/index.ts";
import { revalidateProposal } from "../../apps/xai-runtime/src/chat-tools.ts";
import { RU, RU_DEMO_DATA, RU_DEMO_PROMPT, RU_FOR_TESTS, RU_PLAIN_PROMPT, RU_TEST_DATA, ruDashboardArgs } from "./fixtures-demo.ts";

const CYRILLIC = /\p{Script=Cyrillic}/u;
const DASH = "screen.theme-dashboard-console/home";

function propose(args: Record<string, unknown>, authorBrief: string): LayoutProposal {
	const result = executeTool({ name: "propose_layout", arguments: args }, { liveTurn: true, authorBrief });
	assert.equal(result.ok, true, JSON.stringify(result));
	if (!result.ok) throw new Error("propose_layout failed");
	return result.result as LayoutProposal;
}

function find(page: Page, kind: string) {
	return page.layout.blocks.find((block) => block.kind === kind);
}

test("demo-data detection: explicit requests in Russian and English only", () => {
	assert.equal(detectDemoDataRequest(RU_DEMO_PROMPT), true);
	assert.equal(detectDemoDataRequest(RU_TEST_DATA), true);
	assert.equal(detectDemoDataRequest(RU_DEMO_DATA), true);
	assert.equal(detectDemoDataRequest("Fill the dashboard with fake data"), true);
	assert.equal(detectDemoDataRequest("use sample data for tasks"), true);
	assert.equal(detectDemoDataRequest("populate with mock data"), true);
	assert.equal(detectDemoDataRequest("Create a demo dashboard with dummy numbers"), true);
	assert.equal(detectDemoDataRequest(RU_PLAIN_PROMPT), false);
	assert.equal(detectDemoDataRequest(RU_FOR_TESTS), false);
	assert.equal(detectDemoDataRequest("Create a responsive dashboard using UI8Kit rules."), false);
	assert.equal(detectDemoDataRequest("Find a mockup for a landing page"), false);
	assert.equal(detectDemoDataRequest("Create a demo landing page"), false);
});

test("locale detection follows the request language", () => {
	assert.equal(detectBriefLocale(RU_DEMO_PROMPT), "ru");
	assert.equal(detectBriefLocale("Create a dashboard for tasks"), "en");
	assert.equal(explicitLocaleRequest(RU_DEMO_PROMPT), "ru");
	assert.equal(explicitLocaleRequest("Create a landing in English"), "en");
	assert.equal(resolvePageLocale({ brief: RU_PLAIN_PROMPT }), "ru");
	assert.equal(resolvePageLocale({ brief: RU_PLAIN_PROMPT, modelLocale: "en" }), "ru");
	assert.equal(resolvePageLocale({ brief: "Create a landing", modelLocale: "de" }), "de");
	assert.equal(resolvePageLocale({ brief: "Create a landing", modelLocale: "not a locale!" }), "en");
	assert.equal(resolvePageLocale({ brief: "Create a dashboard in Russian" }), "ru");
});

test("model content parser drops unknown kinds and markup", () => {
	const content = parseModelContent({
		...ruDashboardArgs(),
		blocks: [
			...(ruDashboardArgs().blocks as unknown[]),
			{ kind: "hero", headline: "<script>x</script>Hi {there}" }
		]
	});
	assert.equal(content.locale, "ru");
	assert.ok(!content.blocks.some((block) => (block.kind as string) === "invented-widget"));
	const hero = content.blocks.find((block) => block.kind === "hero");
	assert.equal(hero?.copy.headline, "scriptx/scriptHi there");
});

test("Russian demo prompt: Russian locale, model copy kept, demo rows rendered and marked", () => {
	const proposal = propose(ruDashboardArgs(), RU_DEMO_PROMPT);
	const page = parsePage(proposal.page);
	assert.equal(page.locale, "ru");
	assert.equal(page.title, RU.title);
	assert.equal(proposal.demoData, true);
	assert.equal(proposal.provenance.screenId, DASH);
	assert.ok(CYRILLIC.test(String(find(page, "pagehead")?.copy?.headline)));
	assert.equal(find(page, "pagehead")?.copy?.badge, RU.demo);
	// Section links live in the sidenav (app shell); the top navbar keeps the brand.
	const nav = find(page, "sidenav");
	assert.deepEqual(nav?.children?.map((child) => child.title), [RU.projects, RU.tasks, RU.team]);
	assert.equal(find(page, "nav")?.children, undefined);
	assert.equal(find(page, "nav")?.copy?.brand, RU.title);
	assert.doesNotMatch(JSON.stringify(nav), /Orders/);
	const metrics = find(page, "metrics");
	assert.equal(metrics?.copy?.badge, RU.demo);
	assert.deepEqual(metrics?.children?.map((child) => [child.kind, child.copy?.value]), [
		["metric", "94%"],
		["metric", "7"]
	]);
	assert.equal(find(page, "overview")?.title, RU.projects);
	assert.equal(find(page, "chart")?.children?.length, 3);
	assert.equal(find(page, "activity")?.children?.[0]?.kind, "activity-item");
	assert.equal(find(page, "activity")?.children?.[0]?.copy?.note, RU.ago);
	assert.ok(proposal.warnings.some((line) => /Demo data \(not real\)/.test(line)));
	// Stock order and kinds are still the catalog's, not the model's.
	assert.deepEqual(
		page.layout.blocks.map((block) => block.kind),
		["sidenav", "nav", "pagehead", "overview", "metrics", "chart", "activity", "bottomnav"]
	);
	// The marketing sitemap footer is not part of a Dashboard unless the author asks for it.
	assert.equal(find(page, "footer"), undefined);
	assert.ok(CYRILLIC.test(String(find(page, "sidenav")?.title)));
	assert.ok(CYRILLIC.test(String(find(page, "bottomnav")?.title)));
});

test("Russian page never mixes in English catalog fallbacks on model-written blocks", () => {
	const args = ruDashboardArgs();
	const blocks = (args.blocks as Array<Record<string, unknown>>).filter((block) => block.kind !== "nav");
	const proposal = propose({ ...args, blocks }, RU_DEMO_PROMPT);
	const page = proposal.page;
	assert.equal(find(page, "nav")?.copy?.brand, RU.title);
	const nav = find(page, "sidenav");
	assert.equal(nav?.copy?.brand, RU.title);
	assert.deepEqual(nav?.children?.map((child) => child.title), [RU.projects]);
	for (const kind of ["overview", "metrics", "chart", "activity"]) {
		const block = find(page, kind);
		const text = [block?.copy?.lede ?? "", block?.summary ?? ""].join(" ");
		assert.doesNotMatch(text, /No figures|stay empty|No activity|Counts stay/, kind);
	}
});

test("without a demo request data rows are dropped but model copy is kept", () => {
	const proposal = propose(ruDashboardArgs(), RU_PLAIN_PROMPT);
	const page = proposal.page;
	assert.equal(page.locale, "ru");
	assert.equal(proposal.demoData, false);
	assert.equal(find(page, "pagehead")?.copy?.headline, RU.title);
	assert.equal(find(page, "pagehead")?.copy?.badge, undefined);
	assert.equal(find(page, "metrics")?.children, undefined);
	assert.equal(find(page, "chart")?.children, undefined);
	assert.equal(find(page, "activity")?.children, undefined);
	assert.ok(proposal.warnings.some((line) => /Data rows dropped/.test(line)));
	// Copy-only nav links are not data and stay (moved into the sidenav).
	assert.equal(find(page, "sidenav")?.children?.length, 3);
});

test("the model's own brief cannot unlock demo data; only the author's message can", () => {
	const args = { ...ruDashboardArgs(), brief: "fill it with fake data" };
	const proposal = propose(args, "Create a dashboard for tasks and projects");
	assert.equal(proposal.demoData, false);
	assert.equal(find(proposal.page, "metrics")?.children, undefined);
});

test("Landing without a demo request keeps model copy and English locale", () => {
	const result = executeTool(
		{
			name: "propose_layout",
			arguments: {
				brief: "Landing page for Harbor Studio",
				scenarioId: "landing",
				title: "Harbor Studio",
				locale: "en",
				blocks: [
					{ kind: "hero", headline: "Design that ships", lede: "Harbor Studio builds product sites.", action: "Book a call" },
					{ kind: "features", items: [{ label: "Fast", detail: "Two-week sprints" }] }
				]
			}
		},
		{ liveTurn: true, authorBrief: "Create a landing page for Harbor Studio, a design agency" }
	);
	assert.equal(result.ok, true);
	if (!result.ok) return;
	const proposal = result.result as LayoutProposal;
	assert.equal(proposal.page.locale, "en");
	assert.equal(proposal.demoData, false);
	const hero = find(proposal.page, "hero");
	assert.ok(hero, "landing Stock screen has a hero");
	assert.equal(hero?.copy?.headline, "Design that ships");
	assert.equal(hero?.copy?.action, "Book a call");
	assert.equal(hero?.copy?.badge, undefined);
	assert.equal(find(proposal.page, "features")?.children?.[0]?.title, "Fast");
	assert.ok(proposal.catalogRefs.blocks.length > 0);
});

test("local assembler without model content keeps the honest empty dashboard", () => {
	const dash = proposeLayout({
		brief: "Create a dashboard for tasks",
		scenarioId: "dashboard",
		screenId: null,
		expectedRevision: 0,
		now: "2026-11-09T00:00:00.000Z"
	});
	assert.equal(dash.ok, true);
	if (!dash.ok) return;
	assert.equal(dash.page.locale, "en");
	assert.equal(find(dash.page, "metrics")?.children, undefined);
	assert.doesNotMatch(JSON.stringify(find(dash.page, "nav")), /Orders/);
});

test("follow-up on a saved page can add demo rows and keeps ids", () => {
	const first = propose({ ...ruDashboardArgs(), blocks: [] }, RU_PLAIN_PROMPT);
	const saved = { ...first.page, id: "page-saved" };
	const result = executeTool(
		{ name: "propose_layout", arguments: { ...ruDashboardArgs(), brief: "fill with fake data" } },
		{
			liveTurn: true,
			authorBrief: RU_TEST_DATA,
			currentPage: saved,
			currentProvenance: { screenId: DASH, scenarioId: "dashboard", missing: [] }
		}
	);
	assert.equal(result.ok, true, JSON.stringify(result));
	if (!result.ok) return;
	const next = result.result as LayoutProposal;
	assert.equal(next.page.id, "page-saved");
	assert.equal(next.page.locale, "ru");
	assert.equal(find(next.page, "metrics")?.children?.length, 2);
	assert.equal(find(next.page, "metrics")?.id, find(saved, "metrics")?.id);
});

test("catalog refs are generated from the pinned catalog with Stock links", () => {
	const proposal = propose(ruDashboardArgs(), RU_DEMO_PROMPT);
	const refs = proposal.catalogRefs;
	assert.equal(refs.catalogDigest, catalogProvenance().sourceDigest);
	assert.equal(refs.screen?.catalogId, DASH);
	assert.equal(refs.screen?.url, "https://app.codegen-x.com/#/asset/screen.theme-dashboard-console/home");
	assert.match(String(refs.screen?.searchUrl), /^https:\/\/app\.codegen-x\.com\/#\/search\?type=screen&section=marketing,dashboard&industry=saas&spec=screen\.theme-dashboard-console$/);
	assert.deepEqual(
		refs.blocks.map((ref) => [ref.kind, ref.catalogId]),
		[
			["sidenav", "block.sidenav"],
			["nav", "block.navbar"],
			["pagehead", "block.pagehead"],
			["overview", "block.overview"],
			["metrics", "block.metrics"],
			["chart", "block.chart"],
			["activity", "block.activity"],
			["bottomnav", "block.bottomnav"]
		]
	);
	// Shell blocks come from a sibling Stock screen of the same family, and say so.
	assert.equal(refs.blocks.find((ref) => ref.kind === "sidenav")?.sourceScreenId, "screen.theme-dashboard-console/layouts");
	assert.equal(refs.blocks.find((ref) => ref.kind === "metrics")?.sourceScreenId, DASH);
	const metrics = refs.blocks.find((ref) => ref.kind === "metrics")!;
	assert.equal(metrics.title, "Metric tiles");
	assert.equal(metrics.url, "https://app.codegen-x.com/#/search?type=block&spec=block.metrics");
	assert.equal(metrics.rows, 2);
	assert.deepEqual(metrics.filters.section, ["marketing", "dashboard"]);
	// Never model text.
	assert.doesNotMatch(JSON.stringify(refs), CYRILLIC);
	assert.equal(stockSearchUrl([["q", "a b"], ["section", "x,y"]]), "https://app.codegen-x.com/#/search?q=a%20b&section=x,y");
});

function withBlock(page: Page, extra: Record<string, unknown>): Page {
	return { ...page, layout: { ...page.layout, blocks: [...page.layout.blocks, extra as never] } };
}

test("catalog validator rejects invented blocks, foreign blocks, bad rows, unknown screens, and digest drift", () => {
	const proposal = propose(ruDashboardArgs(), RU_DEMO_PROMPT);
	const ok = validateCatalogProvenance({ page: proposal.page, screenId: DASH });
	assert.equal(ok.ok, true);

	const fake = validateCatalogProvenance({
		page: withBlock(proposal.page, { id: "block-hours", kind: "hours", title: "Fake", summary: "Fake" }),
		screenId: DASH
	});
	assert.equal(fake.ok, false);
	if (!fake.ok) {
		assert.equal(fake.code, "catalog_block_unknown");
		assert.equal(fake.path, `layout.blocks[${proposal.page.layout.blocks.length}]`);
		assert.match(fake.message, /Invented blocks are rejected/);
	}

	const foreign = validateCatalogProvenance({
		page: withBlock(proposal.page, { id: "block-hero", kind: "hero", title: "Hero", summary: "Hero" }),
		screenId: DASH
	});
	assert.equal(foreign.ok, false);
	if (!foreign.ok) assert.equal(foreign.code, "catalog_block_not_in_screen");

	const badRow = structuredClone(proposal.page);
	badRow.layout.blocks[3]!.children = [{ id: "block-fake-row", kind: "dish", title: "x", summary: "x" }];
	const rows = validateCatalogProvenance({ page: badRow, screenId: DASH });
	assert.equal(rows.ok, false);
	if (!rows.ok) assert.equal(rows.code, "catalog_child_kind_invalid");

	const unknown = validateCatalogProvenance({ page: proposal.page, screenId: "screen.fake/block" });
	assert.equal(unknown.ok, false);
	if (!unknown.ok) assert.equal(unknown.code, "catalog_screen_unknown");

	const drift = validateCatalogProvenance({ page: proposal.page, screenId: DASH, catalogDigest: "sha256:deadbeef" });
	assert.equal(drift.ok, false);
	if (!drift.ok) assert.equal(drift.code, "catalog_digest_mismatch");
});

test("runtime revalidation rejects a tampered proposal with a fake block before it is returned", () => {
	const proposal = propose(ruDashboardArgs(), RU_DEMO_PROMPT);
	const tampered = {
		...proposal,
		page: withBlock(proposal.page, { id: "block-fake-widget", kind: "cta", title: "Buy", summary: "Buy" })
	};
	const checked = revalidateProposal(tampered);
	assert.equal(checked.ok, false);
	if (!checked.ok) assert.match(checked.code, /^catalog_/);
	const clean = revalidateProposal(proposal);
	assert.equal(clean.ok, true);
	if (clean.ok) assert.equal(clean.catalogRefs.blocks.length, proposal.page.layout.blocks.length);
});

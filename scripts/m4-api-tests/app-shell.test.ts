import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePage, type Page } from "../../packages/page-contract/src/index.ts";
import {
	detectBottomNavRemoval,
	detectDemoOptOut,
	detectFooterRequest,
	detectSidebarRemoval,
	detectSidebarRequest,
	executeTool,
	isShellOnlyRequest,
	sessionDemoFlag,
	stripInventedFooterYears,
	validateCatalogProvenance,
	type LayoutProposal
} from "../../packages/builder-core/src/index.ts";
import { revalidateProposal } from "../../apps/xai-runtime/src/chat-tools.ts";
import { platformCode } from "../../apps/chat-web/src/lib/browser/xai-client.ts";
import {
	RU,
	RU_ADD_FOOTER,
	RU_ADD_SIDEBAR,
	RU_DEMO_PROMPT,
	RU_HOME,
	RU_NAV_SIDE,
	RU_NO_DEMO,
	RU_PLAIN_PROMPT,
	RU_REMOVE_BOTTOM,
	RU_RENAMED,
	RU_REPORTS,
	RU_WORKSPACE,
	ruDashboardArgs
} from "./fixtures-demo.ts";

const HOME = "screen.theme-dashboard-console/home";
const LAYOUTS = "screen.theme-dashboard-console/layouts";
const CYRILLIC = /\p{Script=Cyrillic}/u;

function propose(args: Record<string, unknown>, authorBrief: string, base?: { page: Page; screenId: string; sessionDemoData?: boolean }): LayoutProposal {
	const result = executeTool(
		{ name: "propose_layout", arguments: args },
		{
			liveTurn: true,
			authorBrief,
			currentPage: base?.page,
			currentProvenance: base ? { screenId: base.screenId, scenarioId: "dashboard", missing: [] } : undefined,
			sessionDemoData: base?.sessionDemoData
		}
	);
	assert.equal(result.ok, true, JSON.stringify(result));
	if (!result.ok) throw new Error("propose_layout failed");
	return result.result as LayoutProposal;
}

function find(page: Page, kind: string) {
	return page.layout.blocks.find((block) => block.kind === kind);
}

function kinds(page: Page): string[] {
	return page.layout.blocks.map((block) => block.kind);
}

/** The 62092a5-era page the owner tested: no sidenav, sitemap footer, nav links in the navbar. */
function legacyTurnOnePage(): Page {
	const fresh = propose(ruDashboardArgs(), RU_DEMO_PROMPT).page;
	const nav = find(fresh, "nav")!;
	const links = find(fresh, "sidenav")!.children!.map((link, index) => ({ ...link, id: `block-nav-link-${index + 1}` }));
	return parsePage({
		...fresh,
		id: "page-turn-one",
		layout: {
			...fresh.layout,
			blocks: fresh.layout.blocks
				.filter((block) => block.kind !== "sidenav" && block.kind !== "bottomnav")
				.map((block) => (block.kind === "nav" ? { ...nav, children: links } : block))
		}
	});
}

test("author intents: sidebar, bottom nav, footer, and demo opt-out in Russian and English", () => {
	assert.equal(detectSidebarRequest(RU_ADD_SIDEBAR), true);
	assert.equal(detectSidebarRequest("There is no sidebar, add one"), true);
	assert.equal(detectSidebarRequest("add a side nav"), true);
	assert.equal(detectSidebarRequest("remove the sidebar"), false);
	assert.equal(detectSidebarRemoval("remove the sidebar"), true);
	assert.equal(detectSidebarRemoval(RU_ADD_SIDEBAR), false);
	assert.equal(detectBottomNavRemoval(RU_REMOVE_BOTTOM), true);
	assert.equal(detectSidebarRemoval("piano sidebar theme"), false);
	assert.equal(detectFooterRequest("remove the footer and add a sidebar"), false);
	assert.equal(detectSidebarRequest("remove the footer and add a sidebar"), true);
	assert.equal(detectBottomNavRemoval("hide the bottom tab bar"), true);
	assert.equal(detectFooterRequest(RU_ADD_FOOTER), true);
	assert.equal(detectFooterRequest("add a footer"), true);
	assert.equal(detectFooterRequest("no footer"), false);
	assert.equal(detectFooterRequest(RU_DEMO_PROMPT), false);
	assert.equal(detectDemoOptOut(RU_NO_DEMO), true);
	assert.equal(detectDemoOptOut("no demo data please"), true);
	assert.equal(detectDemoOptOut(RU_DEMO_PROMPT), false);
	assert.equal(sessionDemoFlag([RU_DEMO_PROMPT, RU_ADD_SIDEBAR]), true);
	assert.equal(sessionDemoFlag([RU_DEMO_PROMPT, RU_NO_DEMO]), false);
	assert.equal(sessionDemoFlag([RU_PLAIN_PROMPT]), false);
});

test("Dashboard is an app shell: Stock sidenav and bottomnav, no sitemap footer by default", () => {
	const proposal = propose(
		{
			...ruDashboardArgs(),
			blocks: [
				...(ruDashboardArgs().blocks as unknown[]),
				{
					kind: "sidenav",
					title: RU_NAV_SIDE,
					brand: RU.title,
					items: [
						{ label: RU_HOME, group: RU_WORKSPACE },
						{ label: RU.projects, group: RU_WORKSPACE },
						{ label: RU_REPORTS, group: RU.team }
					]
				}
			]
		},
		RU_DEMO_PROMPT
	);
	const page = proposal.page;
	assert.deepEqual(kinds(page), ["sidenav", "nav", "pagehead", "overview", "metrics", "chart", "activity", "bottomnav"]);
	assert.equal(find(page, "footer"), undefined);
	assert.ok(proposal.warnings.some((line) => /sitemap footer omitted/.test(line)));
	const side = find(page, "sidenav")!;
	assert.equal(side.title, RU_NAV_SIDE);
	assert.equal(side.copy?.brand, RU.title);
	// Model copy for sidenav links is preserved, with group headings.
	assert.deepEqual(side.children?.map((link) => [link.kind, link.title, link.copy?.eyebrow]), [
		["nav-link", RU_HOME, RU_WORKSPACE],
		["nav-link", RU.projects, RU_WORKSPACE],
		["nav-link", RU_REPORTS, RU.team]
	]);
	// Bottom tab bar mirrors the first sidenav links, without group headings.
	assert.deepEqual(find(page, "bottomnav")?.children?.map((link) => link.title), [RU_HOME, RU.projects, RU_REPORTS]);
	assert.equal(find(page, "bottomnav")?.children?.[0]?.copy?.eyebrow, undefined);
	// Catalog refs include both shell blocks; the gate accepts them only from the Stock family.
	const refs = proposal.catalogRefs.blocks;
	assert.equal(refs.find((ref) => ref.kind === "sidenav")?.catalogId, "block.sidenav");
	assert.equal(refs.find((ref) => ref.kind === "bottomnav")?.catalogId, "block.bottomnav");
	assert.equal(refs.find((ref) => ref.kind === "sidenav")?.sourceScreenId, LAYOUTS);
	assert.match(String(refs.find((ref) => ref.kind === "sidenav")?.url), /#\/search\?type=block&spec=block\.sidenav$/);
	const landing = validateCatalogProvenance({ page, screenId: "screen.theme-saas-launch/home" });
	if (landing.ok) assert.fail("a sidenav outside its Stock family must be rejected");
});

test("footer only when asked; invented footer years are stripped", () => {
	const withFooter = propose(
		{
			...ruDashboardArgs(),
			blocks: [...(ruDashboardArgs().blocks as unknown[]), { kind: "footer", title: "F", legal: "\u00a9 2024 TaskFlow. All rights reserved." }]
		},
		`${RU_DEMO_PROMPT}. ${RU_ADD_FOOTER}`
	);
	assert.ok(find(withFooter.page, "footer"));
	assert.equal(find(withFooter.page, "footer")?.copy?.legal, "TaskFlow. All rights reserved.");
	assert.ok(withFooter.warnings.some((line) => /Removed invented years/.test(line)));
	const kept = stripInventedFooterYears(
		[{ id: "f", kind: "footer", title: "F", summary: "F", copy: { legal: "\u00a9 2025 Acme" } }],
		"Acme was founded in 2025, add a footer"
	);
	assert.equal(kept.blocks[0]?.copy?.legal, "\u00a9 2025 Acme");
	assert.deepEqual(kept.stripped, []);
});

test("follow-up 'add a sidebar' edits the turn-one page: minimal diff, demo, locale, activity kept", () => {
	const base = legacyTurnOnePage();
	assert.equal(find(base, "sidenav"), undefined);
	const activityBefore = find(base, "activity")!;
	// The model re-sends content for everything (no edit flags) and switches to the layouts screen.
	const next = propose(
		{
			brief: "add a sidebar",
			screenId: LAYOUTS,
			locale: "en",
			blocks: [
				{ kind: "sidenav", title: RU_NAV_SIDE, brand: RU.title, items: [{ label: RU.projects }, { label: RU.tasks }], edit: true },
				{ kind: "metrics", title: "Overwritten", items: [{ label: "x", value: "1" }] },
				{ kind: "footer", title: "Footer", legal: "\u00a9 2024 Invented" }
			]
		},
		RU_ADD_SIDEBAR,
		{ page: base, screenId: HOME, sessionDemoData: true }
	);
	const page = next.page;
	assert.equal(page.id, "page-turn-one");
	assert.equal(page.locale, "ru");
	assert.equal(next.demoData, true);
	assert.equal(next.provenance.screenId, LAYOUTS);
	assert.deepEqual(kinds(page), ["sidenav", "nav", "pagehead", "overview", "metrics", "chart", "activity", "bottomnav"]);
	assert.deepEqual(next.diff.added, ["sidenav", "bottomnav"]);
	assert.deepEqual(next.diff.removed, []);
	assert.deepEqual(next.diff.kept, ["nav", "pagehead", "overview", "metrics", "chart", "activity", "footer"].filter((kind) => kinds(base).includes(kind)));
	assert.ok(next.warnings[0]!.startsWith("Added sidenav, bottomnav."));
	// Existing blocks keep copy, rows, and ids (no edit flag on metrics).
	assert.deepEqual(find(page, "activity"), activityBefore);
	assert.equal(find(page, "metrics")?.title, find(base, "metrics")?.title);
	assert.deepEqual(find(page, "metrics")?.children, find(base, "metrics")?.children);
	assert.equal(find(page, "metrics")?.copy?.badge, RU.demo);
	// Footer is not invented on a Dashboard follow-up.
	assert.equal(find(page, "footer"), undefined);
	// Sidenav uses the model's copy.
	assert.deepEqual(find(page, "sidenav")?.children?.map((link) => link.title), [RU.projects, RU.tasks]);
	assert.ok(CYRILLIC.test(String(find(page, "bottomnav")?.title)));
	// activity comes from the home sibling: the family gate accepts it on the layouts screen.
	const gate = validateCatalogProvenance({ page, screenId: LAYOUTS });
	assert.equal(gate.ok, true);
	if (gate.ok) assert.equal(gate.refs.blocks.find((ref) => ref.kind === "activity")?.sourceScreenId, HOME);
	assert.equal(revalidateProposal(next).ok, true);
});

test("follow-up without a sidebar request on a legacy page moves nothing and keeps demo sticky", () => {
	const base = legacyTurnOnePage();
	const plain = { ...base, layout: { ...base.layout, blocks: base.layout.blocks.map((block) => {
		if (!block.copy?.badge) return block;
		const copy = { ...block.copy };
		delete copy.badge;
		return { ...block, copy };
	}) } };
	const next = propose(
		{ brief: "rename activity", blocks: [{ kind: "activity", title: RU_RENAMED, edit: true }] },
		"rename the activity block",
		{ page: parsePage(plain), screenId: HOME, sessionDemoData: true }
	);
	assert.deepEqual(next.diff.added, []);
	assert.equal(find(next.page, "activity")?.title, RU_RENAMED);
	assert.equal(find(next.page, "sidenav"), undefined);
	assert.equal(find(next.page, "activity")?.children?.length, find(base, "activity")?.children?.length);
});

test("removals need explicit author intent; demo opt-out strips demo rows and badges", () => {
	const shell = propose(ruDashboardArgs(), RU_DEMO_PROMPT).page;
	const noBottom = propose({ brief: "remove bottom nav", remove: ["bottomnav"] }, RU_REMOVE_BOTTOM, { page: shell, screenId: HOME });
	assert.deepEqual(noBottom.diff.removed, ["bottomnav"]);
	assert.equal(find(noBottom.page, "bottomnav"), undefined);
	assert.ok(find(noBottom.page, "sidenav"));
	// A model "remove" list without any removal words from the author is ignored.
	const ignored = propose({ brief: "x", remove: ["activity", "chart"] }, RU_ADD_SIDEBAR, { page: shell, screenId: HOME });
	assert.deepEqual(ignored.diff.removed, []);
	assert.ok(find(ignored.page, "activity"));
	const real = propose({ brief: "no demo" }, RU_NO_DEMO, { page: shell, screenId: HOME, sessionDemoData: true });
	assert.equal(real.demoData, false);
	assert.equal(find(real.page, "metrics")?.children, undefined);
	assert.ok(!real.page.layout.blocks.some((block) => block.copy?.badge));
	assert.ok(find(real.page, "sidenav")?.children?.length);
});

test("platform errors map to stable codes, never raw host text", () => {
	assert.equal(platformCode(504), "runtime_timeout");
	assert.equal(platformCode(500, "FUNCTION_INVOCATION_TIMEOUT"), "runtime_timeout");
	assert.equal(platformCode(502), "runtime_platform_error");
	assert.equal(platformCode(404), "xai_runtime_unreachable");
});

test("stock empty-state ledes are localized on non-English pages; punctuation-only figures dropped", async () => {
	const { localizeEmptyLedes } = await import("../../packages/builder-core/src/assemble.ts");
	const { parseModelContent } = await import("../../packages/builder-core/src/content.ts");
	const blocks = [
		{ id: "block-activity", kind: "activity", title: "A", summary: "s", copy: { lede: "No activity in this draft. The list stays empty until the author supplies them." } },
		{ id: "block-chart", kind: "chart", title: "C", summary: "s", copy: { lede: "Custom lede." } }
	] as never;
	const ru = localizeEmptyLedes(blocks, "ru") as { copy: { lede?: string } }[];
	assert.match(String(ru[0].copy.lede), /\p{Script=Cyrillic}/u);
	assert.equal(ru[1].copy.lede, "Custom lede.");
	const de = localizeEmptyLedes(blocks, "de") as { copy: { lede?: string } }[];
	assert.equal(de[0].copy.lede, undefined);
	assert.equal(localizeEmptyLedes(blocks, "en"), blocks);
	const parsed = parseModelContent({ blocks: [{ kind: "chart", items: [{ label: "Q1", value: "," }, { label: "Q2", value: "12" }] }] });
	const items = parsed?.blocks[0].items ?? [];
	// "," is not a figure, so the chart point is dropped rather than rendered empty.
	assert.deepEqual(items.map((item) => [item.label, item.value]), [["Q2", "12"]]);
});

test("demo badge follows the page language; metric items need a figure", async () => {
	const { demoLabelForLocale, parseModelContent } = await import("../../packages/builder-core/src/content.ts");
	assert.equal(demoLabelForLocale("Demo data", "ru"), undefined);
	assert.equal(demoLabelForLocale("Sample", "ru"), undefined);
	assert.equal(demoLabelForLocale("\u0414\u0435\u043c\u043e", "ru"), "\u0414\u0435\u043c\u043e");
	assert.equal(demoLabelForLocale("Sample", "en"), "Sample");
	const parsed = parseModelContent({ blocks: [{ kind: "chart", items: [{ label: "Project A" }, { label: "Jan", value: "4" }] }] });
	assert.deepEqual(parsed?.blocks[0].items.map((item) => item.label), ["Jan"]);
});

test("shell-only follow-up ignores model rewrites of other blocks; copy edits are reported as edited", () => {
	const shell = propose(ruDashboardArgs(), RU_DEMO_PROMPT).page;
	const activityBefore = find(shell, "activity");
	// "There is no sidebar, add one" while the model also flags activity and metrics as edited.
	const next = propose(
		{
			brief: "add a sidebar",
			blocks: [
				{ kind: "activity", lede: "Rewritten lede", edit: true, items: [{ label: "Other" }] },
				{ kind: "metrics", title: "Overwritten", edit: true, items: [{ label: "x", value: "1" }] }
			]
		},
		RU_ADD_SIDEBAR,
		{ page: shell, screenId: HOME, sessionDemoData: true }
	);
	assert.deepEqual(find(next.page, "activity"), activityBefore);
	assert.equal(find(next.page, "metrics")?.title, find(shell, "metrics")?.title);
	assert.deepEqual(next.diff.changed.filter((entry) => entry.endsWith(" copy")), []);
	assert.ok(next.warnings.some((line) => /Ignored model rewrites of activity, metrics/.test(line)));
	// An explicit rename is applied and reported as an edit, not as "kept with their copy".
	const renamed = propose(
		{ brief: "rename activity", blocks: [{ kind: "activity", title: RU_RENAMED, edit: true }] },
		"rename the activity block",
		{ page: shell, screenId: HOME, sessionDemoData: true }
	);
	assert.equal(find(renamed.page, "activity")?.title, RU_RENAMED);
	assert.ok(renamed.diff.changed.includes("activity copy"));
	assert.ok(!/\(.*activity.*\) with their copy/.test(renamed.warnings[0]!));
	assert.equal(isShellOnlyRequest(RU_ADD_SIDEBAR), true);
	assert.equal(isShellOnlyRequest("add a sidebar and rename the chart"), false);
});

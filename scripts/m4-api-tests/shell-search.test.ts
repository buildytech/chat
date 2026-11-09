import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePage } from "../../packages/page-contract/src/index.ts";
import {
	SCENARIO_IDS,
	catalogSnapshot,
	clientProposalGate,
	executeTool,
	proposeLayout,
	screenSupport,
	type CompactSearchPayload,
	type LayoutProposal
} from "../../packages/builder-core/src/index.ts";
import { SHELL_FIXTURES } from "./fixtures-shell.ts";

const LAYOUTS = "screen.theme-dashboard-console/layouts";
const SHELL_SCREENS = [
	"screen.theme-dashboard-console/workspace",
	"screen.theme-dashboard-console/shells",
	LAYOUTS
];

function search(args: Record<string, unknown>): CompactSearchPayload {
	const result = executeTool({ name: "search_catalog", arguments: args });
	assert.equal(result.ok, true, JSON.stringify(result).slice(0, 400));
	return (result as { result: CompactSearchPayload }).result;
}

function proposeVia(args: Record<string, unknown>): LayoutProposal {
	const result = executeTool({ name: "propose_layout", arguments: args }, { liveTurn: true, authorBrief: String(args.brief ?? "") });
	assert.equal(result.ok, true, JSON.stringify(result).slice(0, 400));
	return (result as { result: LayoutProposal }).result;
}

test("Stock has three app-shell screens; one is renderable, the others are reported as unrenderable", () => {
	for (const id of SHELL_SCREENS) assert.ok(catalogSnapshot.screens.some((screen) => screen.screenId === id), id);
	assert.equal(screenSupport(catalogSnapshot.screens.find((s) => s.screenId === LAYOUTS)!).supported, true);
	const shell = search({ q: "shell" });
	assert.ok(shell.items.length > 0);
	assert.ok(shell.items.every((item) => item.supported));
	assert.ok(shell.items.some((item) => item.screenId === LAYOUTS));
	const unrenderable = (shell.unrenderable ?? []).map((entry) => entry.screenId);
	assert.ok(unrenderable.includes("screen.theme-dashboard-console/workspace"));
	assert.ok(unrenderable.includes("screen.theme-dashboard-console/shells"));
});

test("blocks facet is catalog-driven and soft: sidenav finds layouts; over-specified lists still rank closest screens", () => {
	const side = search({ blocks: ["sidenav"] });
	assert.equal(side.pick?.screenId, LAYOUTS);
	const many = search({ section: "dashboard", blocks: ["dashshell", "sidenav", "kanban", "overview", "metrics"] });
	assert.ok(many.items.length > 0, "an over-specified blocks list must not return zero screens");
	assert.ok(many.items.every((item) => Array.isArray(item.missingBlocks) || item.missingBlocks === undefined));
});

test("zero-hit query returns nearest catalog terms and the vocabulary for one re-query", () => {
	// A Russian word that is not a catalog term: the model re-queries in catalog words.
	const miss = search({ q: "\u0441\u0430\u0439\u0434\u0431\u0430\u0440" });
	assert.equal(miss.noFit, true);
	assert.ok(miss.vocabulary && "blocks" in (miss.vocabulary as object));
	assert.ok((miss.vocabulary as { blocks: string[] }).blocks.includes("sidenav"));
	const typo = executeTool({ name: "search_catalog", arguments: { blocks: ["sidenv"] } });
	const body = (typo as { result?: CompactSearchPayload }).result ?? (typo as unknown as CompactSearchPayload);
	assert.ok(JSON.stringify(body).includes("sidenav"), "nearest suggests sidenav for a typo");
	// Facet labels in other locales come from the catalog, not from code.
	const es = search({ q: "navegaci\u00f3n" });
	assert.ok(es.items.length > 0);
});

for (const fixture of SHELL_FIXTURES) {
	test(`recorded model args (${fixture.model}, ${fixture.prompt}) reach a shell screen and pass the browser gate`, () => {
		let screenId: string | undefined;
		for (const args of fixture.search) {
			const result = search(args);
			screenId = result.pick?.screenId ?? screenId;
		}
		assert.ok(screenId, "search returned a pick");
		const proposal = proposeVia({ brief: fixture.brief, ...fixture.propose, screenId: fixture.propose.screenId ?? screenId });
		parsePage(proposal.page);
		const gate = clientProposalGate(proposal);
		assert.equal(gate.ok, true, gate.ok ? "" : `${gate.code}: ${gate.message}`);
		const kinds = proposal.page.layout.blocks.map((block) => block.kind);
		assert.ok(kinds.includes("sidenav"), `sidenav rendered: ${kinds.join(",")}`);
		assert.equal(proposal.page.locale, fixture.propose.locale);
		// Recorded args carry intent only (no copy rows), so check the provenance record of the flag.
		assert.equal(proposal.provenance.intent?.demoData, fixture.propose.demoData);
		assert.equal(proposal.provenance.intent?.demoDataSource, fixture.propose.demoData === true ? "model" : "none");
		if (fixture.propose.requireBlocks?.includes("sidenav")) assert.ok(proposal.provenance.intent?.requireBlocks.includes("sidenav"));
		if (gate.ok) {
			const side = gate.refs.blocks.find((ref) => ref.kind === "sidenav");
			assert.equal(side?.catalogId, "block.sidenav");
			assert.equal(side?.sourceScreenId, LAYOUTS);
		}
	});
}

test("property: the assembler never produces a proposal the browser gate rejects", () => {
	const requireSets = [[], ["sidenav"], ["footer"], ["sidenav", "bottomnav"], ["menu", "hours"], ["sidenav", "footer"]];
	const screens = catalogSnapshot.screens.map((screen) => screen.screenId);
	let checked = 0;
	for (const scenarioId of [...SCENARIO_IDS, null] as const) {
		for (const screenId of [null, ...screens]) {
			for (const requireBlocks of requireSets) {
				const result = proposeLayout({
					brief: "Page",
					scenarioId: scenarioId as never,
					screenId,
					expectedRevision: 0,
					content: { blocks: [], requireBlocks: requireBlocks as never, demoData: true, locale: "ru" },
					now: "2026-11-09T00:00:00.000Z"
				});
				if (!result.ok) continue;
				const gate = clientProposalGate(result);
				assert.equal(gate.ok, true, `${scenarioId}/${screenId}/${requireBlocks.join("+")}: ${gate.ok ? "" : gate.message}`);
				checked += 1;
				// Follow-up on the result: add/remove shell blocks; still accepted by the gate.
				const follow = proposeLayout({
					brief: "Follow-up",
					scenarioId: scenarioId as never,
					screenId: result.provenance.screenId,
					expectedRevision: 1,
					currentPage: result.page,
					currentProvenance: { screenId: result.provenance.screenId, scenarioId: result.provenance.scenarioId, missing: result.missing },
					content: { blocks: [], requireBlocks: ["sidenav"], remove: ["footer"] },
					now: "2026-11-09T00:00:00.000Z"
				});
				if (follow.ok) {
					const again = clientProposalGate(follow);
					assert.equal(again.ok, true, `follow-up ${screenId}: ${again.ok ? "" : again.message}`);
				}
			}
		}
	}
	assert.ok(checked > 100, `checked ${checked}`);
});

test("search index is generated from the pinned catalog commit; contract fingerprint covers it", async () => {
	const { SEARCH_INDEX_SOURCES, contractFingerprint } = await import("../../packages/builder-core/src/index.ts");
	const sources = SEARCH_INDEX_SOURCES as { assets: { digest: string } };
	assert.equal(sources.assets.digest, catalogSnapshot.sourceDigest);
	assert.match(contractFingerprint(), /^cf1-[0-9a-f]{16}$/);
	assert.equal(contractFingerprint(), contractFingerprint());
});

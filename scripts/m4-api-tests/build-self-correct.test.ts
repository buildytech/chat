import assert from "node:assert/strict";
import { test } from "node:test";
import {
	catalogVariantsFor,
	executeTool,
	facetTree,
	repairProposeArgs,
	searchCatalog,
	toolLoopProposalFailure
} from "../../packages/builder-core/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";

// ADR 0018: Build self-correction. Session 2026-11-10 (screen.theme-marketing-landing/events): the model sent kind
// features with a block.features variant and no catalogBlock; the screen renders features as block.stats.
const SCREEN = "screen.theme-marketing-landing/events";
const HOST = { liveTurn: true, scenarioId: "landing" as const, mode: "build" as const };
const MODEL = "grok-4.20-0309-non-reasoning";
const blocks = (variant: string | undefined, extra: Array<Record<string, unknown>> = []) => [
	{ kind: "nav", title: "Шашлык Машлык" },
	...extra,
	{ kind: "hero", title: "Новогодняя доставка" },
	{ kind: "features", title: "Меню", ...(variant ? { variant } : {}) },
	{ kind: "cta", title: "Заказать" }
];
const propose = (list: unknown[]) =>
	executeTool({ name: "propose_layout", arguments: { brief: "x", scenarioId: "landing", screenId: SCREEN, locale: "ru", blocks: list } }, HOST);

test("unknown_variant names the caller block, the rendered catalog block and every allowed value", () => {
	const r = propose(blocks("grid"));
	assert.equal(r.ok, false);
	if (r.ok) return;
	assert.equal(r.code, "unknown_variant");
	assert.equal(r.path, "blocks[2].variant");
	const fix = r.result as Record<string, unknown>;
	assert.equal(fix.catalogBlock, "block.stats");
	assert.equal(fix.variant, "grid");
	assert.deepEqual(fix.allowedVariants, catalogVariantsFor("block.stats"));
	assert.ok((fix.catalogBlocksWithVariant as string[]).includes("block.features"));
	assert.match(r.message, /propose_layout\.blocks\[2\] \(kind features "Меню"\)/);
	assert.match(r.message, /plain4/);
});

test("rejection path is the caller's index even when the parser drops a duplicate kind", () => {
	const r = propose(blocks("grid", [{ kind: "nav", title: "dup" }]));
	assert.equal(r.ok, false);
	if (!r.ok) assert.equal(r.path, "blocks[3].variant");
});

test("the allowed variant from the fix, or a catalogBlock that has the variant, is accepted", () => {
	const r1 = propose(blocks("cards"));
	assert.ok(r1.ok);
	const list = blocks(undefined);
	(list[2] as Record<string, unknown>).catalogBlock = "block.features";
	(list[2] as Record<string, unknown>).variant = "grid";
	const r2 = propose(list);
	assert.ok(r2.ok);
});

test("repairProposeArgs drops only the rejected block choice and says so", () => {
	const args = { screenId: SCREEN, blocks: blocks("grid") };
	const r = propose(args.blocks);
	assert.equal(r.ok, false);
	if (r.ok) return;
	const repair = repairProposeArgs(args, r);
	assert.ok(repair);
	const next = repair!.args.blocks as Array<Record<string, unknown>>;
	assert.equal(next[2]!.variant, undefined);
	assert.equal(next[2]!.title, "Меню");
	assert.deepEqual(next[0], args.blocks[0]);
	assert.match(repair!.warning, /variant grid is not a variant of block\.stats/);
	assert.equal(repairProposeArgs(args, { code: "props_invalid", path: "layout.blocks[2].children[0].copy.icon" }), null);
});

test("search_catalog is never a dead end: relaxed facets and a facet tree", () => {
	const exact = searchCatalog({ type: "screen", site: "landing", industry: "food", q: "new year promotion restaurant", supportedOnly: true });
	assert.equal(exact.noFit, true);
	const r = executeTool({ name: "search_catalog", arguments: { site: "landing", section: "marketing", industry: "food", q: "new year promotion restaurant" } }, HOST);
	assert.ok(r.ok);
	const body = r.result as { items: unknown[]; relaxed?: { dropped: string[] }; facets?: Record<string, Array<{ value: string; count: number }>> };
	assert.ok(body.items.length > 0);
	assert.ok(body.relaxed && body.relaxed.dropped.length > 0);
	assert.ok(body.facets && body.facets.site.length > 0 && body.facets.blocks.every((row) => row.count > 0));
	const browse = executeTool({ name: "search_catalog", arguments: { site: "landing", browse: true } }, HOST);
	assert.ok(browse.ok && (browse.result as { facets?: unknown }).facets);
});

test("facetTree counts renderable screens per value with that facet left out", () => {
	const tree = facetTree({ site: "landing" });
	assert.ok(tree.site.some((row) => row.value === "landing"));
	assert.ok(tree.site.some((row) => row.value !== "landing"), "site is counted without the site filter");
	for (const rows of Object.values(tree)) for (const row of rows) assert.ok(row.count > 0);
});

test("failure summary lists the step budget and nearest screens (catalog tokens only)", () => {
	const fail = toolLoopProposalFailure({ toolsCalled: ["search_catalog"], rejections: [], nearest: { screens: [SCREEN], budget: 8 } });
	assert.match(fail.message, /Step budget 8 used up/);
	assert.match(fail.message, new RegExp(SCREEN.replace(/[./]/g, "\\$&")));
});

type Scripted = { calls: Array<{ name: string; arguments: Record<string, unknown> }> };

async function withProvider<T>(script: Scripted[], run: (requests: Array<Record<string, unknown>>) => Promise<T>): Promise<T> {
	const original = globalThis.fetch;
	const requests: Array<Record<string, unknown>> = [];
	let index = 0;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		if (!String(input).includes("/chat/completions")) {
			return new Response(JSON.stringify({ data: [{ id: MODEL }] }), { status: 200, headers: { "content-type": "application/json" } });
		}
		requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
		const step = script[Math.min(index, script.length - 1)]!;
		index += 1;
		const message = {
			role: "assistant",
			content: null,
			tool_calls: step.calls.map((call, i) => ({ id: `c-${index}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } }))
		};
		return new Response(
			JSON.stringify({ model: MODEL, choices: [{ message, finish_reason: "tool_calls" }], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } }),
			{ status: 200, headers: { "content-type": "application/json" } }
		);
	}) as typeof fetch;
	try {
		return await run(requests);
	} finally {
		globalThis.fetch = original;
	}
}

const CTX = { brief: "Шашлык Машлык", mode: "build" as const, scenarioId: "landing" as const, screenId: SCREEN, expectedRevision: 0 };
const bad = { name: "propose_layout", arguments: { screenId: SCREEN, locale: "ru", blocks: blocks("grid") } };

test("the same block error twice: the page is accepted with that block's default variant (2 provider steps)", async () => {
	await withProvider([{ calls: [bad] }, { calls: [bad] }], async (requests) => {
		const turn = await runXaiCatalogTurn("test-key", MODEL, CTX, AbortSignal.timeout(5000));
		assert.ok(turn.proposal.ok, JSON.stringify(turn.proposal));
		assert.equal(requests.length, 2);
		if (!turn.proposal.ok || !("page" in turn.proposal)) return;
		const features = turn.proposal.page.layout.blocks.find((block) => block.kind === "features");
		assert.equal(features?.catalogBlock, "block.stats");
		// The screen's own variant of block.stats (its composition), as when the model omits variant.
		const plain = propose(blocks(undefined));
		assert.ok(plain.ok);
		const expected = plain.ok ? (plain.result as { page: { layout: { blocks: Array<{ kind: string; variant?: string }> } } }).page.layout.blocks.find((b) => b.kind === "features")?.variant : null;
		assert.equal(features?.variant, expected);
		assert.ok(turn.proposal.warnings.some((w) => /variant grid/.test(w) && w.includes(`Used: block.stats/${expected}`)));
		// The first rejection reached the model with fix and budget.
		const tool = (requests[1]!.messages as Array<{ role: string; content?: string }>).filter((m) => m.role === "tool").at(-1);
		const reply = JSON.parse(tool!.content!);
		assert.equal(reply.code, "unknown_variant");
		assert.deepEqual(reply.fix.allowedVariants, catalogVariantsFor("block.stats"));
		assert.equal(reply.budget.maxSteps, 8);
	});
});

test("budget spent on a rejected page: partial acceptance at the end of the run", async () => {
	const search = { name: "search_catalog", arguments: { q: "landing" } };
	const otherBad = { name: "propose_layout", arguments: { screenId: SCREEN, locale: "ru", blocks: blocks("grid2") } };
	await withProvider([{ calls: [search] }, { calls: [search] }, { calls: [search] }, { calls: [search] }, { calls: [search] }, { calls: [search] }, { calls: [search] }, { calls: [otherBad] }], async () => {
		const turn = await runXaiCatalogTurn("test-key", MODEL, CTX, AbortSignal.timeout(5000));
		assert.ok(turn.proposal.ok, JSON.stringify(turn.proposal));
		if (!turn.proposal.ok || !("warnings" in turn.proposal)) return;
		assert.ok(turn.proposal.warnings.some((w) => /grid2/.test(w)));
	});
});

test("budget spent without propose_layout: honest summary with the nearest screens", async () => {
	const search = { name: "search_catalog", arguments: { q: "landing" } };
	await withProvider([{ calls: [search] }], async () => {
		const turn = await runXaiCatalogTurn("test-key", MODEL, CTX, AbortSignal.timeout(5000));
		assert.equal(turn.proposal.ok, false);
		if (turn.proposal.ok) return;
		assert.equal(turn.proposal.code, "propose_layout_missing");
		assert.match(turn.proposal.message, /Step budget 8 used up\. Nearest renderable screens: screen\./);
	});
});

test("row icons outside the contract enum are dropped before the gate (no repair round); the others stay", () => {
	const list = [
		{ kind: "hero", title: "h" },
		{ kind: "features", title: "Menu", items: [{ label: "Skewers", icon: "zzqq-glyph" }, { label: "Delivery", icon: "truck" }] }
	];
	const r = executeTool({ name: "propose_layout", arguments: { brief: "x", scenarioId: "landing", screenId: "screen.theme-marketing-landing/home", locale: "en", blocks: list } }, HOST);
	assert.ok(r.ok, JSON.stringify(r));
	const proposal = r.result as LayoutProposal;
	const rows = proposal.page.layout.blocks.find((block) => block.kind === "features" && block.children?.some((child) => child.title === "Delivery"))!.children!;
	assert.equal(rows.find((child) => child.title === "Skewers")!.copy?.icon, undefined);
	assert.equal(rows.find((child) => child.title === "Delivery")!.copy?.icon, "truck");
	assert.ok(proposal.warnings.some((w) => /dropped .*zzqq-glyph/.test(w)));
});

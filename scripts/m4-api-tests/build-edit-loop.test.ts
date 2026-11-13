// ADR 0033, replaying the owner's 13.11 session: Ask recommended replacing logos / quotesplit and adding steps and
// pricing on a Stock teams page, the plan card never appeared, and Build burned all 8 steps on rejected edit_page /
// propose_layout calls. The page is rebuilt from the same Stock screen (navbar inline, herosplit quoteStats, logos row,
// quotesplit ratingPanel, ctaproof splitStats, sitemap columns); the model's calls are scripted.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	addScreenSections,
	checkPagePlan,
	editPage,
	emptyPageStart,
	executePagePlan,
	executeTool,
	isAgentTextReply,
	patchIssueReports,
	type LayoutProposal
} from "../../packages/builder-core/src/index.ts";
import { pagePatchIssues, type Page } from "../../packages/page-contract/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { planOpText } from "../../apps/chat-web/src/lib/chat-core/change-text.ts";

const MODEL = "grok-4.20-0309-non-reasoning";
const SCREEN = "screen.theme-marketing-landing/teams";
const NOW = "2026-11-13T12:00:00.000Z";

function teamsPage(): { page: Page; provenance: { screenId: string; scenarioId: "landing"; missing: string[] } } {
	const start = emptyPageStart({ screenId: SCREEN, title: "Pulse fitness", locale: "en", now: NOW })!;
	const added = addScreenSections({ page: start.page, provenance: start.provenance, revision: 0, now: NOW } as never, SCREEN);
	assert.ok(added.ok, JSON.stringify(added));
	return { page: added.page, provenance: { screenId: SCREEN, scenarioId: "landing", missing: [] } };
}

const REPLACE_LOGOS = { op: "replace", blockId: "block-features", kind: "features", catalogBlock: "block.features", variant: "grid" };
const REPLACE_QUOTES = { op: "replace", blockId: "block-features-2", kind: "features", catalogBlock: "block.stats", variant: "plain4" };
const ADD_STEPS = { op: "add", kind: "features", catalogBlock: "block.steps", variant: "row", at: 4, title: "How it works" };
const ADD_PRICING = { op: "add", kind: "features", catalogBlock: "block.pricing", variant: "grid", at: 5, title: "Plans" };
const COPY_OPS = [
	{ op: "set", blockId: "block-hero", field: "headline", value: "Train smarter with Pulse" },
	{ op: "set", blockId: "block-cta", field: "lede", value: "Start your first week free." },
	{ op: "set", blockId: "block-footer", field: "legal", value: "Pulse fitness." }
];
// `heading` is not a slot: the schema enum rejects it at ops[7].field (what the owner's run reported).
const BAD_FIELD = { op: "set", blockId: "block-features", field: "heading", value: "Why Pulse" };
const OWNER_OPS = [REPLACE_LOGOS, REPLACE_QUOTES, ADD_STEPS, ADD_PRICING, ...COPY_OPS, BAD_FIELD];

type Scripted = { content?: string | null; calls?: Array<{ name: string; arguments: Record<string, unknown> }> };

async function withProvider<T>(script: Scripted[], run: (requests: Array<Record<string, unknown>>) => Promise<T>): Promise<T> {
	const original = globalThis.fetch;
	const requests: Array<Record<string, unknown>> = [];
	let index = 0;
	globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
		requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
		const step = script[Math.min(index, script.length - 1)]!;
		index += 1;
		const message = {
			role: "assistant",
			content: step.content ?? null,
			...(step.calls?.length ? { tool_calls: step.calls.map((call, i) => ({ id: `call-${index}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } })) } : {})
		};
		return new Response(JSON.stringify({ model: MODEL, choices: [{ message }], usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100 } }), {
			status: 200,
			headers: { "content-type": "application/json" }
		});
	}) as typeof fetch;
	try {
		return await run(requests);
	} finally {
		globalThis.fetch = original;
	}
}

const toolNames = (request: Record<string, unknown>) => (request.tools as Array<{ function: { name: string } }>).map((tool) => tool.function.name);

test("the owner's page: logos and quotesplit are two features-kind blocks; replace and add of catalog blocks apply in one patch", () => {
	const { page, provenance } = teamsPage();
	assert.deepEqual(page.layout.blocks.map((node) => `${node.id}:${node.catalogBlock}/${node.variant}`), [
		"block-nav:block.navbar/inline",
		"block-hero:block.herosplit/quoteStats",
		"block-features:block.logos/row",
		"block-features-2:block.quotesplit/ratingPanel",
		"block-cta:block.ctaproof/splitStats",
		"block-footer:block.sitemap/columns"
	]);
	const made = editPage({ page, provenance, patch: { ops: [REPLACE_LOGOS, REPLACE_QUOTES, ADD_STEPS, ADD_PRICING, ...COPY_OPS] }, expectedRevision: 1, now: NOW });
	assert.ok(made.ok, JSON.stringify(made));
	const next = (made as LayoutProposal).page.layout.blocks;
	assert.deepEqual(next.map((node) => `${node.catalogBlock}/${node.variant}`), [
		"block.navbar/inline",
		"block.herosplit/quoteStats",
		"block.features/grid",
		"block.stats/plain4",
		"block.steps/row",
		"block.pricing/grid",
		"block.ctaproof/splitStats",
		"block.sitemap/columns"
	]);
	assert.equal(new Set(next.map((node) => node.id)).size, next.length);
	assert.equal(next.at(-1)!.kind, "footer");
	assert.equal(next[4]!.title, "How it works");
});

test("add without catalogBlock on a kind the page has says which blocks exist and which catalog blocks to name", () => {
	const { page, provenance } = teamsPage();
	const bad = editPage({ page, provenance, patch: { ops: [{ op: "add", kind: "features", title: "Steps" }] }, expectedRevision: 1, now: NOW });
	assert.equal(bad.ok, false);
	if (bad.ok) return;
	assert.equal(bad.code, "block_exists");
	assert.match(bad.message, /block-features, block-features-2/);
	assert.deepEqual(bad.fix?.blockIds, ["block-features", "block-features-2"]);
	assert.ok((bad.fix?.allowed as string[]).includes("block.steps"));
});

test("add with catalogBlock: wrong kind, unknown variant and a slot above the header are rejected with allowed values", () => {
	const { page, provenance } = teamsPage();
	const kind = editPage({ page, provenance, patch: { ops: [{ op: "add", kind: "hero", catalogBlock: "block.steps" }] }, expectedRevision: 1, now: NOW });
	assert.ok(!kind.ok && kind.code === "catalog_block_kind_mismatch" && kind.path === "$.ops[0].catalogBlock");
	const variant = editPage({ page, provenance, patch: { ops: [{ op: "add", kind: "features", catalogBlock: "block.steps", variant: "nope" }] }, expectedRevision: 1, now: NOW });
	assert.ok(!variant.ok && variant.code === "unknown_variant" && variant.path === "$.ops[0].variant");
	assert.ok(Array.isArray(variant.ok ? null : variant.fix?.allowed) && (variant.fix!.allowed as string[]).includes("row"));
	const slot = editPage({ page, provenance, patch: { ops: [{ op: "add", kind: "features", catalogBlock: "block.steps", at: 0 }] }, expectedRevision: 1, now: NOW });
	assert.ok(!slot.ok && slot.code === "above_header" && slot.path === "$.ops[0].at");
});

test("a schema rejection names the op index, the op, the key at fault and what the op takes", () => {
	const row = (ops: unknown[]) => {
		const issues = pagePatchIssues({ ops });
		return { issues, reports: patchIssueReports({ ops }, issues) };
	};
	const extra = row([REPLACE_LOGOS, { op: "set_items", blockId: "block-features", field: "items", items: [{ label: "a" }] }]);
	assert.equal(extra.reports.length, 1);
	assert.equal(extra.reports[0]!.index, 1);
	assert.equal(extra.reports[0]!.op, "set_items");
	assert.equal(extra.reports[0]!.key, "field");
	assert.deepEqual(extra.reports[0]!.allowedKeys, ["op", "blockId", "items"]);
	assert.match(extra.reports[0]!.message, /ops\[1\] \(set_items\): field is not a key of set_items/);
	const enumed = row([BAD_FIELD]);
	assert.equal(enumed.reports[0]!.keyword, "enum");
	assert.ok(enumed.reports[0]!.allowedValues!.includes("headline") && enumed.reports[0]!.allowedValues!.includes("lede"));
	const page = row([{ op: "set_page", field: "seo.keywords", value: "x" }]);
	assert.deepEqual(page.reports[0]!.allowedValues, ["title", "seo.title", "seo.description"]);
	const missing = row([{ op: "set", blockId: "block-hero", field: "headline" }]);
	assert.equal(missing.reports[0]!.keyword, "required");
	assert.equal(missing.reports[0]!.key, "value");
	const unknown = row([{ op: "append", blockId: "block-hero" }]);
	assert.ok(unknown.reports[0]!.allowedOps!.includes("replace"));
});

test("edit_page returns the failed op's index and fix to the model, not only a keyword", () => {
	const { page, provenance } = teamsPage();
	const result = executeTool({ name: "edit_page", arguments: { ops: OWNER_OPS } }, { liveTurn: true, mode: "build", currentPage: page, currentProvenance: provenance, expectedRevision: 1 });
	assert.equal(result.ok, false);
	if (result.ok) return;
	assert.equal(result.code, "page_patch_invalid");
	assert.equal(result.path, "$.ops[7].field");
	assert.match(result.message, /ops\[7\] \(set\): field must be one of title, summary, eyebrow, headline/);
	assert.match(result.message, /all or nothing/);
	const fix = (result.result as { opIndex: number; fix: { invalidOps: Array<{ index: number }> } });
	assert.equal(fix.opIndex, 7);
	assert.deepEqual(fix.fix.invalidOps.map((row) => row.index), [7]);
	// A runtime rejection names the op too: a slot the kind does not render.
	const slot = executeTool({ name: "edit_page", arguments: { ops: [{ op: "set", blockId: "block-features", field: "headline", value: "x" }] } }, { liveTurn: true, mode: "build", currentPage: page, currentProvenance: provenance, expectedRevision: 1 });
	assert.ok(!slot.ok && slot.code === "slot_not_rendered" && /^ops\[0\] \(set block-features\): features does not render copy.headline/.test(slot.message));
	// kind may be left out when catalogBlock names the block.
	const lenient = executeTool({ name: "edit_page", arguments: { ops: [{ op: "add", catalogBlock: "block.steps", at: 4, title: "Steps" }, { op: "replace", blockId: "block-features-2", catalogBlock: "block.stats", variant: "plain4" }] } }, { liveTurn: true, mode: "build", currentPage: page, currentProvenance: provenance, expectedRevision: 1 });
	assert.ok(lenient.ok, JSON.stringify(lenient));
});

test("owner replay: propose_layout then the same bad edit_page twice ends in 3 steps with the other 7 ops applied and the skipped op said", async () => {
	const { page, provenance } = teamsPage();
	const out = await withProvider(
		[
			{ calls: [{ name: "propose_layout", arguments: { brief: "go", screenId: SCREEN, locale: "en", blocks: [{ kind: "features", title: "x" }] } }] },
			{ calls: [{ name: "edit_page", arguments: { ops: OWNER_OPS } }] },
			{ calls: [{ name: "edit_page", arguments: { ops: OWNER_OPS } }] },
			{ content: "must not be requested" }
		],
		async (requests) => {
			const turn = await runXaiCatalogTurn(
				"test-key",
				MODEL,
				{ brief: "go ahead", mode: "build", scenarioId: "landing", screenId: SCREEN, expectedRevision: 1, currentPage: page, currentProvenance: provenance, liveTurn: true },
				AbortSignal.timeout(5000)
			);
			assert.equal(requests.length, 3, "was 8 steps and nothing applied");
			// propose_layout is offered on the first step only: use_edit_page locks it out.
			assert.deepEqual(toolNames(requests[0]!).sort(), ["edit_page", "propose_layout"]);
			assert.deepEqual(toolNames(requests[1]!), ["edit_page"]);
			assert.deepEqual(toolNames(requests[2]!), ["edit_page"]);
			// The second request carries the actionable rejection of step 1.
			const toolReply = JSON.parse(String((requests[2]!.messages as Array<{ role: string; content: string }>).filter((m) => m.role === "tool").at(-1)!.content));
			assert.equal(toolReply.code, "page_patch_invalid");
			assert.equal(toolReply.opIndex, 7);
			assert.ok(toolReply.fix.invalidOps[0].allowedValues.includes("lede"));
			return turn;
		}
	);
	assert.equal(out.proposal.ok, true);
	if (!out.proposal.ok || isAgentTextReply(out.proposal)) return;
	assert.equal(out.proposal.page.layout.blocks.length, 8);
	assert.ok(out.proposal.warnings.some((line) => /Skipped op 8 \(set block-features heading\): page_patch_invalid\./.test(line)), JSON.stringify(out.proposal.warnings));
	assert.deepEqual(out.meta.toolsCalled, ["propose_layout", "edit_page", "edit_page"]);
});

test("loop guard: the same rejection twice with no host repair stops the turn with a clear message", async () => {
	const { page, provenance } = teamsPage();
	const single = { ops: [BAD_FIELD] };
	const out = await withProvider([{ calls: [{ name: "edit_page", arguments: single }] }], async (requests) => {
		const turn = await runXaiCatalogTurn(
			"test-key",
			MODEL,
			{ brief: "go ahead", mode: "build", scenarioId: "landing", screenId: SCREEN, expectedRevision: 1, currentPage: page, currentProvenance: provenance, liveTurn: true },
			AbortSignal.timeout(5000)
		);
		assert.equal(requests.length, 2, "was the whole budget of 8");
		return turn;
	});
	assert.equal(out.proposal.ok, false);
	if (out.proposal.ok) return;
	assert.equal(out.proposal.code, "propose_layout_rejected");
	assert.match(out.proposal.message, /edit_page was called 2 time\(s\) and rejected \(codes page_patch_invalid; paths \$\.ops\[0\]\.field\)/);
	assert.match(out.proposal.message, /Stopped on the same rejection twice/);
	assert.match(out.proposal.message, /ops\[0\] \(set\): field must be one of/);
	assert.match(out.proposal.message, /The page did not change\./);
	assert.doesNotMatch(out.proposal.message, /Step budget/);
});

test("a different rejection each time is not stopped early: the model still gets its steps", async () => {
	const { page, provenance } = teamsPage();
	const out = await withProvider(
		[
			{ calls: [{ name: "edit_page", arguments: { ops: [BAD_FIELD] } }] },
			{ calls: [{ name: "edit_page", arguments: { ops: [{ op: "set", blockId: "block-features", field: "headline", value: "x" }] } }] },
			{ calls: [{ name: "edit_page", arguments: { ops: [REPLACE_LOGOS] } }] }
		],
		async (requests) => {
			const turn = await runXaiCatalogTurn(
				"test-key",
				MODEL,
				{ brief: "go ahead", mode: "build", scenarioId: "landing", screenId: SCREEN, expectedRevision: 1, currentPage: page, currentProvenance: provenance, liveTurn: true },
				AbortSignal.timeout(5000)
			);
			assert.equal(requests.length, 3);
			return turn;
		}
	);
	assert.equal(out.proposal.ok, true);
});

test("Ask: reading catalog blocks the page lacks (the owner's replace / add answer, no block ids in the prose) offers the plan; the card has valid replace and add ops", async () => {
	const { page, provenance } = teamsPage();
	const answer = "**Fitness app**\n- Replace the Logo cloud with a Features grid.\n- Replace Testimonials, split with Stats (plain4).\n- Add a Steps row and a Pricing grid after the stats.";
	const plan = { summary: "Fitness structure", ops: [{ ...REPLACE_LOGOS, reason: "features" }, { ...REPLACE_QUOTES, reason: "numbers" }, { ...ADD_STEPS, reason: "how" }, { ...ADD_PRICING, reason: "plans" }] };
	const out = await withProvider(
		[
			{ calls: ["block.features", "block.stats", "block.steps", "block.pricing"].map((id) => ({ name: "get_block", arguments: { id } })) },
			{ content: answer },
			{ calls: [{ name: "propose_plan", arguments: plan }] },
			{ content: "must not be requested" }
		],
		async (requests) => {
			const turn = await runXaiCatalogTurn(
				"test-key",
				MODEL,
				{ brief: "use this screen as a hint, present a fictional fitness app", mode: "ask", scenarioId: "landing", screenId: SCREEN, expectedRevision: 1, currentPage: page, currentProvenance: provenance },
				AbortSignal.timeout(5000)
			);
			assert.equal(requests.length, 3);
			// Offered, not forced: a model with no change to recommend may decline.
			assert.equal(requests[2]!.tool_choice, "auto");
			const follow = (requests[2]!.messages as Array<{ role: string; content?: string }>).at(-1)!;
			assert.match(String(follow.content), /call propose_plan now/);
			return turn;
		}
	);
	assert.ok(isAgentTextReply(out.proposal));
	if (!isAgentTextReply(out.proposal)) return;
	assert.equal(out.proposal.text, answer);
	assert.equal(out.proposal.plan?.ops.length, 4);
	assert.ok(out.proposal.plan!.ops.every((op) => op.valid), JSON.stringify(out.proposal.plan!.ops.map((op) => op.issue)));
});

test("Ask: a model that reads a catalog block and has nothing to recommend can decline the offered plan", async () => {
	const { page, provenance } = teamsPage();
	const out = await withProvider([{ calls: [{ name: "get_block", arguments: { id: "block.pricing" } }] }, { content: "Pricing has grid, tiers and compare variants." }, { content: "No change." }], async (requests) => {
		const turn = await runXaiCatalogTurn(
			"test-key",
			MODEL,
			{ brief: "what pricing variants exist?", mode: "ask", scenarioId: "landing", screenId: SCREEN, expectedRevision: 1, currentPage: page, currentProvenance: provenance },
			AbortSignal.timeout(5000)
		);
		assert.equal(requests.length, 3);
		return turn;
	});
	assert.ok(isAgentTextReply(out.proposal));
	if (!isAgentTextReply(out.proposal)) return;
	assert.equal(out.proposal.text, "Pricing has grid, tiers and compare variants.");
	assert.equal(out.proposal.plan, undefined);
});

test("plan add op with a catalog block: checked, run by Apply in Build (no model call) and shown by block", () => {
	const { page, provenance } = teamsPage();
	const plan = checkPagePlan({ page, provenance, revision: 1, now: NOW, raw: { ops: [ADD_STEPS, { op: "add", catalogBlock: "steps", variant: "nope", title: "x" }, { op: "add", kind: "features", title: "no block named" }] } })!;
	assert.equal(plan.ops[0]!.valid, true);
	assert.equal(plan.ops[0]!.catalogBlock, "block.steps");
	assert.equal(plan.ops[1]!.valid, false);
	assert.equal(plan.ops[1]!.issue?.code, "unknown_variant");
	assert.ok(plan.ops[1]!.issue?.allowed?.includes("row"));
	assert.equal(plan.ops[2]!.issue?.code, "block_exists");
	assert.ok(plan.ops[2]!.issue?.allowed?.includes("block.pricing"));
	const en = (key: string) => ({ "plan.op.addBlock": "Add {to}: {title}" })[key] ?? key;
	assert.equal(planOpText(plan.ops[0]!, en), "Add block.steps/row: How it works");
	const run = executePagePlan({ page, provenance, revision: 1, now: NOW, plan, selected: ["op-1"] });
	assert.equal(run.plan.status, "executed");
	assert.ok(run.proposal?.ok);
	assert.equal((run.proposal as LayoutProposal).page.layout.blocks.length, 7);
});

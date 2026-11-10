// Ask / Build interaction (ADR 0020), replaying the owner's failing session (fixtures-askbuild.ts): Ask emits a checked
// page plan, Apply in Build runs the ticked ops without a model call, blocks are targeted by title / catalog title
// (Logo cloud = block.logos) and the reply text is written from what actually changed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
	checkPagePlan,
	compactPlanPayload,
	describePageChanges,
	editPage,
	executePagePlan,
	executeTool,
	isAgentTextReply,
	manualEditsSince,
	mapChatRunRequest,
	resolveBlockRef,
	type LayoutProposal
} from "../../packages/builder-core/src/index.ts";
import type { Page } from "../../packages/page-contract/src/index.ts";
import { sessionDefIssues } from "../../packages/page-contract/src/session.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { changeReportText, planResultText } from "../../apps/chat-web/src/lib/chat-core/change-text.ts";
import { OWNER_ASK_PLAN, OWNER_HISTORY_EDITS, OWNER_SCREEN, OWNER_USAGE, OWNER_VARIANTS } from "./fixtures-askbuild.ts";

const MODEL = "grok-4.20-0309-non-reasoning";
const NOW = "2026-11-10T12:00:00.000Z";
const en = JSON.parse(readFileSync(new URL("../../apps/chat-web/src/lib/i18n/en.json", import.meta.url), "utf8")).messages as Record<string, string>;
const t = (key: string) => en[key] ?? key;
const provenance = { screenId: OWNER_SCREEN, scenarioId: "landing" as const, missing: [] as string[] };

/** The owner's applied page: the Stock landing screen with the variants the Ask audit read. */
function ownerPage(): Page {
	const made = executeTool(
		{ name: "propose_layout", arguments: { brief: "grill delivery promo", screenId: OWNER_SCREEN, scenarioId: "landing", locale: "en", blocks: [{ kind: "hero", title: "Grill at home" }] } },
		{ liveTurn: true, mode: "build" }
	);
	assert.equal(made.ok, true);
	const page = (made.result as LayoutProposal).page;
	const ops = Object.entries(OWNER_VARIANTS)
		.filter(([id, variant]) => page.layout.blocks.find((node) => node.id === id)?.variant !== variant)
		.map(([blockId, variant]) => ({ op: "set_variant", blockId, variant }));
	const patched = editPage({ page, provenance, patch: { ops }, expectedRevision: 0, now: NOW });
	assert.equal(patched.ok, true, JSON.stringify(patched));
	return (patched as LayoutProposal).page;
}

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
			...(step.calls?.length
				? { tool_calls: step.calls.map((call, i) => ({ id: `call-${index}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } })) }
				: {})
		};
		return new Response(
			JSON.stringify({ model: MODEL, choices: [{ message }], usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100 } }),
			{ status: 200, headers: { "content-type": "application/json" } }
		);
	}) as typeof fetch;
	try {
		return await run(requests);
	} finally {
		globalThis.fetch = original;
	}
}

test("blocks resolve by id, title, catalog block and catalog title: Logo cloud is block-logos", () => {
	const page = ownerPage();
	assert.equal(resolveBlockRef(page, "Logo cloud"), "block-logos");
	assert.equal(resolveBlockRef(page, "\"Logo cloud\""), "block-logos");
	assert.equal(resolveBlockRef(page, "block.logos"), "block-logos");
	assert.equal(resolveBlockRef(page, "logos"), "block-logos");
	assert.equal(resolveBlockRef(page, "How it works"), "block-steps");
	assert.equal(resolveBlockRef(page, "block-stats"), "block-stats");
	assert.equal(resolveBlockRef(page, "hero"), "block-hero");
	assert.equal(resolveBlockRef(page, "no such block"), null);
});

test("edit_page on 'Logo cloud' changes block-logos only; the report names it, the rest is unchanged", () => {
	const page = ownerPage();
	const out = executeTool(
		{ name: "edit_page", arguments: { ops: [{ op: "set", blockId: "Logo cloud", field: "title", value: "Trusted by" }] } },
		{ currentPage: page, currentProvenance: provenance, expectedRevision: 3, liveTurn: true, mode: "build" }
	);
	assert.equal(out.ok, true, JSON.stringify(out));
	const next = (out.result as LayoutProposal).page;
	const report = describePageChanges(page, next);
	assert.deepEqual(report.changed.map((row) => [row.id, row.name, row.fields]), [["block-logos", "block.logos", ["title"]]]);
	assert.equal(report.kept.length, page.layout.blocks.length - 1);
	const text = changeReportText(report, t, { title: next.title, fresh: false });
	assert.match(text, /- Trusted by \(block\.logos\): title/);
	assert.match(text, /Unchanged: 9 blocks\./);
	assert.doesNotMatch(text, /Nothing is published|Edited the applied page|author's request|features, features/);
});

test("Ask plan from the owner's rework: every op checked against the page and the catalog", () => {
	const page = ownerPage();
	const plan = checkPagePlan({ page, provenance, revision: 3, raw: OWNER_ASK_PLAN })!;
	assert.ok(plan);
	assert.equal(plan.status, "proposed");
	assert.equal(plan.ops.length, OWNER_ASK_PLAN.ops.length);
	const byBlock = Object.fromEntries(plan.ops.map((op) => [`${op.blockId}:${op.op}`, op]));
	// Titles resolve to ids before the check.
	assert.equal(byBlock["block-hero:set_variant"]?.valid, true);
	assert.equal(byBlock["block-steps:set_variant"]?.from, "columnIcons");
	assert.equal(byBlock["block-nav:set_variant"]?.label, `${page.layout.blocks[0]!.title} (block.navbar)`);
	const logos = byBlock["block-logos:set_variant"]!;
	assert.equal(logos.valid, false);
	assert.equal(logos.issue?.code, "unknown_variant");
	assert.deepEqual(logos.issue?.allowed, ["grid4", "grid3", "row", "icons", "grid2", "tiles4"]);
	assert.equal(plan.ops.filter((op) => op.valid).length, OWNER_ASK_PLAN.ops.length - 1);
	// The tool-loop payload names invalid ops with allowed values only.
	const payload = compactPlanPayload(plan) as { valid: string[]; invalid: Array<{ code: string; allowed?: string[] }> };
	assert.equal(payload.invalid.length, 1);
	assert.equal(payload.invalid[0]!.code, "unknown_variant");
	// The plan is a valid session 1.4.0 message field.
	const message = { id: "msg-1", role: "assistant", text: "Plan", createdAt: NOW, mode: "ask", answer: { blocks: [] }, plan };
	assert.deepEqual(sessionDefIssues(message, "message"), []);
});

test("Apply in Build runs the ticked ops without a model call: variant swaps applied, reply says what changed", () => {
	const page = ownerPage();
	const plan = checkPagePlan({ page, provenance, revision: 3, raw: OWNER_ASK_PLAN })!;
	// The author unticks the hero headline; the invalid logos op cannot be ticked but a stale client may send it.
	const selected = plan.ops.filter((op) => op.op === "set_variant").map((op) => op.id);
	const original = globalThis.fetch;
	let calls = 0;
	globalThis.fetch = (async () => {
		calls += 1;
		throw new Error("no network in Apply in Build");
	}) as typeof fetch;
	let exec: ReturnType<typeof executePagePlan>;
	try {
		exec = executePagePlan({ page, provenance, plan, selected, revision: 3, at: NOW });
	} finally {
		globalThis.fetch = original;
	}
	assert.equal(calls, 0);
	assert.equal(exec.plan.status, "partial");
	assert.equal(exec.plan.executedAt, NOW);
	assert.ok(exec.proposal?.ok);
	const next = (exec.proposal as LayoutProposal).page;
	const variant = (id: string) => next.layout.blocks.find((node) => node.id === id)?.variant;
	assert.equal(variant("block-nav"), "inverse");
	assert.equal(variant("block-hero"), "split");
	assert.equal(variant("block-features"), "tilesMuted");
	assert.equal(variant("block-steps"), "centered");
	assert.equal(variant("block-stats"), "cards");
	assert.equal(variant("block-testimonials"), "grid3");
	assert.equal(variant("block-faq"), "twoColumns");
	assert.equal(variant("block-cta"), "split");
	assert.equal(variant("block-footer"), "newsletter");
	assert.equal(variant("block-logos"), "grid4");
	const results = Object.fromEntries(exec.plan.ops.map((op) => [op.id, op.result?.status]));
	assert.equal(Object.values(results).filter((status) => status === "applied").length, 9);
	assert.equal(results[plan.ops.find((op) => op.op === "set")!.id], "skipped");
	assert.equal(results[plan.ops.find((op) => op.blockId === "block-logos")!.id], "rejected");
	// Reply text from the actual diff: nine variant swaps by block, one block unchanged, the rejected op and why.
	const report = describePageChanges(page, next);
	assert.equal(report.changed.length, 9);
	assert.ok(report.changed.every((row) => row.variant && row.fields.length === 0));
	const text = `${changeReportText(report, t, { title: next.title, fresh: false })}\n${planResultText(exec.plan, t)}`;
	assert.match(text, /\(block\.navbar\): variant inline \u2192 inverse/);
	assert.match(text, /\(block\.steps\): variant columnIcons \u2192 centered/);
	assert.match(text, /Unchanged: 1 blocks\./);
	assert.match(text, /Ask plan: 9 of 10 selected changes applied\./);
	assert.match(text, /Not applied: .*block\.logos.*unknown_variant/);
	assert.doesNotMatch(text, /Nothing is published|author's request|Kept \d+ blocks/);
	// The proposal is an ordinary page-patch proposal the author applies.
	assert.equal(exec.proposal!.ok && exec.proposal.applied, false);
	assert.equal(exec.proposal!.ok && exec.proposal.provenance.assembler, "page-patch/v1");
});

test("manual edits since the last agent turn are kept: plan ops re-check against the page the author has now", () => {
	const page = ownerPage();
	const plan = checkPagePlan({ page, provenance, revision: 3, raw: OWNER_ASK_PLAN })!;
	// The author hand-edits the logos title and already switches steps to centered in the inspector.
	const edited = editPage({
		page,
		provenance,
		patch: { ops: [{ op: "set", blockId: "block-logos", field: "title", value: "Our partners" }, { op: "set_variant", blockId: "block-steps", variant: "centered" }] },
		expectedRevision: 3,
		now: NOW
	}) as LayoutProposal;
	const selected = plan.ops.filter((op) => op.valid).map((op) => op.id);
	const exec = executePagePlan({ page: edited.page, provenance, plan, selected, revision: 5, at: NOW });
	const next = (exec.proposal as LayoutProposal).page;
	assert.equal(next.layout.blocks.find((node) => node.id === "block-logos")?.title, "Our partners");
	const steps = exec.plan.ops.find((op) => op.blockId === "block-steps")!;
	assert.equal(steps.result?.status, "rejected");
	assert.equal(steps.result?.code, "no_change");
	// The history of the owner's chat: hand edits per block since the last agent turn.
	const history = OWNER_HISTORY_EDITS.flatMap(({ blockId, edits }) =>
		Array.from({ length: edits }, (_, i) => ({ revision: i + 4, at: `2026-11-10T13:${String(i).padStart(2, "0")}:00.000Z`, cause: "edit", blockId }))
	);
	const since = manualEditsSince([{ revision: 3, at: "2026-11-10T12:59:00.000Z", cause: "apply" }, ...history], "2026-11-10T12:59:30.000Z");
	assert.deepEqual(since, OWNER_HISTORY_EDITS);
	assert.deepEqual(manualEditsSince(history, "2026-11-10T14:00:00.000Z"), []);
	// The run request carries them to the runtime (bounded, typed).
	const mapped = mapChatRunRequest({ modelId: MODEL, brief: "audit", mode: "ask", manualEdits: [...since, { blockId: 3 }, "x"] }, { allowUnlistedTrial: true });
	assert.equal(mapped.ok, true);
	if (mapped.ok) assert.deepEqual(mapped.request.manualEdits, OWNER_HISTORY_EDITS);
});

test("Ask turn: propose_plan is checked on the page; the answer carries the plan; the prompt has the page and manual edits", async () => {
	const page = ownerPage();
	const out = await withProvider(
		[
			{ calls: [{ name: "get_block", arguments: { id: "block.steps" } }] },
			{ calls: [{ name: "propose_plan", arguments: OWNER_ASK_PLAN }] },
			{ content: "**Rework**: nine variant swaps; logos keeps grid4 (no marquee variant)." }
		],
		async (requests) => {
			const turn = await runXaiCatalogTurn(
				"test-key",
				MODEL,
				{ brief: "rework blocks and content", mode: "ask", scenarioId: "landing", screenId: OWNER_SCREEN, expectedRevision: 3, currentPage: page, currentProvenance: provenance, manualEdits: OWNER_HISTORY_EDITS },
				AbortSignal.timeout(5000)
			);
			const prompt = JSON.parse(String((requests[0]!.messages as Array<{ content: string }>)[1]!.content));
			assert.deepEqual(prompt.currentPage.manualEdits, OWNER_HISTORY_EDITS);
			const logos = prompt.currentPage.blocks.find((row: { id: string }) => row.id === "block-logos");
			assert.equal(logos.block, "block.logos");
			assert.equal(logos.variant, "grid4");
			// Live run: the plan set the hero's title (section list name) when the visible heading is copy.headline.
			const hero = prompt.currentPage.blocks.find((row: { id: string }) => row.id === "block-hero");
			assert.ok(hero.copyKeys.includes("headline"));
			const tool = (requests[2]!.messages as Array<{ role: string; name?: string; content?: string }>).find((m) => m.role === "tool" && m.name === "propose_plan");
			const payload = JSON.parse(String(tool?.content));
			assert.equal(payload.valid.length, 10);
			assert.equal(payload.invalid[0].code, "unknown_variant");
			return turn;
		}
	);
	assert.equal(isAgentTextReply(out.proposal), true);
	if (!isAgentTextReply(out.proposal)) return;
	assert.equal(out.proposal.plan?.ops.length, 11);
	assert.equal("page" in out.proposal, false);
	assert.deepEqual(out.meta.toolsCalled, ["get_block", "propose_plan"]);
});

test("Ask answer that recommends page changes without propose_plan gets one forced plan step; the answer stays the reply", async () => {
	// Live staging run (ADR 0020): the non-reasoning model read every block and answered in text, naming block ids,
	// without calling propose_plan, so no plan card appeared.
	const page = ownerPage();
	const answer = "**Rework plan**\n- **nav** (`block-nav`): `inverse`.\n- **hero** (`block-hero`): `split`.";
	const plan = { summary: "Festive header and split hero", ops: OWNER_ASK_PLAN.ops.slice(0, 2) };
	const out = await withProvider(
		[
			{ calls: [{ name: "get_block", arguments: { id: "block.hero" } }] },
			{ content: answer },
			{ calls: [{ name: "propose_plan", arguments: plan }] },
			{ content: "must not be requested" }
		],
		async (requests) => {
			const turn = await runXaiCatalogTurn(
				"test-key",
				MODEL,
				{ brief: "rework the page", mode: "ask", scenarioId: "landing", screenId: OWNER_SCREEN, expectedRevision: 3, currentPage: page, currentProvenance: provenance },
				AbortSignal.timeout(5000)
			);
			assert.equal(requests.length, 3);
			assert.equal(requests[1]!.tool_choice, "auto");
			assert.deepEqual(requests[2]!.tool_choice, { type: "function", function: { name: "propose_plan" } });
			const follow = (requests[2]!.messages as Array<{ role: string; content?: string }>).at(-1)!;
			assert.equal(follow.role, "user");
			assert.match(String(follow.content), /Call propose_plan now/);
			return turn;
		}
	);
	assert.equal(isAgentTextReply(out.proposal), true);
	if (!isAgentTextReply(out.proposal)) return;
	assert.equal(out.proposal.text, answer);
	assert.equal(out.proposal.plan?.ops.length, 2);
	assert.ok(out.proposal.plan?.ops.every((op) => op.valid));
	assert.deepEqual(out.meta.toolsCalled, ["get_block", "propose_plan"]);
});

test("Ask answer that names no block of the page is not forced into a plan", async () => {
	const page = ownerPage();
	const out = await withProvider([{ content: "The hero catalog block has 8 variants: default, split, centered." }], async (requests) => {
		const turn = await runXaiCatalogTurn(
			"test-key",
			MODEL,
			{ brief: "what hero variants exist?", mode: "ask", scenarioId: "landing", screenId: OWNER_SCREEN, expectedRevision: 3, currentPage: page, currentProvenance: provenance },
			AbortSignal.timeout(5000)
		);
		assert.equal(requests.length, 1);
		return turn;
	});
	assert.equal(isAgentTextReply(out.proposal) && out.proposal.plan, undefined);
});

test("Build on the current page: propose_layout is turned to edit_page; 'Logo cloud' edits block-logos, not features", async () => {
	// The owner's page was in Russian: block titles are the page's own words, the catalog title is the block's name.
	const page = (editPage({ page: ownerPage(), provenance, patch: { ops: [{ op: "set", blockId: "block-logos", field: "title", value: "Partners" }] }, expectedRevision: 3, now: NOW }) as LayoutProposal).page;
	const out = await withProvider(
		[
			// What the owner's run did: re-assemble the page by kind with a features entry.
			{ calls: [{ name: "propose_layout", arguments: { brief: "Logo cloud", screenId: OWNER_SCREEN, locale: "en", demoData: false, blocks: [{ kind: "features", title: "Trusted by", edit: true }] } }] },
			{ calls: [{ name: "edit_page", arguments: { ops: [{ op: "set", blockId: "Logo cloud", field: "title", value: "Trusted by" }] } }] }
		],
		async (requests) => {
			const turn = await runXaiCatalogTurn(
				"test-key",
				MODEL,
				{ brief: "now the Logo cloud block", mode: "build", scenarioId: "landing", screenId: OWNER_SCREEN, expectedRevision: 3, currentPage: page, currentProvenance: provenance, liveTurn: true, manualEdits: [{ blockId: "block-features", edits: 10 }] },
				AbortSignal.timeout(5000)
			);
			const prompt = JSON.parse(String((requests[0]!.messages as Array<{ content: string }>)[1]!.content));
			assert.deepEqual(prompt.currentPage.manualEdits, [{ blockId: "block-features", edits: 10 }]);
			const logos = prompt.currentPage.blocks.find((row: { id: string }) => row.id === "block-logos");
			assert.equal(logos.catalogBlock, "block.logos");
			assert.equal(logos.blockTitle, "Logo cloud");
			const tool = (requests[1]!.messages as Array<{ role: string; name?: string; content?: string }>).find((m) => m.role === "tool" && m.name === "propose_layout");
			const reply = JSON.parse(String(tool?.content));
			assert.equal(reply.code, "use_edit_page");
			assert.ok(reply.blocks.some((row: { id: string; blockTitle?: string }) => row.id === "block-logos" && row.blockTitle === "Logo cloud"));
			return turn;
		}
	);
	assert.equal(out.proposal.ok, true);
	const proposal = out.proposal as LayoutProposal;
	const report = describePageChanges(page, proposal.page);
	assert.deepEqual(report.changed.map((row) => row.id), ["block-logos"]);
	assert.equal(proposal.page.layout.blocks.find((node) => node.id === "block-features")?.title, page.layout.blocks.find((node) => node.id === "block-features")?.title);
	assert.ok(proposal.warnings.every((warning) => !/author's request/.test(warning)));
});

test("demoData=false on a page without demo rows says nothing about demo data", () => {
	const page = ownerPage();
	const out = executeTool(
		{ name: "propose_layout", arguments: { brief: "x", screenId: OWNER_SCREEN, locale: "en", demoData: false, blocks: [{ kind: "cta", title: "Order now", edit: true }] } },
		{ currentPage: page, currentProvenance: provenance, expectedRevision: 3, liveTurn: true, mode: "build" }
	);
	assert.equal(out.ok, true, JSON.stringify(out));
	const warnings = (out.result as LayoutProposal).warnings;
	assert.ok(warnings.every((warning) => !/[Dd]emo/.test(warning)), warnings.join(" | "));
	assert.ok(warnings.some((warning) => /^Unchanged: /.test(warning)));
});

test("token cost of the accept step: the owner's model turn vs Apply in Build", () => {
	// Before: "accepted, do as you proposed" was a Build model turn that ignored the plan.
	assert.equal(OWNER_USAGE.accept.total, 10094);
	// After: Apply in Build is a program step (see the no-network test above): zero provider tokens.
	const page = ownerPage();
	const plan = checkPagePlan({ page, provenance, revision: 3, raw: OWNER_ASK_PLAN })!;
	const exec = executePagePlan({ page, provenance, plan, selected: [plan.ops[0]!.id], revision: 3, at: NOW });
	assert.equal(exec.plan.status, "executed");
});

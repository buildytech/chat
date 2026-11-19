import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { resolveScenario, runAgentLoop, compileScenario } from "../../packages/chat-agent/src/index.ts";
import { emptyPage } from "../../packages/builder-core/src/index.ts";
import { completionPhase } from "../../packages/chat-agent/src/agent/completion-phase.ts";
import { CURRENT_EXECUTION_POLICY } from "../../packages/chat-agent/src/agent/execution-policy.ts";
import { providerStep } from "@buildytech/provider-xai";
import { installBundleProbe, MODEL, signal } from "./agent-replay.ts";

let uninstall: () => void;
before(async () => { uninstall = await installBundleProbe(); });
after(() => uninstall?.());
const page = () => emptyPage({ title: "Birthday", now: "2026-11-17T11:35:19Z" });
function scenario() {
	const compiled = resolveScenario("build", MODEL);
	assert.ok(compiled.ok);
	if (!compiled.ok) throw new Error("Missing profile");
	return compiled.scenario;
}
const call = (id: string, name: string, args: unknown) => ({ ok: true as const, message: { role: "assistant" as const, calls: [{ id, name, argumentsJson: JSON.stringify(args) }] } });

test("birthday regression: eight reads then write_page, never a no-tools JSON answer", async () => {
	const choices: unknown[] = [];
	const out = await runAgentLoop(MODEL, { mode: "build", brief: "A birthday page", page: page(), expectedRevision: 0 }, signal(), async (request) => {
		choices.push(request.toolChoice);
		assert.equal(request.cacheKey, "birthday-replay");
		return choices.length <= 8 ? call(String(choices.length), choices.length <= 2 ? "list_blocks" : "get_block", choices.length <= 2 ? {} : { item: "hero-simple" }) : call("write", "write_page", { patch: [{ op: "replace", path: "/title", value: "Birthday ready" }] });
	}, "birthday-replay", { scenario: scenario() });
	assert.ok(out.result.ok && out.result.proposal);
	assert.equal(choices.length, 9);
	assert.ok(!choices.includes("none"));
	assert.equal(out.meta.runTrace?.stopReason, "proposal_accepted");
});

test("twelve blocks may read their schemas, write and repair inside one Build turn", async () => {
	let sent = 0;
	const out = await runAgentLoop(MODEL, { mode: "build", brief: "Twelve sections", page: page(), expectedRevision: 0 }, signal(), async () => {
		sent += 1;
		if (sent <= 12) return call(String(sent), "get_block", { item: sent % 2 ? "hero-simple" : "team-simple" });
		if (sent === 13) return call("invalid", "write_page", { patch: [{ op: "replace", path: "/missing", value: "invalid" }] });
		return call("fixed", "write_page", { patch: [{ op: "add", path: "/blocks", value: Array.from({ length: 12 }, (_, index) => ({ id: `section-${index}`, item: index % 2 ? "team-simple" : "hero-simple", variant: index % 2 ? "cols3" : "mediaEnd" })) }] });
	}, "twelve-blocks", { scenario: scenario() });
	assert.ok(out.result.ok && out.result.proposal, JSON.stringify(out.result));
	if (out.result.ok) assert.equal(out.result.proposal?.page.blocks.length, 12);
	assert.equal(out.meta.budget?.writeAttempts, 2);
	assert.equal(sent, 14);
});

test("endless reads are cut over to a reserved writer and never reported as completed", async () => {
	const choices: unknown[] = [];
	const out = await runAgentLoop(MODEL, { mode: "build", brief: "Create", page: page(), expectedRevision: 0 }, signal(), async (request) => {
		choices.push(request.toolChoice);
		return call(String(choices.length), "get_page", {});
	}, "reads-only", { scenario: scenario() });
	assert.equal(out.result.ok, false);
	if (!out.result.ok) assert.equal(out.result.code, "build_no_proposal");
	assert.ok(choices.some((choice) => typeof choice === "object"));
	assert.ok(!choices.includes("none"));
	assert.equal(out.meta.runTrace?.steps.at(-1)?.request.completionReason, "reserved_steps");
	assert.equal(out.meta.runTrace?.toolResults.at(-1)?.execution, "skipped");
});

test("completion reserves honor real requests, tool calls and remaining runtime", () => {
	const budget = scenario().budget;
	const reserve = CURRENT_EXECUTION_POLICY.buildCompletion;
	assert.equal(completionPhase(budget, { requests: 1, toolCalls: 1, writeAttempts: 0 }, 1, false, reserve, 10_000).reason, "reserved_time");
	assert.equal(completionPhase(budget, { requests: budget.maxRequests - reserve.reservedRequests, toolCalls: 1, writeAttempts: 0 }, 1, false, reserve).reason, "reserved_requests");
	assert.equal(completionPhase(budget, { requests: 1, toolCalls: budget.maxToolCalls - reserve.reservedToolCalls, writeAttempts: 0 }, 1, false, reserve).reason, "reserved_tools");
});

test("complex registered-profile drafts can exceed defaults without changing legacy limits", () => {
	const profile = scenario().profile;
	const larger = compileScenario({ ...profile, limits: { maxSteps: 40, maxRequests: 48, maxToolCalls: 96 } }, MODEL);
	assert.ok(larger.ok);
	if (larger.ok) assert.equal(larger.scenario.budget.maxSteps, 40);
	assert.equal(compileScenario({ ...profile, limits: { maxSteps: 65 } }, MODEL).ok, false);
	assert.equal(compileScenario({ ...profile, limits: { maxSteps: 4 } }, MODEL).ok, false);
});

test("one large read batch cannot consume the write tool reserve", async () => {
	const compiled = scenario();
	let sent = 0;
	const out = await runAgentLoop(MODEL, { mode: "build", brief: "Create", page: page(), expectedRevision: 0 }, signal(), async (request) => {
		sent += 1;
		if (sent === 1) return { ok: true, message: { role: "assistant", calls: Array.from({ length: compiled.budget.maxToolCalls + 2 }, (_, index) => ({ id: `read-${index}`, name: "get_page", argumentsJson: "{}" })) } };
		assert.deepEqual(request.toolChoice, { name: "write_page" });
		return call("write", "write_page", { patch: [{ op: "replace", path: "/title", value: "Ready" }] });
	}, "batch-read", { scenario: compiled });
	assert.ok(out.result.ok && out.result.proposal);
	assert.ok(out.meta.budget!.toolCalls < compiled.budget.maxToolCalls);
	assert.equal(out.meta.budget!.writeAttempts, 1);
});

test("Build never exposes a raw JSON document as a completed result", async () => {
	const json = JSON.stringify({ version: 2, blocks: [] });
	const out = await runAgentLoop(MODEL, { mode: "build", brief: "Create", page: page(), expectedRevision: 0 }, signal(), async () => ({ ok: true, message: { role: "assistant", text: json } }), "printed-json", { scenario: scenario() });
	assert.equal(out.result.ok, false);
	if (!out.result.ok) { assert.equal(out.result.code, "build_no_proposal"); assert.ok(!out.result.message.includes(json)); }
});

test("xAI receives the stable cache routing key; trace metadata reports only whether it was sent", async () => {
	const original = globalThis.fetch;
	globalThis.fetch = async (_url, init) => {
		assert.equal(new Headers(init?.headers).get("x-grok-conv-id"), "stable-run");
		return new Response(JSON.stringify({ model: MODEL, choices: [{ message: { role: "assistant", content: "Done" } }] }));
	};
	try {
		const response = await providerStep({ apiKey: "test-key", baseUrl: "https://example.invalid", modelId: MODEL, signal: signal(), messages: [], tools: [], toolChoice: "none", maxTokens: 32, cacheKey: "stable-run" });
		assert.equal(response.requestInfo?.promptCacheKeySent, true);
		assert.ok(!JSON.stringify(response.requestInfo).includes("stable-run"));
	} finally { globalThis.fetch = original; }
});

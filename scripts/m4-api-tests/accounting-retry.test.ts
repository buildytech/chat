import assert from "node:assert/strict";
import { test } from "node:test";
import { readProviderUsage, aggregateStepUsage, aggregateSessionUsage, billedCostForDisplay, unknownUsage, resolveScenario, compileScenario, runAgentLoop } from "../../packages/chat-agent/src/index.ts";
import { createExecution } from "../../packages/chat-agent/src/agent/execution.ts";
import { CURRENT_EXECUTION_POLICY, retryDelay } from "../../packages/chat-agent/src/agent/execution-policy.ts";
import { retryAfterMs, classifyProviderFailure } from "../../packages/provider-xai/src/errors.ts";
import { providerStep } from "@buildytech/provider-xai";
import { MODEL, signal } from "./agent-replay.ts";
import { emptyPage } from "../../packages/builder-core/src/index.ts";

const input = { messages: [], tools: [], toolChoice: "auto" as const };
const usage = (ticks: unknown) => readProviderUsage({ prompt_tokens: 1, completion_tokens: 1, cost_in_usd_ticks: ticks });

test("billed ticks are exact, zero is real, missing and unsafe values stay unknown", () => {
	const sum = aggregateStepUsage([usage("9007199254740993"), usage(0), usage("7")]);
	assert.equal(sum.cost.available, true);
	if (!sum.cost.available || sum.cost.kind !== "billed") return;
	assert.equal(sum.cost.ticks, "9007199254741000");
	assert.equal(sum.cost.usd, "900719.9254741000");
	assert.equal(sum.cost.completeness, "complete");
	for (const ticks of [undefined, -1, 0.1, Number.MAX_SAFE_INTEGER + 1, "-1", "1.2", "1e3"]) assert.equal(aggregateStepUsage([usage(ticks)]).cost.available, false);
	const zero = aggregateStepUsage([usage(0)]);
	assert.ok(zero.cost.available && zero.cost.kind === "billed" && zero.cost.ticks === "0");
});

test("reported steps and actual requests differ; partial cost remains a known subtotal", () => {
	const run = aggregateStepUsage([usage("1")], { requests: 3 });
	assert.equal(run.steps, 3);
	assert.equal(run.reportedSteps, 1);
	assert.equal(run.status, "incomplete");
	assert.ok(run.cost.available && run.cost.kind === "billed" && run.cost.completeness === "partial");
	const session = aggregateSessionUsage([run, unknownUsage("cancelled", 0)]);
	assert.ok(session.cost.available && session.cost.kind === "billed" && session.cost.ticks === "1" && session.cost.completeness === "partial");
	const costOnly = aggregateStepUsage([readProviderUsage({ cost_in_usd_ticks: 0 })]);
	assert.equal(costOnly.status, "incomplete");
	assert.ok(costOnly.cost.available && costOnly.cost.kind === "billed" && costOnly.cost.completeness === "complete");
	assert.equal(billedCostForDisplay({ available: true, kind: "billed", currency: "USD", ticks: "bad", requests: 1, reportedRequests: 1 }).available, false);
});

test("retry policy honors Retry-After, deadline, status and the turn-wide ceiling", () => {
	const error = { status: 503, retryable: true, retryAfterMs: 1000 };
	assert.equal(retryDelay(error, 0, CURRENT_EXECUTION_POLICY, 5000), 1000);
	assert.equal(retryDelay(error, 1, CURRENT_EXECUTION_POLICY, 5000), null);
	assert.equal(retryDelay(error, 0, CURRENT_EXECUTION_POLICY, 500), null);
	assert.equal(retryDelay({ ...error, retryAfterMs: 3000 }, 0, CURRENT_EXECUTION_POLICY, 5000), null);
	for (const status of [400, 401, 403, 501, 505]) assert.equal(retryDelay({ status, retryable: true }, 0, CURRENT_EXECUTION_POLICY, 5000), null);
	assert.equal(retryAfterMs("1.25"), 1250);
	const now = Date.parse("2026-11-16T12:00:00Z");
	assert.equal(retryAfterMs("Mon, 16 Nov 2026 12:00:01 GMT", now), 1000);
	assert.equal(retryAfterMs("-1", 0), undefined);
	assert.equal(classifyProviderFailure(401, "unknown tool").code, "provider_unauthorized");
	assert.equal(classifyProviderFailure(403, "").retryable, false);
});

test("a transient retry is counted and billed once per actual attempt", async () => {
	let calls = 0;
	const execution = createExecution(MODEL, signal(), async () => ++calls % 2 === 1
		? { ok: false, error: { code: "provider_unavailable", message: "Temporary", status: 503, retryable: true }, usage: usage(0)! }
		: { ok: true, message: { role: "assistant", text: "Done" }, usage: usage("123")! }, "retry", {});
	assert.equal((await execution.request(input)).ok, true);
	const meta = execution.finish();
	assert.equal(calls, 2);
	assert.equal(meta.steps, 2);
	assert.equal(meta.usage.steps, 2);
	assert.equal(meta.providerRetries, 1);
	assert.ok(meta.usage.cost.available && meta.usage.cost.kind === "billed" && meta.usage.cost.ticks === "123");
	assert.equal((await execution.request(input)).ok, false);
	assert.equal(calls, 3);
	assert.equal(execution.finish().providerRetries, 1);
});

test("cancellation during backoff sends no retry; exceptions are never retried", async () => {
	const controller = new AbortController();
	let calls = 0;
	const execution = createExecution(MODEL, controller.signal, async () => {
		calls += 1;
		setTimeout(() => controller.abort(), 5);
		return { ok: false, error: { code: "rate_limited", message: "Wait", status: 429, retryable: true } };
	}, "cancel", {});
	const result = await execution.request(input);
	assert.equal(result.ok, false);
	assert.equal(calls, 1);
	assert.equal(execution.finish().providerRetries, 0);
	const thrown = createExecution(MODEL, signal(), async () => { throw new Error("network"); }, "network", {});
	await thrown.request(input);
	assert.equal(thrown.finish().steps, 1);
	assert.equal(thrown.finish().providerRetries, 0);
});

test("scenario ceilings stop retries and prevent a nudge after the last logical step", async () => {
	const registered = resolveScenario("build", MODEL);
	assert.ok(registered.ok);
	if (!registered.ok) return;
	const compiled = compileScenario({ ...registered.scenario.profile, limits: { maxSteps: 1, maxRequests: 1 } }, MODEL);
	assert.ok(compiled.ok);
	if (!compiled.ok) return;
	let requests = 0;
	let transcript: readonly import("../../packages/chat-agent/src/index.ts").AgentMessage[] = [];
	const turn = await runAgentLoop(MODEL, { brief: "Explain", mode: "build", page: emptyPage({ title: "Test", now: "2026-11-16T12:00:00Z" }), expectedRevision: 0 }, signal(), async (request) => { transcript = request.messages; requests += 1; return { ok: true, message: { role: "assistant", text: "No change" } }; }, "limit", { scenario: compiled.scenario });
	assert.equal(requests, 1);
	assert.equal(transcript.length, 2, "no unused nudge is appended after the scenario step ceiling");
	assert.equal(turn.meta.steps, 1);
	const execution = createExecution(MODEL, signal(), async () => ({ ok: false, error: { code: "rate_limited", message: "Wait", status: 429, retryable: true } }), "limit", { scenario: compiled.scenario });
	await execution.request(input);
	assert.equal(execution.finish().steps, 1);
	assert.equal(execution.finish().providerRetries, 0);
});

test("new defaults use max_completion_tokens while pinned v1 requests keep their wire contract", async () => {
	const original = globalThis.fetch;
	const bodies: Array<Record<string, unknown>> = [];
	globalThis.fetch = async (_url, init) => { bodies.push(JSON.parse(String(init?.body))); return new Response(JSON.stringify({ usage: { cost_in_usd_ticks: 0 } }), { status: 403 }); };
	try {
		for (const version of [1, 2]) {
			const result = await providerStep({ ...input, modelId: MODEL, maxTokens: 100, signal: signal(), apiKey: "not-a-key", baseUrl: "https://unused.invalid", provider: { id: "xai", version } });
			assert.equal(result.ok, false);
			if (!result.ok) { assert.equal(result.error.code, "provider_forbidden"); assert.equal(result.error.retryable, false); }
			assert.equal(result.usage?.costUsdTicks, "0");
		}
		assert.equal(bodies[0]!.max_tokens, 100);
		assert.equal(bodies[1]!.max_completion_tokens, 100);
		assert.equal("max_tokens" in bodies[1]!, false);
	} finally { globalThis.fetch = original; }
});


test("pinned v1 scenarios do not acquire the new transient retry policy", async () => {
	const compiled = resolveScenario("ask", MODEL, { id: "page.ask", version: 1 });
	assert.ok(compiled.ok);
	if (!compiled.ok) return;
	assert.equal(compiled.scenario.fingerprint, "scenario-v1-b12454f2685b37c7");
	const build = resolveScenario("build", MODEL, { id: "page.build", version: 1 });
	assert.ok(build.ok && build.scenario.fingerprint === "scenario-v1-0a0d696e52bbe223");
	const execution = createExecution(MODEL, signal(), async () => ({ ok: false, error: { code: "rate_limited", message: "Wait", status: 429, retryable: true } }), "legacy", { scenario: compiled.scenario });
	await execution.request(input);
	assert.equal(execution.finish().steps, 1);
	assert.equal(execution.finish().providerRetries, 0);
});


test("unexpected tool processing and diagnostic errors cannot erase earlier billed usage", async () => {
	const call = { id: "one", name: "get_page", argumentsJson: "{}" };
	Object.defineProperty(call, "argumentsJson", { get() { throw new Error("private tool failure"); } });
	const out = await runAgentLoop(MODEL, { mode: "ask", brief: "Explain", page: emptyPage({ title: "Test", now: "2026-11-16T12:00:00Z" }), expectedRevision: 0 }, signal(), async () => ({ ok: true, usage: usage("123")!, message: { role: "assistant", calls: [call] } }), "tool-failure", { onProviderError: () => { throw new Error("observer failed"); } });
	assert.equal(out.result.ok, false);
	assert.equal(out.meta.runId, "tool-failure");
	assert.equal(out.meta.steps, 1);
	assert.equal(out.meta.usage.steps, 1);
	assert.ok(out.meta.usage.cost.available && out.meta.usage.cost.kind === "billed" && out.meta.usage.cost.ticks === "123");
	assert.doesNotMatch(JSON.stringify(out), /private tool failure|observer failed/);
});

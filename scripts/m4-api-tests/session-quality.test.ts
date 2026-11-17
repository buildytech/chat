import assert from "node:assert/strict";
import { test } from "node:test";
import { startAttempt, endAttempt, usageOfAttempts, readRunAttempts, aggregateStepUsage, readProviderUsage } from "../../packages/chat-agent/src/index.ts";
import { viewOf, projectOfView } from "../../apps/chat-web/src/modules/chat/core/view.ts";
import { runXaiTurn } from "../../apps/chat-web/src/modules/chat/browser/xai-client.ts";
import { emptyPage } from "../../packages/builder-core/src/index.ts";
import { catalogEvidence } from "../../packages/chat-agent/src/agent/catalog-tools.ts";
import { MODEL } from "./agent-replay.ts";
import { createExecution } from "../../packages/chat-agent/src/agent/execution.ts";

const now = "2026-11-17T10:00:00Z";
test("wire metadata is observed from the adapter and missing fields remain unknown", async () => {
	const execute = createExecution("other/model", new AbortController().signal, async () => ({ ok: true, message: { role: "assistant", text: "Answer" }, requestInfo: { parallelToolCalls: true, completionTokenParameter: "output_limit", maxTokens: 33 }, response: { status: 201, finishReason: "finished" } }), "generic", {});
	await execute.request({ messages: [], tools: [], toolChoice: "none" });
	const step = execute.finish().runTrace!.steps[0]!;
	assert.equal(step.request.parallelToolCalls, true);
	assert.equal(step.request.completionTokenParameter, "output_limit");
	assert.equal(step.request.maxTokens, 33);
	assert.equal(step.response?.status, 201);
	assert.equal(step.usage?.cost_in_usd_ticks, "unknown");
	const fixture = JSON.parse(JSON.stringify(execute.finish().runTrace));
	assert.equal(fixture.steps[0].response.content.body, "Answer");
});
test("attempt accounting includes unanswered failures and never double counts linked replies", () => {
	const first = endAttempt(startAttempt("a", "u1", "another-provider/model", now), "aborted", now);
	const usage = aggregateStepUsage([readProviderUsage({ prompt_tokens: 2, completion_tokens: 1, cost_in_usd_ticks: 10 })], { providerId: "another-provider" });
	const second = endAttempt(startAttempt("b", "u2", MODEL, now), "completed", now, { assistantMessageId: "reply", usage, runId: "server-run" });
	const sum = usageOfAttempts({ a: first, b: second }, [{ id: "reply", run: { usage } }]);
	assert.equal(sum.runs, 2);
	assert.equal(sum.incompleteRuns, 1);
	assert.equal(sum.promptTokens, "unknown");
	assert.ok(sum.cost.available && sum.cost.kind === "billed" && sum.cost.ticks === "10" && sum.cost.completeness === "partial");
	assert.equal(usage.providerId, "another-provider");
	assert.equal(endAttempt(first, "superseded", now, { usage }).usage.status, "incomplete");
	assert.equal(endAttempt(startAttempt("c", "u3", MODEL, now), "interrupted", now).traceState, "not_received");
	assert.equal(readRunAttempts({ a: first })?.a?.status, "aborted");
	assert.equal(readRunAttempts({ a: { ...first, format: "future/2" } }), null);
	assert.equal(readRunAttempts({ a: { ...first, usage: null } }), null);
});

test("project view roundtrip preserves attempt and trace extensions and unknown host data", () => {
	const runAttempts = { a: endAttempt(startAttempt("a", "u", MODEL, now), "error", now) };
	const project = projectOfView({ id: "session-a", title: "Test", updatedAt: now, messages: [], runAttempts }, null);
	project.ext.other = { opaque: true };
	const view = viewOf(project);
	assert.deepEqual(view.runAttempts, runAttempts);
	assert.deepEqual(projectOfView(view, project).ext, project.ext);
	assert.equal("runAttempts" in project, false);
});

test("browser sends registered scenario references and retains runtime traces for Ask and Build", async () => {
	const original = globalThis.fetch;
	try {
		for (const mode of ["ask", "build"] as const) {
			const scenario = { id: mode === "ask" ? "page.discuss" : "page.build", version: mode === "ask" ? 1 : 2 };
			globalThis.fetch = async (_input, init) => {
				const request = JSON.parse(String(init?.body));
				assert.deepEqual(request.scenario, scenario);
				return new Response(JSON.stringify({ ok: true, mode, reply: "text", text: "Done", blocks: [], runId: "observed", runTrace: { format: "run-trace/1", runId: "observed", steps: [] } }));
			};
			const out = await runXaiTurn({ mode, modelId: MODEL, brief: "Test", expectedRevision: 0, currentPage: emptyPage({ title: "Test", now }), scenario });
			assert.equal(out.runTrace?.runId, "observed");
		}
	} finally { globalThis.fetch = original; }
});

test("hash-only search evidence retains observed ids, zero scores, matches and registry items", () => {
	const evidence = catalogEvidence("search_catalog", { total: 1, items: [{ screenId: "screen/from-catalog", score: 0, matched: ["observed"], via: "exact", sections: [{ item: "registry-item", variant: "variant" }] }] });
	assert.deepEqual(evidence?.items?.[0], { screenId: "screen/from-catalog", score: 0, matched: ["observed"], via: "exact", sections: [{ item: "registry-item", variant: "variant" }] });
});

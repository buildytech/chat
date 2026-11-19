import { emptyPage } from "../../packages/builder-core/src/index.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenario, runAgentLoop } from "../../packages/chat-agent/src/index.ts";
import { projectTraceBodies } from "../../apps/chat-web/src/lib/browser/trace-export.ts";
import { MODEL, signal } from "./agent-replay.ts";

test("Ask is read-only: it refuses unsolicited writes and records the entire read-only chain", async () => {
	const compiled = resolveScenario("ask", MODEL);
	assert.ok(compiled.ok);
	if (!compiled.ok) return;
	assert.equal(compiled.scenario.profile.id, "page.ask");
	assert.ok(!compiled.scenario.tools.some((tool) => tool.name === "write_page"));
	let requests = 0;
	const out = await runAgentLoop(MODEL, { mode: "ask", brief: "Discuss", expectedRevision: 0, page: emptyPage({ title: "Test", now: "2026-11-16T12:00:00Z" }) }, signal(), async () => {
		requests += 1;
		return { ok: true, message: requests === 1 ? { role: "assistant", calls: [{ id: "bad-write", name: "write_page", argumentsJson: "{}" }] } : { role: "assistant", text: "Recommendation only" } };
	}, "discussion-test", { scenario: compiled.scenario });
	assert.ok(out.result.ok && !out.result.proposal);
	const trace = out.meta.runTrace!;
	assert.equal(trace.steps.length, 2);
	assert.equal(trace.toolResults[0]?.ok, false);
	assert.equal(trace.toolResults[0]?.accepted, false);
	assert.equal(trace.stopReason, "answer");
	const projected = projectTraceBodies({ ext: { "agent-trace": { [trace.runId]: trace } } });
	assert.ok(!JSON.stringify(projected).includes('"body":'));
	assert.ok(JSON.stringify(projectTraceBodies(trace, true)).includes('"body":'));
	assert.ok(JSON.stringify(trace).includes('"body":'));
	assert.equal(JSON.stringify(trace.steps).includes('"cost_in_usd_ticks":"unknown"'), true);
});

test("three different rejected writes remain three visible gate events", async () => {
 const compiled = resolveScenario("build", MODEL);
 assert.ok(compiled.ok); if (!compiled.ok) return;
 let sent = 0;
 const out = await runAgentLoop(MODEL, { mode: "build", brief: "Change", expectedRevision: 0, page: emptyPage({ title: "Test", now: "2026-11-16T12:00:00Z" }) }, signal(), async () => {
  sent += 1;
  return { ok: true, message: sent <= 3 ? { role: "assistant", calls: [{ id: "write-" + sent, name: "write_page", argumentsJson: JSON.stringify({ patch: [{ op: "replace", path: "/invalid" + sent, value: sent }] }) }] } : { role: "assistant", text: "Could not change" } };
 }, "three-writes", { scenario: compiled.scenario });
 const trace = out.meta.runTrace!;
 assert.equal(trace.toolResults.length, 3);
 assert.equal(trace.steps.length, 5, "three writes, the text answer, the one Build nudge");
 for (const result of trace.toolResults) { assert.equal(result.accepted, false); assert.ok(result.gate); }
 const stripped = projectTraceBodies(trace);
 assert.equal(stripped.toolResults.length, 3);
 assert.equal(stripped.stopReason, "write_invalid");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { createExecution } from "../../packages/chat-agent/src/agent/execution.ts";
import { runAgentLoop } from "../../packages/chat-agent/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { withProvider, MODEL, signal } from "./agent-replay.ts";
import { emptyPage } from "../../packages/builder-core/src/index.ts";

const input = { messages: [], tools: [], toolChoice: "auto" as const };
const reported = { promptTokens: 10, completionTokens: 3, totalTokens: 13 };

test("a later provider exception preserves reported tokens, run identity and actual requests", async () => {
	let calls = 0;
	const execution = createExecution("fixture", new AbortController().signal, async (request) => {
		if (++calls === 2) throw new Error("private upstream body");
		return { ok: true, usage: reported, message: { role: "assistant", text: "Read" } };
	}, "stable-id", {});
	await execution.request(input);
	const failure = await execution.request(input);
	assert.equal(failure.ok, false);
	if (failure.ok) return;
	assert.equal(failure.result.code, "provider_failed");
	assert.equal(failure.meta.runId, "stable-id");
	assert.equal(failure.meta.steps, 2);
	assert.equal(failure.meta.usage.totalTokens, 13);
	assert.equal(failure.meta.usage.incompleteReason, "error");
	assert.doesNotMatch(JSON.stringify(failure), /private upstream/);
});

for (const timeout of [false, true]) test(`${timeout ? "timeout" : "cancel"} during a request keeps partial usage and blocks further requests`, async () => {
	const controller = new AbortController();
	let calls = 0;
	const execution = createExecution("fixture", controller.signal, async (request) => {
		if (++calls === 2) {
			controller.abort(new DOMException("private reason", timeout ? "TimeoutError" : "AbortError"));
			throw controller.signal.reason;
		}
		return { ok: true, usage: reported, message: { role: "assistant", text: "Read" } };
	}, "stable-id", {});
	await execution.request(input);
	const failure = await execution.request(input);
	assert.equal(failure.ok, false);
	if (failure.ok) return;
	assert.equal(failure.result.code, timeout ? "runtime_timeout" : "aborted");
	assert.equal(failure.meta.usage.incompleteReason, timeout ? "timeout" : "cancelled");
	assert.equal(failure.meta.usage.totalTokens, 13);
	assert.equal(failure.meta.steps, 2);
	await execution.request(input);
	assert.equal(calls, 2);
});

test("deadline is checked again before named fallback and the final no-tools request", async () => {
	const realNow = Date.now;
	let now = realNow();
	let calls = 0;
	Date.now = () => now;
	try {
		const execution = createExecution("fixture", new AbortController().signal, async (request) => {
			calls += 1;
			return { ok: true, usage: reported, message: { role: "assistant", text: "Read" } };
		}, "stable-id", { deadline: now + 100 });
		await execution.request(input);
		now += 101;
		for (const toolChoice of [{ name: "write_page" } as const, "required" as const, "none" as const]) {
			const result = await execution.request({ ...input, toolChoice });
			assert.equal(result.ok, false);
			if (!result.ok) assert.equal(result.result.code, "runtime_timeout");
		}
		assert.equal(calls, 1);
		assert.equal(execution.finish().usage.totalTokens, 13);
		assert.equal(execution.finish().usage.incompleteReason, "timeout");
	} finally { Date.now = realNow; }
});

test("an aborted response cannot execute its write, even when the provider resolves normally", async () => {
	const controller = new AbortController();
	const page = emptyPage({ title: "Before", now: "2026-11-16T12:00:00Z" });
	const out = await runAgentLoop("fixture", { brief: "Rename", mode: "build", page, expectedRevision: 0 }, controller.signal, async (request) => {
		controller.abort();
		return { ok: true, usage: reported, message: { role: "assistant", calls: [{ id: "write", name: "write_page", argumentsJson: JSON.stringify({ patch: [{ op: "replace", path: "/title", value: "After" }] }) }] } };
	}, "stable-id");
	assert.equal(out.result.ok, false);
	assert.equal(out.meta.budget?.writeAttempts, 0);
	assert.equal(out.meta.usage.totalTokens, 13);
	assert.equal(out.meta.usage.incompleteReason, "cancelled");
	assert.equal(page.title, "Before");
});


test("xAI runtime keeps earlier usage and tool trace after a fetch exception and redacts the secret", async () => {
	await withProvider([{ calls: [{ name: "get_page", arguments: {} }] }], async () => {
		const original = globalThis.fetch;
		const originalError = console.error;
		const logs: string[] = [];
		let calls = 0;
		console.error = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
		globalThis.fetch = async (input, init) => {
			if (++calls === 2) throw new Error("Bearer canary-private-key");
			return original(input, init);
		};
		try {
			const out = await runXaiCatalogTurn("canary-private-key", MODEL, { brief: "Explain", mode: "ask", page: emptyPage({ title: "Before", now: "2026-11-16T12:00:00Z" }), expectedRevision: 0 }, signal());
			assert.equal(out.result.ok, false);
			if (!out.result.ok) assert.equal(out.result.code, "xai_chat_failed");
			assert.equal(out.meta.steps, 2);
			assert.deepEqual(out.meta.toolsCalled, ["get_page"]);
			assert.equal(out.meta.usage.totalTokens, 1100);
			assert.equal(out.meta.usage.incompleteReason, "error");
			assert.doesNotMatch(JSON.stringify({ out, logs }), /canary-private-key/);
		} finally { globalThis.fetch = original; console.error = originalError; }
	});
});

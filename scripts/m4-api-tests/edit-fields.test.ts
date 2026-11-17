import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { resolveScenario, runAgentLoop } from "../../packages/chat-agent/src/index.ts";
import { emptyPage, writePage } from "../../packages/builder-core/src/index.ts";
import { installBundleProbe, MODEL, signal } from "./agent-replay.ts";

let uninstall: () => void;
before(async () => { uninstall = await installBundleProbe(); });
after(() => uninstall?.());
function base() {
	const result = writePage(emptyPage({ title: "Private page metadata", now: "2026-11-17T12:00:00Z" }), { patch: [{ op: "add", path: "/blocks", value: [{ id: "selected", item: "hero-classic", variant: "centered" }, { id: "other", item: "hero-classic", variant: "centered", props: { title: "UNRELATED_SENTINEL" } }] }] });
	assert.ok(result.ok); if (!result.ok) throw new Error("Fixture failed"); return result.page;
}
function scenario() { const result = resolveScenario("build", MODEL, { id: "page.edit-fields", version: 1 }); assert.ok(result.ok); if (!result.ok) throw new Error("Missing profile"); return result.scenario; }
const reply = (args: unknown) => ({ ok: true as const, message: { role: "assistant" as const, calls: [{ id: "write", name: "write_page", argumentsJson: JSON.stringify(args) }] } });

test("field edit sees one object, repairs its candidate without transcript growth and preserves other blocks", async () => {
	const page = base();
	let count = 0;
	const out = await runAgentLoop(MODEL, { mode: "build", brief: "Rewrite heading", page, expectedRevision: 7, scopeBlockIds: ["selected"], conversation: [{ role: "user", text: "OLD_HISTORY_SENTINEL" }] }, signal(), async (request) => {
		count += 1;
		assert.equal(request.messages.length, 2);
		assert.deepEqual(request.tools.map((tool) => tool.name), ["write_page"]);
		assert.ok(!JSON.stringify(request.messages).includes("UNRELATED_SENTINEL"));
		assert.ok(!JSON.stringify(request.messages).includes("OLD_HISTORY_SENTINEL"));
		assert.ok(!JSON.stringify(request.messages).includes("Private page metadata"));
		const context = JSON.parse(request.messages[1]!.text!);
		if (count === 2) { assert.deepEqual(context.object.title, { invalid: true }); assert.ok(context.errors.length); }
		return reply({ patch: [{ op: "replace", path: context.path, value: { ...context.object, title: count === 1 ? { invalid: true } : "Edited title" } }] });
	}, "fields", { scenario: scenario() });
	assert.ok(out.result.ok && out.result.proposal, JSON.stringify(out.result));
	assert.equal(count, 2);
	if (out.result.ok) { assert.deepEqual(out.result.proposal!.page.blocks[1], page.blocks[1]); assert.equal(out.result.proposal!.baseRevision, 7); }
	assert.equal(out.meta.runTrace!.steps[1]!.request.transcriptChange, "replace");
	assert.equal(out.meta.runTrace!.steps[1]!.request.retainedMessages, 1);
	assert.equal(out.meta.runTrace!.steps[1]!.request.messagesAdded.length, 1);
});

test("field edit cannot replace the page or write another block", async () => {
	for (const args of [{ page: base() }, { patch: [{ op: "replace", path: "/blocks/1/props", value: { title: "Wrong" } }] }]) {
		const out = await runAgentLoop(MODEL, { mode: "build", brief: "Edit", page: base(), expectedRevision: 1, scopeBlockIds: ["selected"] }, signal(), async () => reply(args), "forbidden", { scenario: scenario() });
		assert.equal(out.result.ok, false);
		assert.equal(out.meta.budget!.writeAttempts, 0);
	}
});

test("field edit fails before a provider call when no single block is selected", async () => {
	let calls = 0;
	const out = await runAgentLoop(MODEL, { mode: "build", brief: "Edit", page: base(), expectedRevision: 1 }, signal(), async () => { calls += 1; return reply({}); }, "missing-scope", { scenario: scenario() });
	assert.equal(out.result.ok, false);
	assert.equal(calls, 0);
});

/**
 * ADR 0034 acceptance replay on the simple line (ADR 0059), the model's tool calls scripted. Ask reads only; Build writes the
 * page through write_page and makes one proposal; every failure is a list of { path, code, expected, got }.
 *  (a) Ask "which layout would you use": a text answer from the catalog reads; a write_page call is refused, the page is untouched.
 *  (b) Build "fill the page with fictional content", nothing selected: one write_page over both blocks within 3 requests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { allItems, checkPageDoc, effectiveProps, emptyPage, itemInfo, sampleProps, writePage } from "../../packages/builder-core/src/index.ts";
import { runAgentLoop, type AgentReply } from "../../packages/chat-agent/src/index.ts";
import { validateItemProps } from "../../packages/builder-core/src/catalog/validator.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { MODEL, signal, toolNames, withProvider, type Scripted } from "./agent-replay.ts";
import { studioPage } from "./studio-page.ts";

const fill = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/studio-fill.json", import.meta.url)), "utf8")) as { title: string; locale: string; seo: { title: string; description: string }; blocks: Array<{ item: string; props: Record<string, unknown> }> };
const NOW = "2026-11-19T12:00:00.000Z";
const base = (): PageV2 => studioPage({ now: NOW });

const PLACEHOLDERS = /"(?:Hero Simple|Team Simple|Title 1|Title 2)"/;

test("(a) Ask: reads the catalog and answers in text; a write_page call is refused; the page is untouched", async () => {
	const page = base();
	const before = JSON.stringify(page);
	const script: Scripted[] = [
		{ calls: [{ name: "list_blocks", arguments: {} }, { name: "get_block", arguments: { item: "team-simple" } }] },
		{ calls: [{ name: "write_page", arguments: { patch: [{ op: "replace", path: "/title", value: "Sneaky" }] } }] },
		{ content: "I would use `cards3`: three people on cards read as a small studio." }
	];
	const { result, seen } = await withProvider(script, async (seen) => ({
		result: await runXaiCatalogTurn("k", MODEL, { brief: "Which team layout would you use?", mode: "ask", page, expectedRevision: 3 }, signal()),
		seen
	}));
	assert.equal(JSON.stringify(page), before, "Ask does not touch the page");
	assert.deepEqual(toolNames(seen.requests[0]!).sort(), ["get_block", "get_page", "list_blocks"]);
	const refused = seen.toolMessages.find((message) => message.name === "write_page");
	assert.ok(refused && refused.content.ok === false, JSON.stringify(seen.toolMessages));
	const reply = result.result as AgentReply;
	assert.ok(reply.ok, JSON.stringify(result.result));
	assert.equal(reply.proposal, undefined, "Ask makes no proposal");
	assert.match(reply.text, /cards3/);
});

test("(b) Build: fill the page with fictional content, nothing selected: one write_page over both blocks in 2 requests", async () => {
	const page = base();
	const next = JSON.parse(JSON.stringify(page)) as PageV2;
	next.title = fill.title;
	next.locale = "ru";
	next.seo = fill.seo;
	next.blocks.forEach((block, index) => (block.props = { ...block.props, ...fill.blocks[index]!.props }));
	const script: Scripted[] = [
		{ content: "Writing the page.", calls: [{ name: "write_page", arguments: { page: next } }] },
		{ content: "Done: both blocks have content, the locale is ru." }
	];
	const { out, seen } = await withProvider(script, async (seen) => ({
		out: await runXaiCatalogTurn("k", MODEL, { brief: "Fill the page with fictional content for an interior studio", mode: "build", page, expectedRevision: 3 }, signal()),
		seen
	}));
	assert.ok(seen.requests.length <= 3, `${seen.requests.length} requests`);
	assert.equal(out.meta.toolsCalled.filter((name) => name === "write_page").length, 1);
	const reply = out.result as AgentReply;
	assert.ok(reply.ok && reply.proposal, JSON.stringify(out.result));
	const written = reply.proposal!.page;
	assert.equal(written.locale, "ru");
	assert.equal(written.title, fill.title);
	assert.equal(reply.proposal!.baseRevision, 3);
	assert.deepEqual(reply.proposal!.diff.filter((entry) => entry.scope === "block").map((entry) => entry.id), page.blocks.map((b) => b.id), "both blocks changed");
	const team = written.blocks.find((b) => b.item === "team-simple")!;
	assert.equal((team.props as { members: unknown[] }).members.length, 3);
	assert.ok(!PLACEHOLDERS.test(JSON.stringify(written)), JSON.stringify(written).match(PLACEHOLDERS)?.[0]);
	assert.ok(checkPageDoc(written).ok);
	// Apply: the same gate accepts the proposal page in one step.
	const applied = writePage(page, { page: written }, { now: NOW });
	assert.ok(applied.ok, JSON.stringify(applied));
	assert.deepEqual(applied.diff, reply.proposal!.diff);
	assert.equal(out.meta.usage.totalTokens, 1100 * seen.requests.length);
});

test("scope: with selected blocks only those change; a write outside them is rejected with paths", async () => {
	const page = base();
	const bad = [{ op: "replace", path: "/title", value: "Other" }];
	const good = [{ op: "replace", path: "/blocks/0/props/title", value: "Calm rooms" }];
	const { out, seen } = await withProvider(
		[
			{ calls: [{ name: "write_page", arguments: { patch: bad } }] },
			{ calls: [{ name: "write_page", arguments: { patch: good } }] },
			{ content: "Changed the hero title." }
		],
		async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "Rename the hero", mode: "build", page, expectedRevision: 3, scopeBlockIds: ["block-hero-simple"] }, signal()), seen })
	);
	assert.equal(seen.requests.length, 2);
	const first = (seen.toolMessages[0]!.content as { issues: Array<{ code: string; path: string }> }).issues;
	assert.equal(first[0]!.code, "outside_scope");
	const reply = out.result as AgentReply;
	assert.ok(reply.ok && reply.proposal, JSON.stringify(out.result));
	assert.deepEqual(reply.proposal!.diff.map((entry) => [entry.change, entry.id, entry.paths]), [["changed", "block-hero-simple", ["/props/title"]]]);
});

test("a rejected write comes back as { path, code, expected, got }; the model fixes it and the turn proposes", async () => {
	const page = base();
	const { out, seen } = await withProvider(
		[
			{ calls: [{ name: "write_page", arguments: { patch: [{ op: "add", path: "/blocks/0/props/padding", value: "neon" }] } }] },
			{ calls: [{ name: "write_page", arguments: { patch: [{ op: "add", path: "/blocks/0/props/padding", value: "spacious" }] } }] },
			{ content: "More air around the hero." }
		],
		async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "More air around the hero", mode: "build", page, expectedRevision: 3 }, signal()), seen })
	);
	assert.equal(seen.requests.length, 2);
	const issues = (seen.toolMessages[0]!.content as { issues: Array<{ path: string; code: string; expected: string; got: unknown }> }).issues;
	assert.equal(issues[0]!.path, "/blocks/0/props/padding");
	assert.equal(issues[0]!.code, "props_invalid");
	assert.match(issues[0]!.expected, /compact/);
	assert.match(issues[0]!.expected, /spacious/);
	assert.equal(issues[0]!.got, "neon");
	assert.ok((out.result as AgentReply).proposal);
});

test("loop guard: the same error list twice ends the turn, nothing is written", async () => {
	const bad = { patch: [{ op: "add", path: "/blocks/0/props/padding", value: "neon" }] };
	const { out, seen } = await withProvider([{ calls: [{ name: "write_page", arguments: bad }] }], async (seen) => ({
		out: await runXaiCatalogTurn("k", MODEL, { brief: "More air", mode: "build", page: base(), expectedRevision: 3 }, signal()),
		seen
	}));
	assert.equal(seen.requests.length, 2);
	assert.ok(!out.result.ok);
	if (!out.result.ok) {
		assert.equal(out.result.code, "write_stuck");
		assert.equal(out.result.issues![0]!.path, "/blocks/0/props/padding");
	}
});

test("loop guard: a different rejected value at the same path is a new attempt, not a repeat", async () => {
	const attempt = (value: string) => ({ patch: [{ op: "add", path: "/blocks/0/props/padding", value }] });
	const { out, seen } = await withProvider(
		[{ calls: [{ name: "write_page", arguments: attempt("neon") }] }, { calls: [{ name: "write_page", arguments: attempt("pink") }] }, { calls: [{ name: "write_page", arguments: attempt("compact") }] }, { content: "Compact hero." }],
		async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "Tighter hero", mode: "build", page: base(), expectedRevision: 3 }, signal()), seen })
	);
	assert.equal(seen.requests.length, 3);
	assert.ok(out.result.ok, JSON.stringify(out.result));
});

test("every item variant starts from sample props that pass the registry props schema (no invented copy)", () => {
	let checked = 0;
	for (const item of allItems()) {
		for (const variant of itemInfo(item)!.variants) {
			const props = sampleProps(item, variant, `block-${item}`);
			const issues = validateItemProps(item, effectiveProps(item, variant, props));
			assert.deepEqual(issues, [], `${item}/${variant}`);
			checked += 1;
		}
	}
	assert.equal(checked, 157);
});

test("shared loop accepts an injected transport without credentials or an xAI HTTP request", async () => {
	let requests = 0;
	const out = await runAgentLoop("fixture-model", { brief: "Explain", mode: "ask", page: emptyPage({ title: "Test", now: NOW }), expectedRevision: 0 }, signal(), async (input) => {
		requests += 1;
		assert.equal(input.toolChoice, "auto");
		assert.equal("apiKey" in input, false);
		assert.equal("trace" in input, false);
		assert.equal("stepUsage" in input, false);
		assert.equal("baseUrl" in input, false);
		return { ok: true, message: { role: "assistant", text: "Explanation" } };
	}, "injected-test");
	assert.equal(requests, 1);
	assert.equal(out.result.ok, true);
	assert.equal(out.meta.runId, "injected-test");
});


test("budget: final no-tools request is counted and its usage is included", async () => {
	const ctx = { brief: "Explain", mode: "ask" as const, page: emptyPage({ title: "Test", now: NOW }), expectedRevision: 0 };
	const out = await runAgentLoop("fixture", ctx, signal(), async (input) => {
		return { ok: true, usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, message: input.toolChoice === "none" ? { role: "assistant", text: "Finished" } : { role: "assistant", calls: [{ id: "read", name: "get_page", argumentsJson: "{}" }] } };
	}, "budget-test");
	assert.equal(out.meta.steps, 9);
	assert.deepEqual(out.meta.budget, { requests: 9, toolCalls: 8, writeAttempts: 0 });
	assert.equal(out.meta.usage.status, "complete");
	assert.equal(out.meta.usage.totalTokens, 18);
});

test("budget: a single response cannot execute unlimited reads", async () => {
	const out = await runAgentLoop("fixture", { brief: "Explain", mode: "ask", page: emptyPage({ title: "Test", now: NOW }), expectedRevision: 0 }, signal(), async () => ({ ok: true, message: { role: "assistant", calls: Array.from({ length: 40 }, (_, n) => ({ id: String(n), name: "get_page", argumentsJson: "{}" })) } }), "budget-test");
	assert.equal(out.result.ok, false);
	if (!out.result.ok) assert.equal(out.result.code, "tool_budget");
	assert.deepEqual(out.meta.budget, { requests: 1, toolCalls: 32, writeAttempts: 0 });
});

test("budget: only the first write of a response is attempted", async () => {
	const out = await runAgentLoop("fixture", { brief: "Rename", mode: "build", page: emptyPage({ title: "Test", now: NOW }), expectedRevision: 0 }, signal(), async () => ({ ok: true, message: { role: "assistant", calls: ["First", "Second"].map((title) => ({ id: title, name: "write_page", argumentsJson: JSON.stringify({ patch: [{ op: "replace", path: "/title", value: title }] }) })) } }), "budget-test");
	assert.ok(out.result.ok && out.result.proposal);
	if (out.result.ok) assert.equal(out.result.proposal?.page.title, "First");
	assert.deepEqual(out.meta.budget, { requests: 1, toolCalls: 2, writeAttempts: 1 });
});

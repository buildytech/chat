/**
 * Owner session 5c155d3 (Build, empty page): the model read the catalog (search_catalog, 8x get_block), then printed the whole
 * page document as a fenced JSON block in its text and never called write_page; usage complete, page empty. A Build turn that
 * ends with no accepted write_page cannot happen any more: every Build step asks for a tool call (tool_choice "required") and the
 * turn ends with the first accepted write (no extra model step). A step that still answers in text gets the one in-turn nudge and
 * the request after it forces write_page by name (fallback "required" if the model refuses it); Ask stays on "auto". A forced
 * write that fails validation, or a plain-text answer, leaves the page unchanged (no proposal, or the write_invalid failure the
 * client shows as the localized "page not changed" line).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { addScreen, emptyPage } from "../../packages/builder-core/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";
import { MODEL, installBundleProbe, signal, withProvider, type Scripted } from "./agent-replay.ts";

type Message = { role: string; text: string };
const session = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/shashlyk-printed-5c155d3.json", import.meta.url)), "utf8")) as {
	sessions: Array<{ ext: { chat: { mode: string; usage: { status: string }; messages: Message[] } } }>;
};
const chat = session.sessions[0]!.ext.chat;
const BRIEF = chat.messages[0]!.text;
const PRINTED = chat.messages[1]!.text;
/** The page document the model printed in its text. */
const printed = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(PRINTED)![1]!) as Record<string, unknown>;

let release: () => void;
before(async () => {
	release = await installBundleProbe();
});
after(() => release());

const blank = (): PageV2 => {
	const start = addScreen(emptyPage({ title: "x", locale: "ru", now: "2026-11-14T12:00:00.000Z" }), "screen.theme-marketing-landing/home");
	assert.ok(start.ok);
	return { ...start.page, blocks: [] };
};
const items = ["site-header", "hero-classic", "dish-showcase"];
const reads: Scripted[] = [
	{ calls: [{ name: "search_catalog", arguments: { query: "restaurant delivery landing" } }] },
	{ calls: items.map((item) => ({ name: "get_block", arguments: { item } })) },
	{ content: PRINTED }
];
const choiceOf = (request: Record<string, unknown>) => request.tool_choice;
const run = (script: Scripted[], mode: "build" | "ask" = "build") =>
	withProvider(script, async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode, page: blank(), expectedRevision: 1 }, signal()), seen }));

test("the session: a Build turn, complete usage, the page document printed in the text", () => {
	assert.equal(chat.mode, "build");
	assert.equal(chat.usage.status, "complete");
	assert.equal(printed.version, 2);
	assert.equal((printed.blocks as unknown[]).length, 8);
});

const NAMED = { type: "function", function: { name: "write_page" } };

test("replay: the printed document ends a turn; the nudge forces write_page by name, the call is accepted, the turn ends (no summary step)", async () => {
	const { out, seen } = await run([...reads, { calls: [{ name: "write_page", arguments: { page: printed } }] }, { content: "Never asked for." }]);
	assert.deepEqual(seen.requests.map(choiceOf), ["required", "required", "required", NAMED]);
	const nudge = (seen.requests[3]!.messages as Array<{ role: string; content: string }>).slice(-2);
	assert.equal(nudge[0]!.role, "assistant");
	assert.match(nudge[1]!.content, /no write_page was accepted/);
	assert.match(nudge[1]!.content, /do not print it/);
	assert.ok(out.result.ok, JSON.stringify(out.result));
	if (!out.result.ok) return;
	const proposal = out.result.proposal;
	assert.ok(proposal, "a proposal");
	assert.equal(proposal.page.blocks.length, 8);
	assert.equal(out.result.text, "", "the printed document is not the answer");
	assert.equal(out.meta.usage.status, "complete");
	assert.equal(out.meta.steps, 4);
});

test("a model that follows tool_choice (and prints the document beside the call): reads, then write_page; accepted write ends the turn on that step", async () => {
	const { out, seen } = await run([reads[0]!, reads[1]!, { content: PRINTED, calls: [{ name: "write_page", arguments: { page: printed } }] }, { content: "Never asked for." }]);
	assert.deepEqual(seen.requests.map(choiceOf), ["required", "required", "required"]);
	assert.ok(out.result.ok && out.result.proposal);
	if (out.result.ok) assert.equal(out.result.text, "", "text beside the write call is not an answer");
});

test("a plain-text answer after the forced request: no write, no proposal (the client shows the page-not-changed line)", async () => {
	const { out, seen } = await run([...reads, { content: "I will not change the page." }]);
	assert.deepEqual(seen.requests.map(choiceOf), ["required", "required", "required", NAMED]);
	assert.ok(out.result.ok);
	if (out.result.ok) assert.equal(out.result.proposal, undefined);
});

test("a write that fails validation: the turn fails with write_invalid and its code (shown as the localized line)", async () => {
	const bad = { page: { ...printed, version: 3 } };
	const { out } = await run([...reads, { calls: [{ name: "write_page", arguments: bad }] }, { content: "Sorry." }]);
	assert.equal(out.result.ok, false);
	if (!out.result.ok) {
		assert.equal(out.result.code, "write_invalid");
		assert.ok(out.result.issues?.length);
	}
});

test("a model that refuses the named function (HTTP 400) is asked again with tool_choice required", async () => {
	const original = globalThis.fetch;
	const choices: unknown[] = [];
	let call = 0;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (!url.includes("/chat/completions")) return new Response(JSON.stringify({ data: url.includes("/image-generation-models") ? [] : [{ id: MODEL }] }), { status: 200 });
		const body = JSON.parse(String(init?.body ?? "{}")) as { tool_choice: unknown };
		choices.push(body.tool_choice);
		call += 1;
		if (call === 1) return new Response(JSON.stringify({ model: MODEL, choices: [{ message: { role: "assistant", content: PRINTED } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200 });
		if (call === 2) return new Response("{}", { status: 400 });
		if (call === 3) {
			const tool_calls = [{ id: "c1", type: "function", function: { name: "write_page", arguments: JSON.stringify({ page: printed }) } }];
			return new Response(JSON.stringify({ model: MODEL, choices: [{ message: { role: "assistant", content: null, tool_calls } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200 });
		}
		return new Response(JSON.stringify({ model: MODEL, choices: [{ message: { role: "assistant", content: "Done." } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200 });
	}) as typeof fetch;
	try {
		const out = await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page: blank(), expectedRevision: 1 }, signal());
		assert.deepEqual(choices.slice(0, 3), ["required", NAMED, "required"]);
		assert.ok(out.result.ok && out.result.proposal);
	} finally {
		globalThis.fetch = original;
	}
});

test("Ask stays on auto: a text answer is not nudged without open problems", async () => {
	const { seen } = await run([{ content: "The page is empty." }], "ask");
	assert.equal(seen.requests.length, 1);
	assert.equal(choiceOf(seen.requests[0]!), "auto");
});

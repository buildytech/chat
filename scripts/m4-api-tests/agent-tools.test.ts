/**
 * The agent's tools and modes (ADR 0034, ADR 0059): one tool definition file; Ask reads only (no write tool at all); a Build turn
 * that only answers makes no proposal; the loop gives the model a final answer step; the runtime passes the mode through.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ALLOWED_TOOLS, allItems, emptyPage } from "../../packages/builder-core/src/index.ts";
import { AGENT_TOOLS_VERSION, agentToolChoice, agentOpenAiTools, agentToolNames, agentToolsDocument, contractFingerprint, executeCatalogTool, isAgentReply, mapChatRunRequest, readBlock, type AgentReply } from "../../packages/chat-agent/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { handleRuntimeFetch } from "../../apps/xai-runtime/src/http.ts";
import { chatModeOf, turnOutcome } from "../../apps/chat-web/src/modules/chat/core/modes.ts";
import { parseMarkdown, parseInline } from "../../apps/chat-web/src/modules/chat/core/markdown.ts";
import { MODEL, signal, toolNames, withProvider, type Scripted } from "./agent-replay.ts";

const BRIEF = "Just talk, do not change the page: which team layout would you use and why?";
const page = () => emptyPage({ title: "Coffee house", locale: "en", now: "2026-11-13T12:00:00.000Z" });

function hasVendorKeyword(node: unknown): boolean {
	if (Array.isArray(node)) return node.some(hasVendorKeyword);
	if (!node || typeof node !== "object") return false;
	return Object.entries(node).some(([key, value]) => key.startsWith("x-") || hasVendorKeyword(value));
}

test("agent-tools.v1.json is the one tool definition: four tools, Ask without write_page, plain JSON Schema after resolve", () => {
	const raw = JSON.parse(readFileSync(new URL("../../packages/chat-agent/src/agent/agent-tools.v1.json", import.meta.url), "utf8"));
	assert.equal(raw.format, "buildy-agent-tools");
	assert.match(AGENT_TOOLS_VERSION, /^buildy-agent-tools\/\d+$/);
	assert.deepEqual([...ALLOWED_TOOLS].sort(), ["get_block", "get_page", "list_blocks", "write_page"]);
	assert.deepEqual(new Set(agentToolsDocument.tools.map((tool) => tool.name)), new Set(ALLOWED_TOOLS));
	for (const tool of agentToolsDocument.tools) {
		assert.ok(tool.modes.length > 0 && tool.modes.every((mode) => mode === "ask" || mode === "build"), tool.name);
		assert.equal((tool.parameters as { type?: string }).type, "object", tool.name);
	}
	// Ask reads (no write tool at all); Build reads and writes.
	assert.deepEqual([...agentToolNames("ask")].sort(), ["get_block", "get_page", "list_blocks"]);
	assert.deepEqual([...agentToolNames("build")].sort(), ["get_block", "get_page", "list_blocks", "write_page"]);
	for (const mode of ["ask", "build"] as const) assert.equal(hasVendorKeyword(agentOpenAiTools(mode)), false, `${mode} tools still carry x-* keywords`);
	assert.equal(agentToolChoice("ask"), "auto");
 assert.equal(agentToolChoice("build"), "required");
 assert.equal(agentToolsDocument.modes.build.toolChoice, "required");
 // Enum markers are filled from the pinned catalog, never typed in the file.
	const getBlock = agentOpenAiTools("build").find((tool) => tool.function.name === "get_block")!;
	assert.deepEqual((getBlock.function.parameters as { properties: { item: { enum: string[] } } }).properties.item.enum, allItems());
	// No operation taxonomy, no layout tool, no plan tool.
	assert.doesNotMatch(JSON.stringify(raw), /propose_layout|edit_page|propose_plan|get_skill/);
	assert.match(contractFingerprint(), /^cf1-/);
});

test("catalog tools: an unknown tool is refused; list_blocks names every block; get_block reads every variant and its sample props", () => {
	const unknown = executeCatalogTool({ name: "propose_layout", arguments: {} }, { mode: "build" });
	assert.equal(unknown.ok, false);
	const list = executeCatalogTool({ name: "list_blocks", arguments: {} }, { mode: "ask" });
	assert.ok(list.ok, JSON.stringify(list));
	assert.match(JSON.stringify(list), /hero-simple/);
	assert.match(JSON.stringify(list), /team-simple/);
	const block = readBlock("team-simple");
	assert.ok(block.ok);
	if (block.ok) {
		assert.equal(block.item, "team-simple");
		assert.match(block.install, /^npx ui8kit add team-simple/);
		assert.deepEqual(block.variants.map((variant) => variant.id), ["cols3", "cols2", "cols4", "cards3"]);
		assert.equal(block.defaultVariant, "cols3");
		assert.ok(block.props.some((line) => line.startsWith("members")));
	}
	assert.equal(readBlock("feature-grid").ok, false, "a block outside the catalog");
	assert.equal(readBlock("block.features").ok, false, "Stock specs are gone");
});

test("Ask turn: tool_choice auto, a text answer, no proposal when the model does not write", async () => {
	const answer = "Team Simple has **4** layouts:\n\n1. `cols3` - default\n2. `cards3` - on cards";
	const { out, seen } = await withProvider(
		[{ calls: [{ name: "get_block", arguments: { item: "team-simple" } }] }, { content: answer }],
		async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "ask", page: page(), expectedRevision: 0 }, signal()), seen })
	);
	for (const request of seen.requests) {
		assert.deepEqual(toolNames(request).sort(), ["get_block", "get_page", "list_blocks"]);
		assert.equal(request.tool_choice, "auto");
	}
	const reply = out.result as AgentReply;
	assert.ok(isAgentReply(reply) && reply.ok);
	assert.equal(reply.mode, "ask");
	assert.equal(reply.text, answer);
	assert.equal(reply.proposal, undefined);
	assert.deepEqual(reply.blocks, ["team-simple"]);
	assert.equal(out.meta.usage.totalTokens, 2200);
	assert.equal(turnOutcome(reply), "text");
});

test("Ask turn that keeps calling tools gets a final tool_choice none step for the answer", async () => {
	const { out, seen } = await withProvider(
		[
			{ calls: [{ name: "list_blocks", arguments: {} }] },
			...Array.from({ length: 7 }, () => ({ calls: [{ name: "get_block", arguments: { item: "team-simple" } }] })),
			{ content: "Four layouts." }
		],
		async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "list features", mode: "ask", page: page(), expectedRevision: 0 }, signal()), seen })
	);
	assert.equal(seen.requests.at(-1)!.tool_choice, "none");
	assert.ok(seen.requests.slice(0, -1).every((request) => request.tool_choice === "auto"));
	assert.equal((out.result as AgentReply).text, "Four layouts.");
});

test("Build turn: a text-only answer without an accepted write is a failure", async () => {
	const { out, seen } = await withProvider([{ content: "Team Simple has 4 layouts; tell me which one to use." }], async (seen) => ({
		out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page: page(), expectedRevision: 0 }, signal()),
		seen
	}));
	assert.equal(seen.requests.length, 2, "required, then the nudge with write_page forced by name");
	assert.equal(out.result.ok, false);
	if (!out.result.ok) assert.equal(out.result.code, "build_no_proposal");
});

test("runtime /v1/run passes the mode through and returns the text answer (200, no page)", async () => {
	const env = { XAI_API_KEY: "test-key" } as NodeJS.ProcessEnv;
	const body = { modelId: MODEL, contract: contractFingerprint(), brief: BRIEF, mode: "ask", page: page(), expectedRevision: 0 };
	assert.equal((mapChatRunRequest(body, { allowUnlistedTrial: true }) as { request: { mode: string } }).request.mode, "ask");
	assert.equal((mapChatRunRequest({ ...body, mode: "chat" }, { allowUnlistedTrial: true }) as { request: { mode: string } }).request.mode, "build");
	const res = await withProvider([{ content: "Eight variants." } as Scripted], () =>
		handleRuntimeFetch(new Request("http://127.0.0.1:18100/runtime/v1/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), env, { surface: "node" })
	);
	assert.equal(res.status, 200, await res.clone().text());
	const json = (await res.json()) as Record<string, unknown>;
	assert.equal(json.mode, "ask");
	assert.equal(json.text, "Eight variants.");
	assert.equal(json.proposal, undefined);
});

test("chat mode is kept per chat; default Build; the mode is never inferred from words", () => {
	assert.equal(chatModeOf(null), "build");
	assert.equal(chatModeOf(null, "ask"), "ask");
	assert.equal(chatModeOf({ mode: "ask" }, "build"), "ask");
	assert.equal(chatModeOf({ mode: undefined }, "ask"), "ask");
	assert.equal(chatModeOf({ mode: "chat" as never }), "build");
	const source = ["chat.svelte.ts", "send.ts", "turn.ts", "proposal-flow.ts"].map((f) => readFileSync(new URL(`../../apps/chat-web/src/modules/chat/core/${f}`, import.meta.url), "utf8")).join("\n");
	assert.doesNotMatch(source, /isClearPageCommand|looksLike|detectIntent|parseAskProse/);
});

test("model Markdown is parsed into safe tokens (lists, bold, code; no javascript: links)", () => {
	const blocks = parseMarkdown("## Variants\n\n1. **grid** - default\n2. `grid2` two columns\n\n- a\n- b\n\nSee [Stock](https://app.codegen-x.com/) or [x](javascript:alert(1)).");
	assert.equal(blocks[0]!.type, "heading");
	assert.equal(blocks[1]!.type, "list");
	if (blocks[1]!.type === "list") {
		assert.equal(blocks[1].ordered, true);
		assert.deepEqual(blocks[1].items[0]![0], { type: "strong", text: "grid" });
		assert.deepEqual(blocks[1].items[1]![0], { type: "code", text: "grid2" });
	}
	assert.equal(blocks[2]!.type === "list" && blocks[2].ordered, false);
	const last = blocks[3]!;
	assert.equal(last.type, "paragraph");
	if (last.type === "paragraph") {
		assert.ok(last.inline.some((part) => part.type === "link" && part.href === "https://app.codegen-x.com/"));
		assert.equal(last.inline.some((part) => part.type === "link" && /javascript/.test(part.href)), false);
	}
	assert.deepEqual(parseInline("<b>x</b>"), [{ type: "text", text: "<b>x</b>" }]);
});

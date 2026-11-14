/**
 * The agent's tools and modes (ADR 0034): one tool definition file, Ask and Build share it; Ask never applies; a Build turn
 * that only answers makes no proposal; the loop gives the model a final answer step; the runtime passes the mode through.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ALLOWED_TOOLS, emptyPage, facetVocabulary } from "../../packages/builder-core/src/index.ts";
import { AGENT_TOOLS_VERSION, agentOpenAiTools, agentToolNames, agentToolsDocument, askBlockCards, catalogToolParameterSchema, contractFingerprint, executeCatalogTool, isAgentReply, mapChatRunRequest, readBlock, type AgentReply } from "../../packages/chat-agent/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { handleRuntimeFetch } from "../../apps/xai-runtime/src/http.ts";
import { chatModeOf, turnOutcome } from "../../apps/chat-web/src/modules/chat/core/modes.ts";
import { parseMarkdown, parseInline } from "../../apps/chat-web/src/modules/chat/core/markdown.ts";
import { MODEL, signal, toolNames, withProvider, type Scripted } from "./agent-replay.ts";

const BRIEF = "Just talk, do not change the page: list the Features blocks you would use and explain.";
const page = () => emptyPage({ title: "Coffee house", locale: "en", now: "2026-11-13T12:00:00.000Z" });

function hasVendorKeyword(node: unknown): boolean {
	if (Array.isArray(node)) return node.some(hasVendorKeyword);
	if (!node || typeof node !== "object") return false;
	return Object.entries(node).some(([key, value]) => key.startsWith("x-") || hasVendorKeyword(value));
}

test("agent-tools.v1.json is the one tool definition: four tools, both modes, plain JSON Schema after resolve", () => {
	const raw = JSON.parse(readFileSync(new URL("../../packages/chat-agent/src/agent/agent-tools.v1.json", import.meta.url), "utf8"));
	assert.equal(raw.format, "buildy-agent-tools");
	assert.match(AGENT_TOOLS_VERSION, /^buildy-agent-tools\/\d+$/);
	assert.deepEqual([...ALLOWED_TOOLS].sort(), ["get_block", "get_page", "search_catalog", "write_page"]);
	assert.deepEqual(new Set(agentToolsDocument.tools.map((tool) => tool.name)), new Set(ALLOWED_TOOLS));
	for (const tool of agentToolsDocument.tools) {
		assert.ok(tool.modes.length > 0 && tool.modes.every((mode) => mode === "ask" || mode === "build"), tool.name);
		assert.equal((tool.parameters as { type?: string }).type, "object", tool.name);
	}
	// Ask and Build offer the same four tools; Ask's write_page is a proposal the host never applies.
	for (const mode of ["ask", "build"] as const) {
		assert.deepEqual([...agentToolNames(mode)].sort(), ["get_block", "get_page", "search_catalog", "write_page"], mode);
		assert.equal(hasVendorKeyword(agentOpenAiTools(mode)), false, `${mode} tools still carry x-* keywords`);
	}
	// Enum markers are filled from the pinned catalog, never typed in the file.
	assert.deepEqual(catalogToolParameterSchema().section.enum, facetVocabulary().section);
	assert.deepEqual(catalogToolParameterSchema().job.enum, facetVocabulary().job);
	// No operation taxonomy, no layout tool, no plan tool.
	assert.doesNotMatch(JSON.stringify(raw), /propose_layout|edit_page|propose_plan|get_skill/);
	assert.match(contractFingerprint(), /^cf1-/);
});

test("catalog tools: an unknown tool is refused; get_block reads every variant of an item and its sample props", () => {
	const unknown = executeCatalogTool({ name: "propose_layout", arguments: {} }, { mode: "build" });
	assert.equal(unknown.ok, false);
	const block = readBlock("feature-grid");
	assert.ok(block.ok);
	if (block.ok) {
		assert.equal(block.item, "feature-grid");
		assert.match(block.install, /^npx ui8kit add feature-grid/);
		assert.ok(block.variants.length >= 8 && block.variants.includes(block.defaultVariant));
		assert.deepEqual(Object.keys(block.variantSets).sort(), [...block.variants].sort());
		assert.ok(block.props.some((line) => line.startsWith("features")));
		assert.match(String(block.stockUrl), /^https:\/\/app\.codegen-x\.com\/#\/asset\/block\.features\/[\w-]+$/);
	}
	const unknownItem = readBlock("block.nope");
	assert.equal(unknownItem.ok, false);
	// A Stock spec or a registry item name both resolve: the model may use either.
	const bySpec = readBlock("block.features");
	assert.ok(bySpec.ok && bySpec.item === "feature-grid");
});

test("Ask turn: tool_choice auto, a text answer, no proposal when the model does not write", async () => {
	const answer = "There are **8** Features variants:\n\n1. `grid` - default\n2. `grid2` - two columns";
	const { out, seen } = await withProvider(
		[{ calls: [{ name: "get_block", arguments: { item: "block.features" } }] }, { content: answer }],
		async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "ask", page: page(), expectedRevision: 0 }, signal()), seen })
	);
	for (const request of seen.requests) {
		assert.deepEqual(toolNames(request).sort(), ["get_block", "get_page", "search_catalog", "write_page"]);
		assert.equal(request.tool_choice, "auto");
	}
	const reply = out.result as AgentReply;
	assert.ok(isAgentReply(reply) && reply.ok);
	assert.equal(reply.mode, "ask");
	assert.equal(reply.text, answer);
	assert.equal(reply.proposal, undefined);
	assert.deepEqual(reply.blocks, ["block.features"]);
	assert.equal(out.meta.usage.totalTokens, 2200);
	assert.equal(turnOutcome(reply), "text");
	// Cards are rebuilt from the registry; unknown items from the wire are dropped.
	const cards = askBlockCards([...reply.blocks, "block.invented"]);
	assert.equal(cards.length, 1);
	assert.ok(cards[0]!.variants.length >= 8);
});

test("Ask turn that keeps calling tools gets a final tool_choice none step for the answer", async () => {
	const { out, seen } = await withProvider(
		[
			{ calls: [{ name: "search_catalog", arguments: { q: "features" } }] },
			...Array.from({ length: 7 }, () => ({ calls: [{ name: "get_block", arguments: { item: "feature-grid" } }] })),
			{ content: "Eight variants." }
		],
		async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "list features", mode: "ask", page: page(), expectedRevision: 0 }, signal()), seen })
	);
	assert.equal(seen.requests.at(-1)!.tool_choice, "none");
	assert.ok(seen.requests.slice(0, -1).every((request) => request.tool_choice === "auto"));
	assert.equal((out.result as AgentReply).text, "Eight variants.");
});

test("Build turn: a text-only answer is shown and creates no proposal", async () => {
	const { out, seen } = await withProvider([{ content: "Features has 8 variants; tell me which one to use." }], async (seen) => ({
		out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page: page(), expectedRevision: 0 }, signal()),
		seen
	}));
	assert.equal(seen.requests.length, 1);
	const reply = out.result as AgentReply;
	assert.equal(reply.mode, "build");
	assert.equal(reply.proposal, undefined);
	assert.equal(turnOutcome(reply), "text");
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

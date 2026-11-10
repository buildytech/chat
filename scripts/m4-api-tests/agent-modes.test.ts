import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
	ALLOWED_TOOLS,
	AGENT_TOOLS_VERSION,
	agentOpenAiTools,
	agentToolNames,
	agentToolsDocument,
	askBlockCards,
	catalogToolParameterSchema,
	clientProposalGate,
	contentCopyFields,
	contractFingerprint,
	executeTool,
	facetVocabulary,
	isAgentTextReply,
	mapChatRunRequest,
	proposeContentParameterSchema,
	runConstructorTools,
	type LayoutProposal
} from "../../packages/builder-core/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { handleRuntimeFetch } from "../../apps/xai-runtime/src/http.ts";
import { chatModeOf, turnOutcome, variantProposal, variantTarget } from "../../apps/chat-web/src/lib/chat-core/modes.ts";
import { parseMarkdown, parseInline } from "../../apps/chat-web/src/lib/chat-core/markdown.ts";

const MODEL = "grok-4.20-0309-non-reasoning";
// The owner's exported Ask prompt (2026-11-10), as \u escapes: "just talk, do not change the page, list 10 Features blocks".
const OWNER_ASK =
	"\u043f\u0440\u043e\u0441\u0442\u043e \u043f\u043e\u0433\u043e\u0432\u043e\u0440\u0438\u043c. \u043d\u0435 \u0438\u0437\u043c\u0435\u043d\u044f\u0439 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443. \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0438 \u043f\u043e\u0434\u0431\u043e\u0440\u043a\u0443 \u0431\u043b\u043e\u043a\u043e\u0432 \u0434\u043b\u044f Features, \u043f\u0435\u0440\u0435\u0447\u0438\u0441\u043b\u0438 10 \u0438 \u043e\u0431\u044a\u044f\u0441\u043d\u0438";

function hasVendorKeyword(node: unknown): boolean {
	if (Array.isArray(node)) return node.some(hasVendorKeyword);
	if (!node || typeof node !== "object") return false;
	return Object.entries(node).some(([key, value]) => key.startsWith("x-") || hasVendorKeyword(value));
}

type Scripted = { content?: string | null; calls?: Array<{ name: string; arguments: Record<string, unknown> }> };

/** Stub the provider: each chat/completions call returns the next scripted message; requests are recorded. */
async function withProvider<T>(script: Scripted[], run: (requests: Array<Record<string, unknown>>) => Promise<T>): Promise<T> {
	const original = globalThis.fetch;
	const requests: Array<Record<string, unknown>> = [];
	let index = 0;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (!url.includes("/chat/completions")) {
			const ids = url.includes("/image-generation-models") ? [] : [{ id: MODEL }];
			return new Response(JSON.stringify({ data: ids }), { status: 200, headers: { "content-type": "application/json" } });
		}
		requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
		const step = script[Math.min(index, script.length - 1)]!;
		index += 1;
		const message = {
			role: "assistant",
			content: step.content ?? null,
			...(step.calls?.length
				? { tool_calls: step.calls.map((call, i) => ({ id: `call-${index}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } })) }
				: {})
		};
		return new Response(
			JSON.stringify({ model: MODEL, choices: [{ message, finish_reason: step.calls?.length ? "tool_calls" : "stop" }], usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100 } }),
			{ status: 200, headers: { "content-type": "application/json" } }
		);
	}) as typeof fetch;
	try {
		return await run(requests);
	} finally {
		globalThis.fetch = original;
	}
}

const toolNames = (request: Record<string, unknown>) => (request.tools as Array<{ function: { name: string } }>).map((tool) => tool.function.name);

test("agent-tools.v1.json is the one tool definition: modes, names, plain JSON Schema after resolve", () => {
	const raw = JSON.parse(readFileSync(new URL("../../packages/builder-core/src/agent/agent-tools.v1.json", import.meta.url), "utf8"));
	assert.equal(raw.format, "buildy-agent-tools");
	assert.equal(raw.version, 1);
	assert.equal(AGENT_TOOLS_VERSION, "buildy-agent-tools/1");
	assert.deepEqual(new Set(agentToolsDocument.tools.map((tool) => tool.name)), new Set(ALLOWED_TOOLS));
	for (const tool of agentToolsDocument.tools) {
		assert.ok(tool.modes.length > 0 && tool.modes.every((mode) => mode === "ask" || mode === "build"), tool.name);
		assert.equal((tool.parameters as { type?: string }).type, "object", tool.name);
	}
	// Mode -> tool set: Ask is read-only, Build has no Ask-only reader.
	assert.deepEqual(agentToolNames("ask"), ["search_catalog", "get_block"]);
	assert.deepEqual(agentToolNames("build"), ["search_catalog", "get_block_details", "propose_layout", "edit_page", "get_skill"]);
	for (const mode of ["ask", "build"] as const) {
		const tools = agentOpenAiTools(mode);
		assert.equal(hasVendorKeyword(tools), false, `${mode} tools still carry x-* keywords`);
	}
	const ask = agentOpenAiTools("ask").map((tool) => tool.function.name);
	assert.equal(ask.includes("propose_layout"), false);
	assert.equal(ask.includes("edit_page"), false);
	// Enum markers are filled from the pinned catalog, never typed in the file.
	assert.deepEqual(catalogToolParameterSchema().section.enum, facetVocabulary().section);
	assert.deepEqual(catalogToolParameterSchema().job.enum, facetVocabulary().job);
	assert.doesNotMatch(JSON.stringify(raw), /"dashboard","marketing"|tiles4|cells4/);
	// Copy keys of propose_layout blocks stay equal to the content parser's.
	const blockProps = ((proposeContentParameterSchema().blocks as { items: { properties: Record<string, unknown> } }).items.properties);
	for (const field of contentCopyFields()) assert.ok(field in blockProps, `propose_layout blocks lacks copy field ${field}`);
	// The contract fingerprint moves with the tools file version.
	assert.match(contractFingerprint(), /^cf1-/);
});

test("executeTool rejects a tool the mode does not offer; get_block reads all Features variants", () => {
	for (const name of ["propose_layout", "edit_page", "get_skill", "get_block_details"]) {
		const out = executeTool({ name, arguments: {} }, { mode: "ask" });
		assert.equal(out.ok, false, name);
		if (!out.ok) assert.equal(out.code, "tool_not_in_mode", name);
	}
	const inBuild = executeTool({ name: "get_block", arguments: { id: "features" } }, { mode: "build" });
	assert.equal(inBuild.ok, false);
	const block = executeTool({ name: "get_block", arguments: { id: "features" } }, { mode: "ask" });
	assert.equal(block.ok, true);
	if (block.ok) {
		const result = block.result as { spec: string; variantCount: number; variants: string[]; variantProps: Record<string, string>; registryItem: string; stockUrl: string; icons?: unknown };
		assert.equal(result.spec, "block.features");
		assert.equal(result.variantCount, 8);
		assert.equal(result.variants.length, 8);
		assert.deepEqual(Object.keys(result.variantProps).sort(), [...result.variants].sort());
		assert.equal(result.registryItem, "feature-grid");
		assert.match(result.stockUrl, /^https:\/\/app\.codegen-x\.com\/#\/search\?type=block&spec=block\.features$/);
		assert.equal(result.icons, undefined, "Ask get_block stays small: no icon list");
	}
	const unknown = executeTool({ name: "get_block", arguments: { id: "block.nope" } }, { mode: "ask" });
	assert.equal(unknown.ok, false);
});

test("Ask turn: only read-only tools, tool_choice auto, text answer, no proposal (even if the model names propose_layout)", async () => {
	const answer = "There are **8** Features variants, not 10:\n\n1. `grid` - default\n2. `grid2` - two columns";
	const out = await withProvider(
		[
			{ calls: [{ name: "get_block", arguments: { id: "block.features" } }] },
			{ calls: [{ name: "propose_layout", arguments: { brief: "x", screenId: "screen.x", locale: "ru", blocks: [] } }] },
			{ content: answer }
		],
		async (requests) => {
			const turn = await runXaiCatalogTurn("test-key", MODEL, { brief: OWNER_ASK, mode: "ask", scenarioId: null, screenId: null, expectedRevision: 0 }, AbortSignal.timeout(5000));
			for (const request of requests) {
				assert.deepEqual(toolNames(request), ["search_catalog", "get_block"]);
				assert.equal(request.tool_choice, "auto");
			}
			const messages = requests[2]!.messages as Array<{ role: string; name?: string; content?: string }>;
			const rejected = messages.find((m) => m.role === "tool" && m.name === "propose_layout");
			assert.match(String(rejected?.content), /tool_not_in_mode/);
			return turn;
		}
	);
	assert.equal(isAgentTextReply(out.proposal), true);
	if (!isAgentTextReply(out.proposal)) return;
	assert.equal(out.proposal.mode, "ask");
	assert.equal(out.proposal.text, answer);
	assert.deepEqual(out.proposal.blocks, ["block.features"]);
	assert.equal("page" in out.proposal, false);
	assert.deepEqual(out.meta.toolsCalled, ["get_block", "propose_layout"]);
	assert.equal(out.meta.usage.totalTokens, 3300);
	assert.equal(turnOutcome(out.proposal), "text");
	// Cards are rebuilt from the bundled catalog; unknown specs from the wire are dropped.
	const cards = askBlockCards([...out.proposal.blocks, "block.invented"]);
	assert.equal(cards.length, 1);
	assert.equal(cards[0]!.variants.length, 8);
});

test("Ask turn that keeps calling tools gets a final tool_choice none step for the answer", async () => {
	const out = await withProvider(
		[
			{ calls: [{ name: "search_catalog", arguments: { q: "features" } }] },
			{ calls: [{ name: "get_block", arguments: { id: "features" } }] },
			{ calls: [{ name: "get_block", arguments: { id: "features" } }] },
			{ calls: [{ name: "get_block", arguments: { id: "features" } }] },
			{ content: "Eight variants." }
		],
		async (requests) => {
			const turn = await runXaiCatalogTurn("test-key", MODEL, { brief: "list features", mode: "ask", scenarioId: null, screenId: null, expectedRevision: 0 }, AbortSignal.timeout(5000));
			assert.equal(requests.at(-1)!.tool_choice, "none");
			assert.ok(requests.slice(0, -1).every((request) => request.tool_choice === "auto"));
			return turn;
		}
	);
	assert.equal(isAgentTextReply(out.proposal) && out.proposal.text, "Eight variants.");
});

test("Build turn: tool_choice auto, a text-only answer is shown and creates no proposal", async () => {
	const out = await withProvider([{ content: "Features has 8 variants; tell me which one to use." }], async (requests) => {
		const turn = await runXaiCatalogTurn("test-key", MODEL, { brief: OWNER_ASK, mode: "build", scenarioId: null, screenId: null, expectedRevision: 0 }, AbortSignal.timeout(5000));
		assert.equal(requests.length, 1);
		assert.equal(requests[0]!.tool_choice, "auto");
		assert.ok(toolNames(requests[0]!).includes("propose_layout"));
		assert.equal(toolNames(requests[0]!).includes("get_block"), false);
		return turn;
	});
	assert.equal(isAgentTextReply(out.proposal), true);
	if (isAgentTextReply(out.proposal)) assert.equal(out.proposal.mode, "build");
	assert.equal(turnOutcome(out.proposal as { ok: boolean }), "text");
});

test("runtime /v1/run passes mode through and returns the text answer (200, no page)", async () => {
	const env = { XAI_API_KEY: "test-key" } as NodeJS.ProcessEnv;
	const body = { modelId: MODEL, contract: contractFingerprint(), brief: OWNER_ASK, mode: "ask" };
	assert.equal((mapChatRunRequest(body, { allowUnlistedTrial: true }) as { request: { mode: string } }).request.mode, "ask");
	assert.equal((mapChatRunRequest({ ...body, mode: "chat" }, { allowUnlistedTrial: true }) as { request: { mode: string } }).request.mode, "build");
	const res = await withProvider([{ content: "Eight variants." }], () =>
		handleRuntimeFetch(
			new Request("http://127.0.0.1:18100/runtime/v1/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
			env,
			{ surface: "node" }
		)
	);
	assert.equal(res.status, 200);
	const json = (await res.json()) as Record<string, unknown>;
	assert.equal(json.reply, "text");
	assert.equal(json.mode, "ask");
	assert.equal(json.text, "Eight variants.");
	assert.equal(json.page, undefined);
});

test("chat mode is kept per chat; default Build", () => {
	assert.equal(chatModeOf(null), "build");
	assert.equal(chatModeOf(null, "ask"), "ask");
	assert.equal(chatModeOf({ mode: "ask" }, "build"), "ask");
	assert.equal(chatModeOf({ mode: undefined }, "ask"), "ask");
	assert.equal(chatModeOf({ mode: "chat" as never }), "build");
});

test("Apply variant from an Ask card: set_variant proposal, pending, gate-valid; no page or bad variant is an error", () => {
	assert.deepEqual(variantTarget(null, "block.features"), { ok: false, code: "no_page" });
	const built = runConstructorTools({ brief: "Create a landing page for Harbor Studio.", scenarioId: "landing", screenId: null, expectedRevision: 0, now: "2026-11-10T00:00:00.000Z" });
	assert.equal(built.ok, true);
	if (!built.ok) return;
	const page = (built as LayoutProposal).page;
	const features = page.layout.blocks.find((block) => block.catalogBlock === "block.features");
	assert.ok(features, "the landing pick has a features block");
	const provenance = { screenId: built.provenance.screenId, scenarioId: built.provenance.scenarioId, missing: built.missing };
	const target = variantTarget(page, "block.features");
	assert.equal(target.ok && target.blockId, features!.id);
	const proposal = variantProposal({ page, provenance, revision: 1, spec: "block.features", variant: "grid2" });
	assert.equal(proposal.ok, true);
	if (!proposal.ok) return;
	assert.equal(proposal.applied, false);
	assert.equal(proposal.status, "proposal");
	assert.equal(proposal.page.layout.blocks.find((block) => block.id === features!.id)?.variant, "grid2");
	// Everything else is kept.
	assert.equal(proposal.page.layout.blocks.length, page.layout.blocks.length);
	assert.equal(clientProposalGate(proposal).ok, true);
	const bad = variantProposal({ page, provenance, revision: 1, spec: "block.features", variant: "tiles10" });
	assert.equal(bad.ok, false);
	if (!bad.ok) assert.equal(bad.code, "unknown_variant");
	const missing = variantProposal({ page, provenance, revision: 1, spec: "block.menuboard", variant: "default" });
	assert.equal(missing.ok, false);
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

/**
 * ADR 0067, the desktop signed in with OpenRouter: the webview runs the same turn over the host's OpenRouter forward
 * with the OpenRouter model id and grok-4.20's reasoning switch, reads OpenRouter's USD cost, reads the status in the
 * app's own model ids, takes a Media draw that is done at once, and offers the sign-in only when the host lists it.
 * The xAI wire and the web app are unchanged (the same turn over xAI answers the same).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyPage, installRenderProbe, probeFromModule, type RenderModule } from "../../packages/builder-core/src/index.ts";
import { OPENROUTER_MODELS, appCandidate, appModelIds, readProviderUsage, usdToTicks, type ProviderRequest } from "../../packages/chat-agent/src/index.ts";
import { providerStep } from "../../packages/provider-xai/src/provider.ts";
import { OPENROUTER_CHAT_MODELS, OPENROUTER_FORWARD_BASE } from "../../packages/provider-xai/src/openrouter.ts";
import { LOCAL_XAI_BASE, runLocalTurn } from "../../apps/chat-web/src/modules/chat/browser/local-turn.ts";
import { openRouterStatus, runBody } from "../../apps/chat-web/src/modules/chat/browser/xai-client.ts";
import { noteRuntimeSignIn, signInState, signOut, startSignIn } from "../../apps/chat-web/src/modules/chat/browser/runtime-sign-in.ts";
import { generateCandidates } from "../../apps/chat-web/src/modules/chat/media/client.ts";
import { MODEL, installBundleProbe, withProvider } from "./agent-replay.ts";

const request = (modelId: string): ProviderRequest & { apiKey: string; baseUrl: string } => ({
	modelId,
	messages: [{ role: "user", content: "Hi" }],
	tools: [],
	toolChoice: "auto",
	maxTokens: 400,
	signal: new AbortController().signal,
	cacheKey: "chat-k",
	apiKey: "host-held",
	baseUrl: OPENROUTER_FORWARD_BASE
});

async function capture<T>(answer: Record<string, unknown>, run: () => Promise<T>): Promise<{ out: T; sent: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> }> {
	const original = globalThis.fetch;
	const sent: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		sent.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
		return new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json" } });
	}) as typeof fetch;
	try {
		return { out: await run(), sent };
	} finally {
		globalThis.fetch = original;
	}
}

const reply = (model: string, usage: Record<string, unknown> = { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 }) => ({ id: "gen-1", model, choices: [{ index: 0, message: { role: "assistant", content: "Hello." }, finish_reason: "stop" }], usage });

test("the openrouter wire sends OpenRouter's model id, grok-4.20's reasoning switch and the xAI request otherwise", async () => {
	const { out, sent } = await capture(reply("x-ai/grok-4.20", { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15, cost: 0.0000225 }), () => providerStep({ ...request(MODEL), wire: "openrouter" }));
	assert.equal(out.ok, true);
	assert.equal(sent.length, 1);
	assert.equal(sent[0]!.url, "/runtime/v1/openrouter/chat/completions");
	assert.equal(sent[0]!.headers.get("authorization"), "Bearer host-held");
	assert.equal(sent[0]!.headers.get("x-grok-conv-id"), "chat-k");
	assert.equal(sent[0]!.body.model, "x-ai/grok-4.20");
	assert.deepEqual(sent[0]!.body.reasoning, { enabled: false });
	assert.equal(sent[0]!.body.parallel_tool_calls, false);
	assert.equal(sent[0]!.body.max_completion_tokens, 400);
	assert.equal(sent[0]!.body.stream, false);
	assert.equal(out.usage?.costUsdTicks, "225000");
	const reasoning = await capture(reply("x-ai/grok-4.20-20260309"), () => providerStep({ ...request("grok-4.20-0309-reasoning"), wire: "openrouter" }));
	assert.equal(reasoning.out.ok, true, "a dated answer of the same model is no switch");
	assert.deepEqual(reasoning.sent[0]!.body.reasoning, { enabled: true });
});

test("the openrouter wire refuses a silent switch and a model OpenRouter does not serve here", async () => {
	const switched = await capture(reply("x-ai/grok-4.1-fast"), () => providerStep({ ...request(MODEL), wire: "openrouter" }));
	assert.equal(switched.out.ok, false);
	if (!switched.out.ok) assert.equal(switched.out.error.code, "silent_fallback_forbidden");
	const unserved = await capture(reply("x"), () => providerStep({ ...request("grok-build-0.1"), wire: "openrouter" }));
	assert.equal(unserved.out.ok, false);
	assert.equal(unserved.sent.length, 0, "no request");
});

test("the xAI wire is unchanged: xAI's model id, no reasoning field", async () => {
	const { out, sent } = await capture(reply(MODEL), () => providerStep({ ...request(MODEL), baseUrl: "https://api.x.ai/v1" }));
	assert.equal(out.ok, true);
	assert.equal(sent[0]!.url, "https://api.x.ai/v1/chat/completions");
	assert.equal(sent[0]!.body.model, MODEL);
	assert.equal("reasoning" in sent[0]!.body, false);
});

test("OpenRouter's USD cost becomes billed ticks; xAI's ticks win when both are there", () => {
	assert.equal(usdToTicks(0.04), "400000000");
	assert.equal(usdToTicks(-1), undefined);
	assert.equal(usdToTicks(Number.NaN), undefined);
	assert.equal(usdToTicks("0.04"), undefined);
	assert.equal(readProviderUsage({ prompt_tokens: 1, completion_tokens: 1, cost: 0.0000225 })?.costUsdTicks, "225000");
	assert.equal(readProviderUsage({ prompt_tokens: 1, completion_tokens: 1, cost: 1, cost_in_usd_ticks: 7 })?.costUsdTicks, "7");
});

test("the openrouter definition: every model is allowed by the contract, the status reads in app ids", () => {
	for (const model of OPENROUTER_MODELS) assert.ok((OPENROUTER_CHAT_MODELS as readonly string[]).includes(model.id), model.id);
	assert.deepEqual(appModelIds(["x-ai/grok-4.7", "openai/gpt-5", "x-ai/grok-4.20"]), ["grok-4.20-0309-non-reasoning", "grok-4.20-0309-reasoning", "grok-4.7"]);
	assert.equal(appCandidate("x-ai/grok-4.20"), "grok-4.20-0309-non-reasoning");
	assert.equal(appCandidate("x-ai/unknown"), null);
	const status = openRouterStatus({ runtime: "xai-grok", ready: true, liveModel: true, code: "xai_runtime_ready", provider: { id: "openrouter", signedIn: true, pending: false }, models: { listed: true, chatIds: ["x-ai/grok-4.20"], imageIds: ["x-ai/grok-imagine-image-2.0"], candidate: "x-ai/grok-4.20" } });
	assert.deepEqual(status.models?.chatIds, ["grok-4.20-0309-non-reasoning", "grok-4.20-0309-reasoning"]);
	assert.equal(status.models?.candidate, "grok-4.20-0309-non-reasoning");
	const xai = { runtime: "xai-grok", ready: true, liveModel: true, code: "xai_runtime_ready", models: { listed: true, chatIds: [MODEL], candidate: MODEL } };
	assert.equal(openRouterStatus(xai), xai, "an xAI status is read as it is");
});

const BUNDLE = new URL("../../api/runtime/_render/blocks.mjs", import.meta.url);
const loadBlocks = async () => (await installBundleProbe(), (await import(BUNDLE.href)) as RenderModule);
(globalThis as { __buildyRenderLoader?: () => Promise<RenderModule> }).__buildyRenderLoader = loadBlocks;

test("a desktop turn signed in with OpenRouter goes to the OpenRouter forward and answers like the xAI turn", async () => {
	installRenderProbe(probeFromModule(await loadBlocks()), { required: true, empty: "allow" });
	const turnBody = () => JSON.parse(JSON.stringify(runBody({ modelId: MODEL, brief: "What can you build?", mode: "ask", expectedRevision: 1, currentPage: emptyPage({ title: "New page" }), cacheKey: "chat-or" }))) as Record<string, unknown>;
	const base = { ready: true, code: "xai_runtime_ready", key: { present: true }, models: { listed: true, chatIds: [MODEL] } };
	const run = async (provider: "xai" | "openrouter") =>
		withProvider([{ content: "I build landing pages from the catalog." }], async (seen) => {
			const scripted = globalThis.fetch;
			const urls: string[] = [];
			globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
				urls.push(String(input));
				const res = await scripted(input, init);
				if (provider !== "openrouter") return res;
				// OpenRouter answers with its own model id.
				const json = (await res.json()) as Record<string, unknown>;
				return new Response(JSON.stringify({ ...json, model: "x-ai/grok-4.20" }), { status: res.status, headers: res.headers });
			}) as typeof fetch;
			try {
				const res = await runLocalTurn(turnBody(), { ...base, ...(provider === "openrouter" ? { provider: { id: "openrouter" as const } } : {}) });
				return { status: res.status, json: (await res.json()) as Record<string, unknown>, urls, requests: seen.requests };
			} finally {
				globalThis.fetch = scripted;
			}
		});
	const xai = await run("xai");
	const or = await run("openrouter");
	assert.equal(or.status, 200);
	assert.equal(or.status, xai.status);
	assert.ok(or.urls.length > 0 && or.urls.every((url) => url === `${OPENROUTER_FORWARD_BASE}/chat/completions`), or.urls.join());
	assert.ok(xai.urls.every((url) => url === `${LOCAL_XAI_BASE}/chat/completions`));
	assert.equal(or.json.ok, true);
	assert.equal(or.json.modelId, MODEL, "the app keeps its own model id");
	const strip = (body: Record<string, unknown>) => Object.fromEntries(Object.entries(body).filter(([key]) => key !== "model" && key !== "reasoning"));
	assert.equal(or.requests.length, xai.requests.length);
	or.requests.forEach((body, i) => {
		assert.equal(body.model, "x-ai/grok-4.20");
		assert.deepEqual(body.reasoning, { enabled: false });
		assert.deepEqual(strip(body), strip(xai.requests[i]!));
	});
});

test("a Media draw that is done at once is read without polling (the desktop on OpenRouter)", async () => {
	const { out, sent } = await capture({ ok: true, status: "done", requestId: "or-0123456789abcdef", model: "x-ai/grok-imagine-image-2.0", urls: ["/runtime/v1/files/" + "a".repeat(64) + ".png", 7], costUsdTicks: 400000000 }, () => generateCandidates("Rye bread", "16:9", 2));
	assert.equal(sent.length, 1, "one generate, no result poll");
	assert.equal(out.ok, true);
	if (out.ok) {
		assert.deepEqual(out.urls, ["/runtime/v1/files/" + "a".repeat(64) + ".png"]);
		assert.equal(out.costUsdTicks, 400000000);
	}
});

test("the sign-in is offered only when the host lists it, and follows the host's status", async () => {
	noteRuntimeSignIn(undefined, undefined);
	assert.equal(signInState().offered, false, "a web host offers none");
	noteRuntimeSignIn(["openrouter"], { signedIn: false, pending: false });
	assert.deepEqual(signInState(), { offered: true, signedIn: false, pending: false, failed: false });
	const statuses = [{ signedIn: false, pending: true }, { signedIn: true, pending: false }];
	const posted: string[] = [];
	const original = globalThis.fetch;
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		posted.push(String(input));
		return new Response("{}", { status: 200 });
	}) as typeof fetch;
	try {
		const ok = await startSignIn(async () => noteRuntimeSignIn(["openrouter"], statuses.shift() ?? { signedIn: true, pending: false }), async () => undefined);
		assert.equal(ok, true);
		assert.equal(signInState().signedIn, true);
		await signOut(async () => noteRuntimeSignIn(["openrouter"], { signedIn: false, pending: false }));
		assert.equal(signInState().signedIn, false);
		assert.deepEqual(posted, ["/runtime/v1/auth/openrouter/start", "/runtime/v1/auth/openrouter/signout"]);
		// a sign-in that ends without a key says so
		const failed = await startSignIn(async () => noteRuntimeSignIn(["openrouter"], { signedIn: false, pending: false }), async () => undefined);
		assert.equal(failed, false);
		assert.equal(signInState().failed, true);
	} finally {
		globalThis.fetch = original;
		noteRuntimeSignIn(undefined, undefined);
	}
});

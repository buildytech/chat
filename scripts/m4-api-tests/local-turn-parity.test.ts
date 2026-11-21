/**
 * ADR 0065, desktop loop parity: the same turn run by the runtime (POST /runtime/v1/run, handleRuntimeFetch, strict
 * render probe) and by the webview (local-turn.ts over the host's forward, the browser's "allow" probe) answers the same
 * status and body and sends the model the same requests. The webview sends HOST_HELD_KEY to the same-origin forward,
 * never a key; its own writes are judged strictly (a block that shows nothing fails) and the preview keeps its policy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { emptyPage, installRenderProbe, probeFromModule, renderProblems, type RenderModule } from "../../packages/builder-core/src/index.ts";
import { contractFingerprint } from "../../packages/chat-agent/src/index.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";
import { handleRuntimeFetch } from "../../apps/xai-runtime/src/http.ts";
import { LOCAL_XAI_BASE, runLocalTurn } from "../../apps/chat-web/src/modules/chat/browser/local-turn.ts";
import { runBody } from "../../apps/chat-web/src/modules/chat/browser/xai-client.ts";
import { MODEL, installBundleProbe, withProvider, type Scripted, type Seen } from "./agent-replay.ts";

const BUNDLE = new URL("../../api/runtime/_render/blocks.mjs", import.meta.url);
const loadBlocks = async () => (await installBundleProbe(), (await import(BUNDLE.href)) as RenderModule);
(globalThis as { __buildyRenderLoader?: () => Promise<RenderModule> }).__buildyRenderLoader = loadBlocks;
const ENV = { XAI_API_KEY: "parity-test-key" };
const STATUS = { ready: true, code: "ok", key: { present: true }, models: { listed: true, chatIds: [MODEL] }, capabilities: { loop: "client" as const, files: false, saveFile: false } };

type Turn = { brief: string; mode: "ask" | "build"; page: PageV2; scopeBlockIds?: string[]; script: Scripted[] };
type Sent = { url: string; authorization: string | null; conv: string | null };

/** Record where each model request went and with which credentials, inside the scripted provider. */
async function recorded<T>(script: Scripted[], run: () => Promise<T>): Promise<{ out: T; seen: Seen; sent: Sent[] }> {
	const sent: Sent[] = [];
	return withProvider(script, async (seen) => {
		const scripted = globalThis.fetch;
		globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.includes("/chat/completions")) {
				const headers = new Headers(init?.headers);
				sent.push({ url, authorization: headers.get("authorization"), conv: headers.get("x-grok-conv-id") });
			}
			return scripted(input, init);
		}) as typeof fetch;
		try {
			return { out: await run(), seen, sent };
		} finally {
			globalThis.fetch = scripted;
		}
	});
}

/** The body without what differs per run by design: the run id and the clock. */
function stable(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(stable);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(Object.entries(value).filter(([key]) => !/^(runId|startedAt|endedAt|at|ms|elapsedMs|durationMs|providerMs|deadlineMs|timeMs|latencyMs|updatedAt|t)$/.test(key)).map(([key, v]) => [key, stable(v)]));
}

function body(turn: Turn): Record<string, unknown> {
	return runBody({ modelId: MODEL, brief: turn.brief, mode: turn.mode, expectedRevision: 3, currentPage: turn.page, scopeBlockIds: turn.scopeBlockIds, cacheKey: "chat-parity" });
}

async function viaRuntime(turn: Turn) {
	installRenderProbe(probeFromModule(await loadBlocks()), { required: true });
	return recorded(turn.script, async () => {
		const res = await handleRuntimeFetch(new Request("http://127.0.0.1:18100/runtime/v1/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body(turn)) }), ENV, { surface: "node" });
		return { status: res.status, json: (await res.json()) as Record<string, unknown> };
	});
}

async function viaWebview(turn: Turn) {
	// the browser's probe: an empty block passes the Inspector (lib/preview/render-probe.ts)
	installRenderProbe(probeFromModule(await loadBlocks()), { required: true, empty: "allow" });
	return recorded(turn.script, async () => {
		const res = await runLocalTurn(JSON.parse(JSON.stringify(body(turn))) as Record<string, unknown>, STATUS);
		return { status: res.status, json: (await res.json()) as Record<string, unknown> };
	});
}

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as { sessions: Array<{ page: { applied: PageV2 } }> };
const studio = JSON.parse(readFileSync(new URL("./fixtures/studio-fill.json", import.meta.url), "utf8")) as PageV2;
const broken = structuredClone(studio);
broken.blocks[1]!.props = { title: "", members: [] };
const written = (name: string): Turn => {
	const { version, title, slug, locale, seo, blocks, id, createdAt } = fixture(`replay-v2-${name}.json`).sessions[0]!.page.applied;
	return {
		brief: "Quiet Rooms studio: hero and team",
		mode: "build",
		page: emptyPage({ title: "New page", locale: "en", id, now: createdAt }),
		script: [
			{ calls: [{ name: "get_block", arguments: { item: "hero-simple" } }] },
			{ calls: [{ name: "get_block", arguments: { item: "team-simple" } }] },
			{ calls: [{ name: "write_page", arguments: { page: { version, title, slug, locale, seo, blocks } } }] },
			{ content: "Done." }
		]
	};
};
const TURNS: Record<string, Turn> = {
	"Ask, text only": { brief: "What is on the page?", mode: "ask", page: studio, script: [{ calls: [{ name: "get_block", arguments: { item: "team-simple" } }] }, { content: "A hero and a team of three." }] },
	"Build, placeholders replay": written("placeholders"),
	"Build, photos replay": written("photos"),
	"Build, a write that leaves a block empty is refused, then the real fix": {
		brief: "Fix the team",
		mode: "build",
		page: broken,
		scopeBlockIds: ["team"],
		script: [
			{ calls: [{ name: "write_page", arguments: { patch: [{ op: "add", path: "/blocks/1/props/description", value: "" }] } }] },
			{ calls: [{ name: "write_page", arguments: { patch: [{ op: "replace", path: "/blocks/1/props", value: studio.blocks[1]!.props }] } }] },
			{ content: "Fixed." }
		]
	},
	"Build, a model that only writes an empty block ends with no proposal": {
		brief: "Fix the team",
		mode: "build",
		page: broken,
		scopeBlockIds: ["team"],
		script: [{ calls: [{ name: "write_page", arguments: { patch: [{ op: "add", path: "/blocks/1/props/description", value: "" }] } }] }, { content: "Could not." }]
	}
};

for (const [name, turn] of Object.entries(TURNS)) {
	test(`parity: ${name}: runtime and webview answer the same and send the model the same requests`, async () => {
		const server = await viaRuntime(turn);
		const client = await viaWebview(turn);
		assert.equal(client.out.status, server.out.status, JSON.stringify(client.out.json).slice(0, 400));
		assert.deepEqual(stable(client.out.json), stable(server.out.json));
		assert.deepEqual(client.seen.requests, server.seen.requests, "the same prompts, tools and tool results");
		assert.ok(server.seen.requests.length > 0);
		for (const sent of client.sent) assert.deepEqual(sent, { url: `${LOCAL_XAI_BASE}/chat/completions`, authorization: "Bearer host-held", conv: server.sent[0]!.conv });
		for (const sent of server.sent) assert.equal(sent.authorization, `Bearer ${ENV.XAI_API_KEY}`);
		assert.equal(server.sent[0]!.conv !== null, true, "the chat's cache key rides every request (x-grok-conv-id)");
	});
}

test("parity: the webview judged its writes strictly and gave the preview its own policy back", async () => {
	const turn = TURNS["Build, a model that only writes an empty block ends with no proposal"]!;
	const client = await viaWebview(turn);
	const tool = client.seen.toolMessages.find((m) => m.name === "write_page")!;
	assert.equal(tool.content.ok, false);
	assert.equal((tool.content.issues as Array<{ code: string }>)[0]!.code, "render_empty");
	assert.equal(client.out.json.ok, false);
	assert.deepEqual(renderProblems(broken), [], "after the turn the preview allows an empty block again");
});

test("parity: the webview refuses before any model call like the runtime (outdated tab, unlisted model, no key)", async () => {
	const base = body(TURNS["Ask, text only"]!);
	const outdated = await runLocalTurn({ ...base, contract: "old" }, STATUS);
	assert.equal(outdated.status, 409);
	assert.equal(((await outdated.json()) as { code: string }).code, "client_outdated");
	const unlisted = await runLocalTurn({ ...base, modelId: "grok-unlisted" }, STATUS);
	assert.equal(unlisted.status, 422);
	const noKey = await runLocalTurn(base, { ...STATUS, ready: false, code: "xai_api_key_missing", key: { present: false } });
	assert.equal(noKey.status, 503);
	assert.equal(((await noKey.json()) as { error: { code: string } }).error.code, "xai_api_key_missing");
	const slow = await runLocalTurn({ ...base, modelId: "grok-4.7" }, { ...STATUS, models: { listed: true, chatIds: [MODEL, "grok-4.7"] } });
	assert.equal(slow.status, 422);
	assert.equal(((await slow.json()) as { code: string }).code, "model_too_slow", "grok-4.7 is refused by the manifest before any request");
	assert.equal(contractFingerprint(), base.contract);
});

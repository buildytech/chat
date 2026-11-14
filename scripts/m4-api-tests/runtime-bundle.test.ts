/**
 * The bundled Vercel entry (api/runtime/v1/run.ts, what staging runs) takes a page-spec/v2 body and reaches the provider (ADR 0034).
 * The entry is transpiled the way Vercel does (esbuild, no bundling) and called with a Web Request; the provider is a stub.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { migratePageV1 } from "../../packages/builder-core/src/index.ts";
import { contractFingerprint } from "../../packages/chat-agent/src/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// Beside api/runtime/_render, where the bundled entry finds the compiled registry blocks of the render probe (../_render/blocks.mjs).
const OUT = join(ROOT, "api", "runtime", "_t");
mkdirSync(OUT, { recursive: true });
if (!existsSync(join(ROOT, "api", "runtime", "_render", "blocks.mjs"))) execFileSync(process.execPath, [join(ROOT, "scripts/build-render-bundle.mjs")], { cwd: ROOT, stdio: "pipe" });
execFileSync("npx", ["esbuild", "api/runtime/v1/run.ts", "--format=esm", "--platform=node", "--log-level=error", `--outdir=${OUT}`], { cwd: ROOT, stdio: "pipe" });
const entry = (await import(pathToFileURL(join(OUT, "run.js")).href)) as { default: { fetch(request: Request): Promise<Response> } };

const fitness = JSON.parse(readFileSync(join(ROOT, "scripts/m4-api-tests/fixtures/fitness-session-3933dbf.json"), "utf8"));
const page = migratePageV1(fitness.sessions[0].page.applied).page;
const MODELS = ["grok-4.20-0309-reasoning", "grok-4.20-0309-non-reasoning"];

type Scripted = { content?: string; calls?: Array<{ name: string; arguments: Record<string, unknown> }> };

async function run(modelId: string, mode: "ask" | "build", script: Scripted[] = [{ content: "Looks fine." }]) {
	const seen: Array<Record<string, unknown>> = [];
	const originalFetch = globalThis.fetch;
	const originalKey = process.env.XAI_API_KEY;
	process.env.XAI_API_KEY = "test-key";
	process.env.BUILDY_RUNTIME_BASIC_AUTH_USER = "tester";
	process.env.BUILDY_RUNTIME_BASIC_AUTH_PASSWORD = "test-password";
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (!url.includes("/chat/completions")) {
			const ids = url.includes("/image-generation-models") ? [] : MODELS.map((id) => ({ id }));
			return new Response(JSON.stringify({ data: ids }), { status: 200, headers: { "content-type": "application/json" } });
		}
		seen.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
		const step = script[Math.min(seen.length - 1, script.length - 1)]!;
		const message = { role: "assistant", content: step.content ?? null, ...(step.calls ? { tool_calls: step.calls.map((call, i) => ({ id: `call-${seen.length}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } })) } : {}) };
		return new Response(JSON.stringify({ model: modelId, choices: [{ message }], usage: { prompt_tokens: 900, completion_tokens: 60, total_tokens: 960 } }), { status: 200, headers: { "content-type": "application/json" } });
	}) as typeof fetch;
	try {
		const response = await entry.default.fetch(
			new Request("https://example.vercel.app/api/runtime/v1/run", {
				method: "POST",
				headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from("tester:test-password").toString("base64")}` },
				body: JSON.stringify({ contract: contractFingerprint(), modelId, mode, brief: "Review the page", currentPage: page, shownPage: page, expectedRevision: 3, conversation: [{ role: "user", text: "hi" }] })
			})
		);
		return { response, body: (await response.json()) as Record<string, unknown>, seen };
	} finally {
		globalThis.fetch = originalFetch;
		if (originalKey === undefined) delete process.env.XAI_API_KEY;
		else process.env.XAI_API_KEY = originalKey;
		delete process.env.BUILDY_RUNTIME_BASIC_AUTH_USER;
		delete process.env.BUILDY_RUNTIME_BASIC_AUTH_PASSWORD;
	}
}

for (const modelId of MODELS) {
	for (const mode of ["ask", "build"] as const) {
		test(`bundled run entry: ${mode} on ${modelId} takes a v2 page body and calls the provider`, async () => {
			const { response, body, seen } = await run(modelId, mode);
			assert.equal(response.status, 200, JSON.stringify(body));
			assert.equal(body.ok, true, JSON.stringify(body));
			assert.ok(seen.length >= 1, "at least one provider request");
			assert.equal(seen[0]!.model, modelId);
		});
	}
}

test("bundled run entry: the tool loop (get_page, search_catalog, get_block, write_page) runs end to end and returns a proposal", async () => {
	const { response, body, seen } = await run(MODELS[0]!, "build", [
		{ calls: [{ name: "get_page", arguments: {} }, { name: "search_catalog", arguments: { q: "pricing" } }, { name: "get_block", arguments: { item: "pricing-tiers" } }] },
		{ calls: [{ name: "write_page", arguments: { patch: [{ op: "replace", path: "/title", value: "Spring plans" }] } }] },
		{ content: "Renamed the page." }
	]);
	assert.equal(response.status, 200, JSON.stringify(body));
	assert.equal(body.ok, true, JSON.stringify(body));
	assert.equal(seen.length, 3);
	assert.ok(body.proposal, "a write_page proposal");
	assert.equal(((body.proposal as { page: { title: string } }).page).title, "Spring plans");
});

test("bundled run entry: a full 8-block page write (food fill) passes the bundled gates in one write_page", async () => {
	const fill = JSON.parse(readFileSync(join(ROOT, "scripts/m4-api-tests/fixtures/food-fill.json"), "utf8"));
	const { response, body, seen } = await run(MODELS[1]!, "build", [{ calls: [{ name: "write_page", arguments: { page: fill } }] }, { content: "Done." }]);
	assert.equal(response.status, 200, JSON.stringify(body));
	assert.equal(seen.length, 2);
	assert.equal(((body.proposal as { page: { blocks: unknown[] } }).page).blocks.length, 8);
});

test("bundled run entry: the render probe is live; a page with a currency symbol is rejected with the prop path, ISO codes are accepted", async () => {
	const owner = JSON.parse(readFileSync(join(ROOT, "scripts/m4-api-tests/fixtures/blocks-page-1e1031a.json"), "utf8"));
	const fixed = JSON.parse(JSON.stringify(owner).replaceAll('"currency":"\u20bd"', '"currency":"RUB"'));
	const { response, body, seen } = await run(MODELS[0]!, "build", [
		{ calls: [{ name: "write_page", arguments: { page: owner } }] },
		{ calls: [{ name: "write_page", arguments: { page: fixed } }] },
		{ content: "Done." }
	]);
	assert.equal(response.status, 200, JSON.stringify(body));
	const first = JSON.parse(String((seen[1]!.messages as Array<{ role: string; content: string }>).findLast((m) => m.role === "tool")!.content)) as { ok: boolean; issues: Array<{ path: string; code: string }> };
	assert.equal(first.ok, false);
	assert.deepEqual(first.issues.map((issue) => `${issue.code} ${issue.path}`), ["render_failed /blocks/2/props/dishes/0/currency", "render_failed /blocks/4/props/zones/0/currency"]);
	assert.equal(seen.length, 3);
	assert.equal(((body.proposal as { page: { blocks: unknown[] } }).page).blocks.length, 9);
});

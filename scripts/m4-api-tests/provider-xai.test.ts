import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { providerStep, xaiCapabilities } from "@buildytech/provider-xai";
import { GROK_CHAT_MODELS, modelRunsToolLoop, type ProviderRequest } from "../../packages/chat-agent/src/index.ts";
import { boundaryViolations } from "../lib/module-boundary.mjs";

test("xAI capabilities derive model policy from the existing catalog, not a duplicate allowlist", () => {
	for (const model of GROK_CHAT_MODELS) {
		const caps = xaiCapabilities(model.id);
		assert.ok(caps);
		assert.equal(caps.toolLoop, modelRunsToolLoop(model) ? "enabled" : "disabled");
		assert.equal(caps.streaming, false);
		assert.equal(caps.completionTokenParameter, "max_completion_tokens");
	}
	assert.equal(xaiCapabilities("unknown-model")?.toolLoop, "unknown");
});

test("xAI rejects disabled models and incompatible requests before HTTP without fallback", async () => {
	const original = globalThis.fetch;
	let calls = 0;
	globalThis.fetch = async () => { calls += 1; throw new Error("HTTP must not run"); };
	const request: ProviderRequest = { modelId: "grok-4.20-0309-non-reasoning", messages: [], tools: [], toolChoice: "auto", maxTokens: 100, signal: new AbortController().signal };
	try {
		for (const override of [{ provider: { id: "xai", version: 999 } }, { provider: { id: "other", version: 1 } }, { modelId: "unknown-model" }, { modelId: "grok-4.7" }, { modelId: "grok-4.20-multi-agent-0309" }, { maxTokens: 0 }, { toolChoice: "required" as const }, { toolChoice: { name: "write_page" } }]) {
			const result = await providerStep({ ...request, ...override, apiKey: "not-a-key", baseUrl: "https://unused.invalid" });
			assert.equal(result.ok, false);
		}
		assert.equal(calls, 0);
	} finally { globalThis.fetch = original; }
});

test("server providers cannot be imported by the browser shell or its modules", () => {
	const root = mkdtempSync(join(tmpdir(), "buildy-provider-boundary-"));
	const dir = join(root, "apps/chat-web/src/modules/chat");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "bad.ts"), 'import { providerStep } from "@buildytech/provider-xai";');
	assert.ok(boundaryViolations(root).some((problem: string) => problem.includes("browser imports a server provider")));
	const provider = relative(dir, join(root, "packages/provider-xai/src/index.ts")).replaceAll("\\", "/");
	writeFileSync(join(dir, "bad.ts"), `import { providerStep } from "${provider}";`);
	assert.ok(boundaryViolations(root).some((problem: string) => problem.includes("browser imports a server provider")));
	const manifest = JSON.parse(readFileSync(new URL("../../packages/provider-xai/package.json", import.meta.url), "utf8"));
	assert.equal(manifest.exports["."].browser, null);
});

test("ADR 0065: only the desktop webview turn may import the key-free wire, and the wire reads no environment", () => {
	const root = mkdtempSync(join(tmpdir(), "buildy-provider-wire-"));
	const dir = join(root, "apps/chat-web/src/modules/chat/browser");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "local-turn.ts"), 'import { runCatalogTurn } from "@buildytech/provider-xai/wire";');
	assert.deepEqual(boundaryViolations(root).filter((p: string) => p.includes("provider")), []);
	writeFileSync(join(dir, "local-turn.ts"), 'import { generateImages } from "@buildytech/provider-xai";');
	assert.ok(boundaryViolations(root).some((p: string) => p.includes("browser imports a server provider")), "the root stays server-only, even here");
	writeFileSync(join(dir, "local-turn.ts"), "");
	writeFileSync(join(dir, "other.ts"), 'import { providerStep } from "@buildytech/provider-xai/wire";');
	assert.ok(boundaryViolations(root).some((p: string) => p.includes("other.ts: browser imports a server provider")));
	const wire = join(root, "packages/provider-xai/src");
	mkdirSync(wire, { recursive: true });
	writeFileSync(join(wire, "wire.ts"), 'export * from "./step.ts";');
	writeFileSync(join(wire, "step.ts"), 'export const key = process.env.XAI_API_KEY; import "./images.ts";');
	writeFileSync(join(wire, "images.ts"), "console.log(1);");
	const problems = boundaryViolations(root).filter((p: string) => p.includes("webview wire"));
	assert.ok(problems.some((p: string) => p.includes("step.ts: the webview wire reads the environment")));
	assert.ok(problems.some((p: string) => p.includes("images.ts: the webview wire reaches the image transport")));
	assert.ok(problems.some((p: string) => p.includes("images.ts: the webview wire logs")));
	const repo = fileURLToPath(new URL("../..", import.meta.url));
	assert.deepEqual(boundaryViolations(repo), [], "this repo: the wire is clean and only local-turn.ts imports it");
	const manifest = JSON.parse(readFileSync(new URL("../../packages/provider-xai/package.json", import.meta.url), "utf8"));
	assert.equal(manifest.exports["./wire"], "./src/wire.ts");
});

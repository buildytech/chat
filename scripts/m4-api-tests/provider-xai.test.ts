import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { providerStep, xaiCapabilities } from "@buildytech/provider-xai";
import { GROK_CHAT_MODELS, modelRunsToolLoop, type ProviderRequest } from "../../packages/chat-agent/src/index.ts";
import { boundaryViolations } from "../lib/module-boundary.mjs";

test("xAI capabilities derive model policy from the existing catalog, not a duplicate allowlist", () => {
	for (const model of GROK_CHAT_MODELS) {
		const caps = xaiCapabilities(model.id);
		assert.ok(caps);
		assert.equal(caps.toolLoop, modelRunsToolLoop(model) ? "enabled" : "disabled");
		assert.equal(caps.streaming, false);
		assert.equal(caps.completionTokenParameter, "max_tokens");
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

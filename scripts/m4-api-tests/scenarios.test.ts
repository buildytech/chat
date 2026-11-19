import assert from "node:assert/strict";
import { test } from "node:test";
import { XAI_MODELS, providerManifest } from "@buildytech/agent-manifests";
import { compileScenario, scenarioProfiles, resolveScenario, GROK_CHAT_MODELS, runAgentLoop, mapChatRunRequest } from "../../packages/chat-agent/src/index.ts";
import { emptyPage } from "../../packages/builder-core/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { withProvider, MODEL, signal } from "./agent-replay.ts";

const draft = () => structuredClone(scenarioProfiles()[0]!);
const page = () => emptyPage({ title: "Test", now: "2026-11-16T12:00:00Z" });

test("the public manifest is the one immutable model source", () => {
	assert.equal(GROK_CHAT_MODELS, XAI_MODELS);
	assert.ok(Object.isFrozen(XAI_MODELS));
	assert.equal(providerManifest("unknown"), null);
});

test("scenario compilation is deterministic, immutable and sensitive to model and limits", () => {
	const profile = draft();
	const a = compileScenario(profile, MODEL);
	const b = compileScenario(Object.fromEntries(Object.entries(profile).reverse()), MODEL);
	assert.ok(a.ok && b.ok);
	if (!a.ok || !b.ok) return;
	assert.equal(a.scenario.fingerprint, b.scenario.fingerprint);
	assert.ok(Object.isFrozen(a.scenario.profile.limits));
	assert.ok(Object.isFrozen(a.scenario.tools));
	const limited = compileScenario({ ...profile, limits: { maxRequests: 1 } }, MODEL);
	assert.ok(limited.ok);
	if (limited.ok) assert.notEqual(limited.scenario.fingerprint, a.scenario.fingerprint);
	const other = compileScenario(profile, "grok-4.20-0309-reasoning");
	assert.ok(other.ok);
	if (other.ok) assert.notEqual(other.scenario.fingerprint, a.scenario.fingerprint);
});

test("schema and semantic checks reject secrets, unknown references, tools and raised budgets", () => {
	const profile = draft();
	for (const value of [
		{ ...profile, apiKey: "private" }, { ...profile, endpoint: "https://invalid" }, { ...profile, version: 0 },
		{ ...profile, model: { id: "grok-4.20-0309-reasoning" } }, { ...profile, providerVersion: 999 }, { ...profile, provider: "unknown" }, { ...profile, context: "unknown" }, { ...profile, nudge: "unknown" },
		{ ...profile, execution: "unknown" }, { ...profile, prompt: "page.build@1" },
		{ ...profile, toolSet: { ref: "unknown" } }, { ...profile, toolSet: { ...profile.toolSet, include: ["unknown"] } },
		{ ...profile, toolSet: { ...profile.toolSet, include: ["get_page"] } }, { ...profile, limits: { maxTokens: 8193 } }
	]) assert.equal(compileScenario(value, MODEL).ok, false);
	assert.equal(compileScenario(profile, "grok-4.7").ok, false);
	assert.equal(compileScenario({ ...profile, model: { id: MODEL } }, MODEL).ok, true);
	assert.equal(resolveScenario("ask", MODEL, { id: "page.ask", version: 999 }).ok, false);
	assert.equal(resolveScenario("build", MODEL, { id: "page.ask", version: 1 }).ok, false);
});

test("compiled limits govern actual execution, not just diagnostics", async () => {
	const result = compileScenario({ ...draft(), limits: { maxSteps: 1, maxRequests: 1, maxTokens: 256 } }, MODEL);
	assert.ok(result.ok);
	if (!result.ok) return;
	let calls = 0;
	const out = await runAgentLoop(MODEL, { mode: "ask", brief: "Explain", page: page(), expectedRevision: 0 }, signal(), async (request) => {
		calls += 1;
		assert.equal(request.maxTokens, 256);
		assert.deepEqual(request.provider, { id: "xai", version: 2 });
		assert.equal(request.messages[0]?.text, result.scenario.systemPrompt);
		return { ok: true, message: { role: "assistant", calls: [{ id: "one", name: "get_page", argumentsJson: "{}" }] } };
	}, "test-profile", { scenario: result.scenario });
	assert.equal(calls, 1);
	assert.equal(out.result.ok, false);
	if (!out.result.ok) assert.equal(out.result.code, "request_budget");
	assert.equal(out.meta.scenario?.fingerprint, result.scenario.fingerprint);
});

test("runtime uses the registered version and rejects a mismatched reference before HTTP", async () => {
	await withProvider([{ content: "Explanation" }], async (seen) => {
		const ctx = { mode: "ask" as const, brief: "Explain", page: page(), expectedRevision: 0 };
		const good = await runXaiCatalogTurn("not-a-key", MODEL, ctx, signal());
		assert.ok(good.result.ok);
		assert.equal(good.meta.scenario?.id, "page.ask");
		assert.equal(good.meta.scenario?.version, 3);
		const bad = await runXaiCatalogTurn("not-a-key", MODEL, { ...ctx, scenario: { id: "page.build", version: 1 } }, signal());
		assert.equal(bad.result.ok, false);
		assert.equal(seen.requests.length, 1);
	});
});

test("run requests accept a reference only, never an inline profile", () => {
	const opts = { allowUnlistedTrial: true };
	const good = mapChatRunRequest({ modelId: MODEL, scenario: { id: "page.ask", version: 1 } }, opts);
	assert.ok(good.ok);
	for (const scenario of [null, "page.ask", { id: "page.ask", version: 1, limits: {} }, { id: "page.ask", version: "1" }]) assert.equal(mapChatRunRequest({ modelId: MODEL, scenario }, opts).ok, false);
});

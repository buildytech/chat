/**
 * ADR 0068, a provider per role in the app: the providers of a status (the desktop lists them, a web host serves xAI
 * only), the approved lists (they narrow, never widen), the defaults (Build on OpenRouter when it is there, Media on xAI
 * with a key, else off; never an automatic switch), the status a role's turn runs against, the spend per role, and the
 * Media draw naming its provider and model.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { APPROVED_MAX_IDS } from "../../packages/chat-agent/src/index.ts";
import { addSpend, chatChoices, costTicks, emptySpend, formatTicks, imageChoices, mediaModel, parseApprovedText, providerViews, readApproved, readChoices, readSpend, roleProvider, roleStatus, type ProvidersStatus } from "../../apps/chat-web/src/modules/chat/browser/provider-roles.ts";
import { emptyPage } from "../../packages/builder-core/src/index.ts";
import { runLocalTurn } from "../../apps/chat-web/src/modules/chat/browser/local-turn.ts";
import { runBody } from "../../apps/chat-web/src/modules/chat/browser/xai-client.ts";
import { generateCandidates } from "../../apps/chat-web/src/modules/chat/media/client.ts";

const IMAGE = "grok-imagine-image-2.0";
const desktop = (or: Partial<{ state: string; chat: string[] }> = {}, xai: Partial<{ state: string; present: boolean }> = {}): ProvidersStatus => ({
	ready: true,
	code: "xai_runtime_ready",
	key: { present: true, source: "keychain" },
	models: { listed: true, chatIds: ["grok-4.20-0309-non-reasoning"], candidate: "grok-4.20-0309-non-reasoning" },
	capabilities: { settings: ["providers"], keys: ["xai"], signIn: ["openrouter"] },
	providers: [
		{ id: "xai", state: xai.state ?? "ready", key: { present: xai.present ?? true, source: xai.present === false ? null : "env" }, roles: ["build", "ask", "media", "design"], models: { chat: ["grok-4.20-0309-non-reasoning", "grok-4.7"], image: ["grok-imagine-image", IMAGE] } },
		{ id: "openrouter", state: or.state ?? "ready", key: { present: or.state !== "not_configured", source: or.state === "not_configured" ? null : "keychain" }, roles: ["build", "ask", "design"], models: { chat: or.chat ?? ["x-ai/grok-4.20", "x-ai/grok-4.7"], image: [] }, pending: false }
	]
});
const web: ProvidersStatus = { ready: true, code: "xai_runtime_ready", key: { present: true }, models: { listed: true, chatIds: ["grok-4.20-0309-non-reasoning", "grok-4.7"], imageIds: ["grok-imagine-image", IMAGE] } };

test("the desktop lists both providers; OpenRouter's chat ids are read in the app's ids", () => {
	const [xai, or] = providerViews(desktop());
	assert.equal(xai.id, "xai");
	assert.deepEqual(xai.image, [IMAGE], "a picture model the key lists but the host does not draw with is not offered");
	assert.equal(or.id, "openrouter");
	assert.deepEqual(or.chat, ["grok-4.20-0309-non-reasoning", "grok-4.20-0309-reasoning", "grok-4.7"]);
	assert.deepEqual(or.rawChat, ["x-ai/grok-4.20", "x-ai/grok-4.7"]);
	assert.deepEqual([...or.roles], ["build", "ask", "design"], "OpenRouter draws no pictures (constants.openrouter.mediaEnabled false)");
});

test("a web host serves xAI only; OpenRouter is a desktop provider there", () => {
	const views = providerViews(web);
	assert.deepEqual(views.map((p) => [p.id, p.state]), [["xai", "ready"], ["openrouter", "host_unavailable"]]);
	assert.equal(providerViews({ ...web, key: { present: false }, ready: false })[0].state, "not_configured");
	assert.equal(providerViews(null)[0].state, "not_configured");
	assert.deepEqual(views[0].image, [IMAGE], "the web runtime draws with its one model too");
});

test("approved lists: one id per line, trimmed, no blanks or repeats; a bad line or too many ids is refused", () => {
	assert.deepEqual(parseApprovedText(" x-ai/grok-4.7 \n\nx-ai/grok-4.20\r\nx-ai/grok-4.7\n"), { ok: true, ids: ["x-ai/grok-4.7", "x-ai/grok-4.20"] });
	assert.deepEqual(parseApprovedText("grok 4"), { ok: false, line: "grok 4" });
	assert.deepEqual(parseApprovedText(Array.from({ length: APPROVED_MAX_IDS + 1 }, (_, i) => `m-${i}`).join("\n")), { ok: false, line: null });
	assert.deepEqual(readApproved({ xai: { chat: ["grok-4.7", 3] }, openrouter: "x" }), { xai: { chat: ["grok-4.7"], image: null }, openrouter: { chat: null, image: null } });
});

test("an approved list narrows what a role may pick and never adds a model the host does not serve", () => {
	const [xai, or] = providerViews(desktop({ chat: ["x-ai/grok-4.20"] }));
	const doc = readApproved({ openrouter: { chat: ["x-ai/grok-4.7"] }, xai: { chat: ["grok-4.7", "grok-9"], image: [] } });
	assert.deepEqual(chatChoices(or, doc), [], "approved but not served: nothing");
	assert.deepEqual(chatChoices(or, readApproved({ openrouter: { chat: ["x-ai/grok-4.20"] } })), ["grok-4.20-0309-non-reasoning", "grok-4.20-0309-reasoning"]);
	assert.deepEqual(chatChoices(xai, doc), ["grok-4.7"]);
	assert.deepEqual(imageChoices(xai, doc), [], "an empty picture list approves none");
	assert.deepEqual(imageChoices(xai, readApproved(null)), [IMAGE]);
	assert.deepEqual(imageChoices(or, readApproved(null)), [], "no Media role, no picture choices");
});

test("defaults: Build on OpenRouter when it is there, else xAI; Ask and Design follow Build; Media on xAI with a key, else off", () => {
	const none = readChoices(null);
	assert.equal(roleProvider("build", none, providerViews(desktop())), "openrouter");
	assert.equal(roleProvider("ask", none, providerViews(desktop())), "openrouter");
	assert.equal(roleProvider("design", none, providerViews(desktop())), "openrouter");
	assert.equal(roleProvider("build", none, providerViews(desktop({ state: "not_configured" }))), "xai");
	assert.equal(roleProvider("build", none, providerViews(web)), "xai");
	assert.equal(roleProvider("media", none, providerViews(desktop())), "xai");
	assert.equal(roleProvider("media", none, providerViews(desktop({}, { state: "not_configured", present: false }))), "off", "no xAI key: Media off");
});

test("a chosen provider stays even when it cannot serve now (no automatic switch)", () => {
	const choices = readChoices({ build: { provider: "openrouter" }, ask: { same: false, provider: "xai", model: "grok-4.7" }, design: { same: false, provider: "xai", model: "grok-4.20-0309-non-reasoning" }, media: { provider: "off" } });
	const views = providerViews(desktop({ state: "limit" }));
	assert.equal(roleProvider("build", choices, views), "openrouter");
	assert.equal(roleProvider("ask", choices, views), "xai");
	assert.equal(roleProvider("design", choices, views), "xai");
	assert.equal(roleProvider("media", choices, views), "off");
	assert.deepEqual(readChoices({ build: { provider: "gemini" }, ask: { same: false, provider: "xai" }, media: { provider: 1 } }), readChoices(null), "anything else is the defaults");
});

test("a role's turn runs against its provider: readiness, key, approved models in app ids, the wire", () => {
	const none = readApproved(null);
	const or = roleStatus(desktop(), "openrouter", none);
	assert.equal(or.provider?.id, "openrouter");
	assert.equal(or.ready, true);
	assert.deepEqual(or.models?.chatIds, ["grok-4.20-0309-non-reasoning", "grok-4.20-0309-reasoning", "grok-4.7"]);
	const xai = roleStatus(desktop(), "xai", none);
	assert.equal(xai.provider?.id, "xai");
	assert.deepEqual(xai.models?.chatIds, ["grok-4.20-0309-non-reasoning", "grok-4.7"]);
	const missing = roleStatus(desktop({ state: "not_configured" }), "openrouter", none);
	assert.deepEqual([missing.ready, missing.code, missing.key?.present], [false, "openrouter_key_missing", false]);
	const narrowed = roleStatus(desktop(), "openrouter", readApproved({ openrouter: { chat: ["x-ai/grok-9"] } }));
	assert.deepEqual([narrowed.ready, narrowed.code], [false, "model_not_approved"]);
	const limited = roleStatus(desktop({ state: "limit" }), "openrouter", none);
	assert.equal(limited.ready, true, "Limit reached is shown, the provider still answers for itself");
	const webStatus = roleStatus(web, "xai", readApproved({ xai: { chat: ["grok-4.7"] } }));
	assert.deepEqual(webStatus.models?.chatIds, ["grok-4.7"], "a web host's selector is narrowed by this device's list");
	assert.equal(webStatus.provider, undefined, "a web host runs its own loop: no wire chosen here");
});

test("a local turn on a provider with no key makes no call and names the provider", async () => {
	const status = roleStatus(desktop({ state: "not_configured" }), "openrouter", readApproved(null));
	const original = globalThis.fetch;
	let calls = 0;
	globalThis.fetch = async () => {
		calls += 1;
		return new Response("{}");
	};
	try {
		const res = await runLocalTurn(JSON.parse(JSON.stringify(runBody({ modelId: "grok-4.20-0309-non-reasoning", brief: "Hi", mode: "ask", expectedRevision: 0, currentPage: emptyPage({ title: "T", now: "2026-11-23T00:00:00.000Z" }) }))), { ...status, ready: true, code: "xai_runtime_ready" });
		const body = await res.json();
		assert.equal(res.status, 503);
		assert.equal(body.error.code, "openrouter_key_missing");
		assert.equal(calls, 0);
	} finally {
		globalThis.fetch = original;
	}
});

test("Media draws with the chosen picture model while it is offered, else the first offered", () => {
	const [xai] = providerViews(desktop());
	const none = readApproved(null);
	assert.equal(mediaModel(readChoices({ media: { provider: "xai", model: IMAGE } }), xai, none), IMAGE);
	assert.equal(mediaModel(readChoices({ media: { provider: "xai", model: "gone" } }), xai, none), IMAGE);
	assert.equal(mediaModel(readChoices(null), xai, readApproved({ xai: { image: [] } })), null);
	assert.equal(mediaModel(readChoices(null), undefined, none), null);
});

test("the Media draw names its provider and model", async () => {
	const original = globalThis.fetch;
	const sent: Array<Record<string, unknown>> = [];
	globalThis.fetch = async (_url, init) => {
		sent.push(JSON.parse(String(init?.body)));
		return new Response(JSON.stringify({ ok: true, status: "done", requestId: "r-1", urls: ["https://imgen.x.ai/a.png"], costUsdTicks: 200000000 }));
	};
	try {
		const out = await generateCandidates("Bread", "16:9", 3, undefined, { provider: "xai", model: IMAGE });
		assert.equal(out.ok, true);
		assert.deepEqual([sent[0].provider, sent[0].model, sent[0].n], ["xai", IMAGE, 3]);
	} finally {
		globalThis.fetch = original;
	}
});

test("spend per role: billed costs only, kept per provider, read back strictly, shown in USD", () => {
	let ledger = addSpend(emptySpend(), "build", "openrouter", 25_000_000);
	ledger = addSpend(ledger, "build", "openrouter", 5_000_000);
	ledger = addSpend(ledger, "media", "xai", null);
	assert.deepEqual(ledger, { build: { openrouter: 30_000_000 }, ask: {}, media: {}, design: {} });
	ledger = addSpend(ledger, "design", "openrouter", 10_000_000);
	assert.equal(ledger.design.openrouter, 10_000_000);
	assert.deepEqual(readSpend(JSON.parse(JSON.stringify(ledger))), ledger);
	assert.deepEqual(readSpend({ build: { xai: -1, openrouter: "3" } }), emptySpend());
	assert.equal(costTicks({ available: true, kind: "billed", currency: "USD", ticks: "12345", usd: "0.0000012345" }), 12345);
	assert.equal(costTicks({ available: true, kind: "estimated", amount: 1 }), null);
	assert.equal(costTicks({ available: false }), null);
	assert.equal(formatTicks(30_000_000), "$0.0030");
	assert.equal(formatTicks(1_234_000_000), "$0.12");
	assert.equal(formatTicks(0), "$0.00");
});

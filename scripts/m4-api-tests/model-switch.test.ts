import assert from "node:assert/strict";
import { test } from "node:test";
import {
	DEFAULT_CHAT_MODEL_ID,
	GROK_CHAT_MODELS,
	assertNoFallback,
	getChatModel,
	mapChatRunRequest,
	modelChoice,
	modelRunsToolLoop,
	resolveChatModelRequest
} from "../../packages/chat-agent/src/models.ts";

const CHAT_IDS = GROK_CHAT_MODELS.map((m) => m.id);
const IMAGE_IDS = ["grok-imagine-image", "grok-imagine-image-2.0"];

test("selector catalog is the five built-in text ids with labels", () => {
	assert.equal(GROK_CHAT_MODELS.length, 5);
	for (const model of GROK_CHAT_MODELS) {
		assert.ok(model.label.length > 0);
		assert.notEqual(model.label, model.id);
		assert.match(model.intendedRoleNote, /Not a technical capability claim/);
		assert.match(model.intendedRoleNote, /Not used for routing/);
	}
	assert.equal(DEFAULT_CHAT_MODEL_ID, "grok-4.20-0309-non-reasoning");
});

test("multi-agent model is listed but cannot run the client-side tool loop (honest reason, no substitute)", () => {
	const mapped = mapChatRunRequest(
		{ modelId: "grok-4.20-multi-agent-0309", brief: "same general scenario", scenarioId: "landing" },
		{ discoveredChatIds: CHAT_IDS }
	);
	assert.equal(mapped.ok, false);
	if (!mapped.ok) {
		assert.equal(mapped.code, "model_tools_unavailable");
		assert.equal(mapped.requestedId, "grok-4.20-multi-agent-0309");
		assert.match(mapped.message, /multi-agent/);
		assert.match(mapped.message, /No other model was substituted/);
	}
	const model = getChatModel("grok-4.20-multi-agent-0309");
	assert.equal(modelRunsToolLoop(model), false);
	assert.equal(modelRunsToolLoop(getChatModel("grok-build-0.1")), true);
});

test("grok-4.7 is disabled with an honest latency reason (no substitute)", () => {
	const mapped = mapChatRunRequest({ modelId: "grok-4.7", brief: "dashboard" }, { discoveredChatIds: CHAT_IDS });
	assert.equal(mapped.ok, false);
	if (!mapped.ok) {
		assert.equal(mapped.code, "model_too_slow");
		assert.match(mapped.message, /1-4 minutes/);
		assert.match(mapped.message, /No other model was substituted/);
	}
	assert.equal(modelRunsToolLoop(getChatModel("grok-4.7")), false);
});

test("each text model maps to itself on the run request", () => {
	const discovered = CHAT_IDS;
	for (const id of CHAT_IDS) {
		if (!modelRunsToolLoop(getChatModel(id))) continue;
		const mapped = mapChatRunRequest(
			{ modelId: id, brief: "same general scenario" },
			{ discoveredChatIds: discovered }
		);
		assert.equal(mapped.ok, true);
		if (mapped.ok) {
			assert.equal(mapped.request.modelId, id);
			assert.equal(mapped.request.brief, "same general scenario");
			assert.equal(mapped.request.live, true);
		}
	}
});

test("image models are not chat choices", () => {
	for (const id of IMAGE_IDS) {
		const mapped = mapChatRunRequest({ modelId: id, brief: "draw" }, { discoveredChatIds: CHAT_IDS });
		assert.equal(mapped.ok, false);
		if (!mapped.ok) {
			assert.equal(mapped.code, "image_model_not_for_chat");
			assert.equal(mapped.requestedId, id);
		}
	}
});

test("unavailable selected model does not fall back to the candidate", () => {
	const mapped = mapChatRunRequest(
		{ modelId: "grok-build-0.1", brief: "trial" },
		{ discoveredChatIds: ["grok-4.20-0309-non-reasoning"] }
	);
	assert.equal(mapped.ok, false);
	if (!mapped.ok) {
		assert.equal(mapped.code, "model_not_enabled_on_account");
		assert.equal(mapped.requestedId, "grok-build-0.1");
		assert.doesNotMatch(mapped.message, /grok-4.20-0309-non-reasoning/);
	}
	const missing = mapChatRunRequest({ brief: "trial" }, { discoveredChatIds: CHAT_IDS });
	assert.equal(missing.ok, false);
	if (!missing.ok) assert.equal(missing.code, "missing_model_id");
});

test("unknown ids and silent switches are rejected", () => {
	const unknown = resolveChatModelRequest({
		requestedId: "grok-invented",
		discoveredChatIds: CHAT_IDS
	});
	assert.equal(unknown.ok, false);
	if (!unknown.ok) assert.equal(unknown.code, "unknown_chat_model");
	assert.equal(assertNoFallback("grok-4.7", "grok-4.7"), null);
	const switched = assertNoFallback("grok-4.7", "grok-4.20-0309-non-reasoning");
	assert.ok(switched);
	assert.equal(switched.code, "silent_fallback_forbidden");
});

test("selector: a model the key does not list is off with its own reason, not the multi-agent one (grok-build-0.1, 2026-11-20)", () => {
	// The box key's /v1/models and /v1/language-models of 2026-11-20: the four grok-4.x ids, no grok-build-0.1.
	const listed = ["grok-4.20-0309-non-reasoning", "grok-4.20-0309-reasoning", "grok-4.20-multi-agent-0309", "grok-4.7"];
	const build = getChatModel("grok-build-0.1")!;
	assert.deepEqual(modelChoice(build, listed), { enabled: false, code: "model_not_enabled_on_account" });
	assert.deepEqual(modelChoice(build, null), { enabled: true }, "before the key is listed the manifest decides");
	assert.deepEqual(modelChoice(getChatModel("grok-4.20-0309-non-reasoning"), listed), { enabled: true });
	assert.deepEqual(modelChoice(getChatModel("grok-4.20-multi-agent-0309"), listed), { enabled: false, code: "multi_agent_tools_unavailable" });
	assert.deepEqual(modelChoice(getChatModel("grok-4.7"), listed), { enabled: false, code: "model_too_slow" });
	const sent = resolveChatModelRequest({ requestedId: "grok-build-0.1", discoveredChatIds: listed });
	assert.equal(sent.ok, false);
	assert.equal(!sent.ok && sent.code, "model_not_enabled_on_account");
});

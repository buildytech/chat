import assert from "node:assert/strict";
import { test } from "node:test";
import { PARENT_VERIFIED_CHAT_IDS, PARENT_VERIFIED_IMAGE_IDS } from "../../packages/builder-core/src/xai-env.ts";
import {
	DEFAULT_CHAT_MODEL_ID,
	GROK_CHAT_MODELS,
	assertNoFallback,
	getChatModel,
	mapChatRunRequest,
	modelRunsToolLoop,
	resolveChatModelRequest
} from "../../packages/builder-core/src/models.ts";

test("selector catalog is the five verified text ids with labels", () => {
	assert.equal(GROK_CHAT_MODELS.length, 5);
	assert.deepEqual(
		GROK_CHAT_MODELS.map((m) => m.id),
		[...PARENT_VERIFIED_CHAT_IDS]
	);
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
		{ discoveredChatIds: [...PARENT_VERIFIED_CHAT_IDS] }
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
	const mapped = mapChatRunRequest({ modelId: "grok-4.7", brief: "dashboard" }, { discoveredChatIds: [...PARENT_VERIFIED_CHAT_IDS] });
	assert.equal(mapped.ok, false);
	if (!mapped.ok) {
		assert.equal(mapped.code, "model_too_slow");
		assert.match(mapped.message, /1-4 minutes/);
		assert.match(mapped.message, /No other model was substituted/);
	}
	assert.equal(modelRunsToolLoop(getChatModel("grok-4.7")), false);
});

test("each text model maps to itself on the run request", () => {
	const discovered = [...PARENT_VERIFIED_CHAT_IDS];
	for (const id of PARENT_VERIFIED_CHAT_IDS) {
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
	for (const id of PARENT_VERIFIED_IMAGE_IDS) {
		const mapped = mapChatRunRequest({ modelId: id, brief: "draw" }, { discoveredChatIds: [...PARENT_VERIFIED_CHAT_IDS] });
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
	const missing = mapChatRunRequest({ brief: "trial" }, { discoveredChatIds: [...PARENT_VERIFIED_CHAT_IDS] });
	assert.equal(missing.ok, false);
	if (!missing.ok) assert.equal(missing.code, "missing_model_id");
});

test("unknown ids and silent switches are rejected", () => {
	const unknown = resolveChatModelRequest({
		requestedId: "grok-invented",
		discoveredChatIds: [...PARENT_VERIFIED_CHAT_IDS]
	});
	assert.equal(unknown.ok, false);
	if (!unknown.ok) assert.equal(unknown.code, "unknown_chat_model");
	assert.equal(assertNoFallback("grok-4.7", "grok-4.7"), null);
	const switched = assertNoFallback("grok-4.7", "grok-4.20-0309-non-reasoning");
	assert.ok(switched);
	assert.equal(switched.code, "silent_fallback_forbidden");
});

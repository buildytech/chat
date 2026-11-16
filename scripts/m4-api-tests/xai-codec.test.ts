import assert from "node:assert/strict";
import { test } from "node:test";
import { readXaiMessage, xaiMessage, xaiRefused } from "../../apps/xai-runtime/src/xai-codec.ts";

test("xAI codec preserves text parts and tool calls through the neutral protocol", () => {
	const message = readXaiMessage({ role: "assistant", content: [{ type: "text", text: "First" }, { type: "text", text: " second" }], tool_calls: [{ id: "one", type: "function", function: { name: "get_page", arguments: "{}" } }] });
	assert.deepEqual(message, { role: "assistant", text: "First second", calls: [{ id: "one", name: "get_page", argumentsJson: "{}" }] });
	assert.ok(message);
	assert.deepEqual(xaiMessage(message), { role: "assistant", content: "First second", tool_calls: [{ id: "one", type: "function", function: { name: "get_page", arguments: "{}" } }] });
	assert.deepEqual(xaiMessage({ role: "tool", callId: "one", name: "get_page", text: "{}" }), { role: "tool", tool_call_id: "one", name: "get_page", content: "{}" });
});

test("xAI codec refuses unsupported text, malformed calls and duplicate IDs", () => {
	const call = { id: "one", type: "function", function: { name: "get_page", arguments: "{}" } };
	for (const message of [null, { role: "user", content: "x" }, { role: "assistant", content: [{ type: "image", text: "x" }] }, { role: "assistant", tool_calls: [call, call] }, { role: "assistant", tool_calls: [{ ...call, function: { name: "get_page", arguments: {} } }] }]) assert.equal(readXaiMessage(message), null);
	assert.deepEqual(readXaiMessage({ role: "assistant", content: null, tool_calls: [call] }), { role: "assistant", text: "", calls: [{ id: "one", name: "get_page", argumentsJson: "{}" }] });
});

test("a refusal is explicit and its private text is not a normalized message", () => {
	const message = { role: "assistant", content: null, refusal: "private reason" };
	assert.equal(xaiRefused(message), true);
	assert.equal(readXaiMessage(message), null);
});

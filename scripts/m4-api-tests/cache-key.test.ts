import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { chatCacheKey, mapChatRunRequest } from "../../packages/chat-agent/src/index.ts";
import { createExecution } from "../../packages/chat-agent/src/agent/execution.ts";
import { MODEL } from "./agent-replay.ts";

test("the chat's prompt-cache key is stable per session, opaque, and checked by the runtime", () => {
	assert.equal(chatCacheKey("session-a"), chatCacheKey("session-a"));
	assert.notEqual(chatCacheKey("session-a"), chatCacheKey("session-b"));
	assert.doesNotMatch(chatCacheKey("session-a"), /session-a/);
	const body = { modelId: MODEL, brief: "x", expectedRevision: 0 };
	const kept = mapChatRunRequest({ ...body, cacheKey: chatCacheKey("s") }, { discoveredChatIds: [MODEL] });
	assert.ok(kept.ok && kept.request.cacheKey === chatCacheKey("s"));
	for (const bad of ["", "a b", "x".repeat(81), 7, "../etc"]) {
		const out = mapChatRunRequest({ ...body, cacheKey: bad }, { discoveredChatIds: [MODEL] });
		assert.ok(out.ok && !("cacheKey" in out.request), String(bad));
	}
	assert.match(readFileSync("apps/chat-web/src/modules/chat/core/turn.ts", "utf8"), /cacheKey: chatCacheKey\(session\.id\)/);
	assert.match(readFileSync("packages/provider-xai/src/turn.ts", "utf8"), /cacheKey: ctx\.cacheKey/);
});

test("every request of a run carries the session key; without one the run id is the key (page-loop@3)", async () => {
	const seen: Array<string | undefined> = [];
	const provider = async (input: { cacheKey?: string }) => { seen.push(input.cacheKey); return { ok: true as const, message: { role: "assistant" as const, text: "ok" } }; };
	const withKey = createExecution(MODEL, new AbortController().signal, provider, "run-1", { cacheKey: "chat-k" });
	await withKey.request({ messages: [], tools: [], toolChoice: "none" });
	await withKey.request({ messages: [], tools: [], toolChoice: "none" });
	const plain = createExecution(MODEL, new AbortController().signal, provider, "run-2", {});
	await plain.request({ messages: [], tools: [], toolChoice: "none" });
	assert.deepEqual(seen, ["chat-k", "chat-k", "run-2"]);
});

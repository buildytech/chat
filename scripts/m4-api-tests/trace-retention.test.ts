import assert from "node:assert/strict";
import { test } from "node:test";
import { retainTraces, TRACE_RETENTION_POLICY } from "../../apps/chat-web/src/modules/chat/core/trace-retention.ts";
import { retryMessage } from "../../apps/chat-web/src/modules/chat/core/retry-message.ts";
import { conversationForTurn } from "../../apps/chat-web/src/modules/chat/core/conversation.ts";
import { storageFootprint } from "../../apps/chat-web/src/lib/browser/storage-v1.ts";
import { startAttempt, endAttempt, aggregateStepUsage, readProviderUsage } from "../../packages/chat-agent/src/index.ts";
import { projectOfView } from "../../apps/chat-web/src/modules/chat/core/view.ts";
import { buildSessionFile, parseSessionFile, splitSessionFile } from "../../apps/chat-web/src/lib/browser/session-file.ts";
import type { Project } from "../../apps/chat-web/src/lib/project/types.ts";

const now = "2026-11-17T12:00:00.000Z";
const usage = aggregateStepUsage([readProviderUsage({ prompt_tokens: 10, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 7 }, cost_in_usd_ticks: "9007199254740993" })]);
function project(id: string, count: number): Project {
	const attempts = Object.fromEntries(Array.from({ length: count }, (_, index) => [`a${index}`, endAttempt(startAttempt(`a${index}`, "user", "provider/model", now), "completed", now, { usage, runId: `r${index}` })]));
	const traces = Object.fromEntries(Array.from({ length: count }, (_, index) => [`r${index}`, { format: "run-trace/1", runId: `r${index}`, modelId: "provider/model", fingerprint: "observed-fingerprint", startedAt: `${now}-${index.toString().padStart(3, "0")}`, stopReason: "answer", prefix: { secretBody: "diagnostic body" }, steps: [{ usage: { prompt: 10, completion: 2, cached: 7, cost_in_usd_ticks: "9007199254740993" } }], toolResults: [{ gate: { codes: ["unknown_item"] } }] }]));
	const base = projectOfView({ id, title: "Test", updatedAt: now, messages: [{ id: "user", role: "user", text: "Prompt", createdAt: now }], runAttempts: attempts }, null);
	return { ...base, ext: { ...base.ext, "agent-runs": attempts, "agent-trace": traces, other: { opaque: true } } };
}
const footprint = { coverage: "origin", otherEstimatedUtf16Bytes: 0 } as const;

test("explicit retry reuses the original user message, normal equal text does not", () => {
	const user = { id: "user", role: "user", text: "Same text", createdAt: now, mode: "ask" } as const;
	const session = { id: "s", title: "Test", updatedAt: now, messages: [user, { ...user, id: "error", role: "assistant" as const }], runAttempts: { failed: endAttempt(startAttempt("failed", user.id, "model", now), "error", now) } };
	assert.equal(retryMessage(session, "failed"), user);
	assert.equal(retryMessage(session, undefined), null);
	assert.equal(retryMessage(session, "unknown"), null);
	assert.ok(!conversationForTurn(session.messages, user.id).some((message) => message.role === "user"));
	assert.equal(session.messages.length, 2);
});

test("global trace count compacts oldest details while preserving exact billing and gate evidence", () => {
	const input = [project("s1", 15), project("s2", 15)];
	const snapshot = JSON.stringify(input);
	const output = retainTraces(input, footprint, now);
	const all = output.flatMap((row) => Object.values(row.ext["agent-trace"]!));
	const summaries = all.map((row) => JSON.parse(JSON.stringify(row))).filter((row) => row.retention);
	assert.equal(summaries.length, 30 - TRACE_RETENTION_POLICY.maxDetailedTraces);
	assert.equal(summaries[0].summary.cost_in_usd_ticks, "9007199254740993");
	assert.deepEqual(summaries[0].summary.gateCodes, ["unknown_item"]);
	assert.deepEqual(summaries[0].steps, []);
	assert.equal(summaries[0].fingerprint, "observed-fingerprint");
	assert.equal(JSON.stringify(input), snapshot);
	assert.deepEqual(output[0]!.ext.other, input[0]!.ext.other);
	const attempt = JSON.parse(JSON.stringify(output[0]!.ext["agent-runs"])).a0;
	assert.deepEqual(attempt.usage, JSON.parse(JSON.stringify(usage)));
	assert.equal(attempt.storage.format, "run-storage/1");
});

test("foreign origin storage triggers byte policy even for one small trace; unknown versions survive", () => {
	const input = project("s", 1);
	input.ext = { ...input.ext, "agent-storage": { format: "future-storage/2", opaque: true }, "agent-trace": { ...input.ext["agent-trace"], future: { format: "future-trace/9", payload: "preserve" } } };
	const output = retainTraces([input], { coverage: "origin", otherEstimatedUtf16Bytes: TRACE_RETENTION_POLICY.originEstimatedUtf16SoftLimitBytes }, now)[0]!;
	const trace = JSON.parse(JSON.stringify(output.ext["agent-trace"]));
	assert.equal(trace.r0.retention.reason, "origin_byte_budget");
	assert.deepEqual(trace.future, input.ext["agent-trace"]!.future);
	assert.deepEqual(output.ext["agent-storage"], input.ext["agent-storage"]);
});

test("whole-origin size includes foreign keys and labels unavailable enumeration honestly", () => {
	const values = new Map([["foreign", "abcdef"], ["buildy:v1:sessions", "old"]]);
	const store = { getItem: (key: string) => values.get(key) ?? null, setItem() {}, removeItem() {}, key: (index: number) => [...values.keys()][index] ?? null, length: values.size };
	assert.equal(storageFootprint(store, "buildy:v1:sessions").otherEstimatedUtf16Bytes, 2 * ("foreign".length + "abcdef".length));
	assert.equal(storageFootprint({ ...store, key: undefined }, "x").coverage, "unavailable");
});

test("byte retention can prune a single large run and keeps audit totals without inventing zero", () => {
	const input = project("s", 1);
	const trace = input.ext["agent-trace"]!.r0;
	input.ext = { ...input.ext, "agent-trace": { r0: { ...JSON.parse(JSON.stringify(trace)), prefix: { body: "x".repeat(TRACE_RETENTION_POLICY.maxTraceJsonUtf8Bytes + 10) } } } };
	const result = retainTraces([input], footprint, now)[0]!;
	const compact = JSON.parse(JSON.stringify(result.ext["agent-trace"])).r0;
	assert.equal(compact.retention.reason, "trace_byte_budget");
	assert.equal(compact.summary.cost_in_usd_ticks, "9007199254740993");
	assert.ok(compact.storage.jsonUtf8Bytes > TRACE_RETENTION_POLICY.maxTraceJsonUtf8Bytes);
});

test("portable export contract survives record split/rebuild with summaries and unknown extensions", () => {
	const rows = retainTraces([project("s", 1)], { ...footprint, aggressive: true }, now);
	const app = { name: "BuildY", version: "1", host: "browser" } as const;
	const pins = { registry: { url: "https://registry.buildy.tw", sourceCommit: "b".repeat(40) }, prototypes: { repo: "ui8kit/prototypes", commit: "b".repeat(40) } };
	const before = buildSessionFile({ chats: rows, pages: {}, selectedSessionId: "s", app, pins, now });
	const parsed = parseSessionFile(JSON.stringify(before));
	assert.ok(parsed.ok, JSON.stringify(parsed));
	if (!parsed.ok) return;
	const records = splitSessionFile(parsed.file);
	const after = buildSessionFile({ ...records, selectedSessionId: "s", app, pins, now });
	assert.deepEqual(after, before);
});

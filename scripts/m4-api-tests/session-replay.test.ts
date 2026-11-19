/**
 * Replays of two real staging exports (2026-11-16, buildy:v1, before the simple line; Ask and Build, grok-4.20):
 * - the import refuses them before anything is written (buildy:v2 only; their blocks are retired Stock items);
 * - the accounting replays: the per-step provider usage of the recorded run trace sums to the run's usage and
 *   billed cost exactly, and the runs sum to the chat's usage (cost_in_usd_ticks kept as exact strings).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { aggregateSessionUsage, aggregateStepUsage, readProviderUsage } from "../../packages/chat-agent/src/usage.ts";
import { parseSessionFile } from "../../apps/chat-web/src/lib/browser/session-file.ts";

type TraceStep = { usage: { prompt: number; completion: number; cached?: number; reasoning?: number; cost_in_usd_ticks?: string | null } };
type Message = { role: string; mode?: string; run?: { runId?: string; usage: Record<string, unknown> } };
type Exported = { format: string; sessions: Array<{ ext: { chat: { usage: Record<string, unknown>; messages: Message[] }; "agent-trace"?: Record<string, { stopReason: string; steps: TraceStep[] }> } }> };

const load = (name: string): { raw: string; file: Exported } => {
	const raw = readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
	return { raw, file: JSON.parse(raw) as Exported };
};
const ask = load("replay-v1-ask.json");
const build = load("replay-v1-build.json");

test("real buildy:v1 exports are refused at import (schema_invalid at $.format), nothing is read", () => {
	for (const { raw, file } of [ask, build]) {
		assert.equal(file.format, "buildy:v1");
		const parsed = parseSessionFile(raw);
		assert.equal(parsed.ok, false);
		if (!parsed.ok) {
			assert.equal(parsed.code, "schema_invalid");
			assert.ok(parsed.issues.some((i) => i.path === "$.format"), JSON.stringify(parsed.issues.slice(0, 3)));
		}
	}
});

test("Ask replay: the recorded trace steps sum to the run usage and its billed cost exactly", () => {
	const session = ask.file.sessions[0]!;
	const [runId, trace] = Object.entries(session.ext["agent-trace"] ?? {})[0]!;
	assert.equal(trace.stopReason, "answer");
	const steps = trace.steps.map((s) => readProviderUsage({
		prompt_tokens: s.usage.prompt,
		completion_tokens: s.usage.completion,
		cost_in_usd_ticks: s.usage.cost_in_usd_ticks ?? undefined,
		prompt_tokens_details: { cached_tokens: s.usage.cached ?? 0 },
		completion_tokens_details: { reasoning_tokens: s.usage.reasoning ?? 0 }
	}));
	const replayed = aggregateStepUsage(steps);
	const run = session.ext.chat.messages.find((m) => m.run?.runId === runId)!.run!;
	for (const key of ["status", "steps", "promptTokens", "completionTokens", "totalTokens", "cachedTokens", "reasoningTokens"]) {
		assert.deepEqual((replayed as Record<string, unknown>)[key], run.usage[key], key);
	}
	assert.deepEqual(replayed.cost, run.usage.cost, "billed ticks are exact");
	assert.equal(replayed.cost.available && replayed.cost.ticks, "319625500");
});

test("Ask and Build replays: the runs sum to the chat usage; Ask ran without a write tool", () => {
	for (const { file } of [ask, build]) {
		const chat = file.sessions[0]!.ext.chat;
		const runs = chat.messages.filter((m) => m.run).map((m) => m.run!.usage);
		const summed = aggregateSessionUsage(runs as never);
		for (const key of ["status", "runs", "promptTokens", "completionTokens", "totalTokens"]) assert.deepEqual((summed as Record<string, unknown>)[key], chat.usage[key], key);
		const recorded = chat.usage.cost as { available: boolean; ticks?: string };
		// The older Build export predates billed ticks: unknown stays unknown (never zero); the wording of the note changed since.
		assert.equal(summed.cost.available, recorded.available);
		if (recorded.available) assert.deepEqual(summed.cost, recorded);
	}
	const askTools = ask.file.sessions[0]!.ext.chat.messages.flatMap((m) => ((m.run as { tools?: string[] } | undefined)?.tools ?? []));
	assert.ok(askTools.length > 0 && !askTools.includes("write_page"), askTools.join());
});

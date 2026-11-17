import { aggregateSessionUsage, unknownUsage, type RunUsage } from "./usage.ts";
import type { ScenarioRef } from "./scenarios/compile.ts";

/** Host lifecycle, independent of transport, provider and assistant-message availability. */
export type RunAttempt = {
	format: "run-attempt/1"; attemptId: string; userMessageId: string; assistantMessageId?: string; retryOf?: string;
	modelId: string; scenario?: ScenarioRef; provider?: string; runId?: string;
	startedAt: string; endedAt?: string;
	status: "running" | "completed" | "error" | "aborted" | "superseded" | "interrupted";
	fingerprint?: string | null; providerVersion?: number; catalogDigest?: string; gateCodes?: string[]; cost_in_usd_ticks?: string;
	storage?: { format: string; capturedAt: string; trace: { jsonUtf8Bytes: number; estimatedUtf16Bytes: number }; [key: string]: unknown };
	traceRetention?: { state: string; reason: string; removedAt: string; policyVersion: number };
	code?: string; usage: RunUsage; traceState: "not_received" | "received";
};
export type RunAttempts = Record<string, RunAttempt>;

export function startAttempt(attemptId: string, userMessageId: string, modelId: string, startedAt: string): RunAttempt {
	return { format: "run-attempt/1", attemptId, userMessageId, modelId, startedAt, status: "running", usage: unknownUsage("error", 0), traceState: "not_received" };
}
export function endAttempt(attempt: RunAttempt, status: Exclude<RunAttempt["status"], "running">, endedAt: string, details: Partial<Pick<RunAttempt, "runId" | "assistantMessageId" | "provider" | "scenario" | "code" | "traceState" | "usage">> = {}): RunAttempt {
	const usage = details.usage ?? attempt.usage;
	return { ...attempt, ...details, status, endedAt, usage: status === "completed" ? usage : { ...usage, status: "incomplete", incompleteReason: status === "aborted" || status === "superseded" ? "cancelled" : "error" } };
}

/** Legacy message runs are counted only when no attempt already owns that message. */
export function usageOfAttempts(attempts: RunAttempts, messages: Array<{ id: string; run?: { usage: RunUsage } }>) {
	const values = Object.values(attempts);
	const owned = new Set(values.map((attempt) => attempt.assistantMessageId));
	return aggregateSessionUsage([...values.map((attempt) => attempt.usage), ...messages.filter((message) => !owned.has(message.id)).flatMap((message) => message.run ? [message.run.usage] : [])]);
}

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function count(value: unknown) { return value === "unknown" || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0); }
function isAttempt(value: unknown): value is RunAttempt {
 if (!record(value) || value.format !== "run-attempt/1" || typeof value.attemptId !== "string" || typeof value.userMessageId !== "string" || typeof value.modelId !== "string" || typeof value.startedAt !== "string") return false;
 if (!["running", "completed", "error", "aborted", "superseded", "interrupted"].includes(String(value.status)) || !["not_received", "received"].includes(String(value.traceState))) return false;
 if (!record(value.usage)) return false;
 const usage = value.usage;
 return ["complete", "incomplete"].includes(String(usage.status)) && typeof usage.steps === "number" && Number.isSafeInteger(usage.steps) && usage.steps >= 0 && count(usage.promptTokens) && count(usage.completionTokens) && count(usage.totalTokens) && record(usage.cost);
}
/** Unknown extension versions stay opaque; a host must not reinterpret or overwrite them. */
export function readRunAttempts(value: unknown): RunAttempts | null {
 if (!record(value)) return null;
 const entries: Array<[string, RunAttempt]> = [];
 for (const [id, attempt] of Object.entries(value)) {
  if (!isAttempt(attempt) || id !== attempt.attemptId) return null;
  entries.push([id, attempt]);
 }
 return Object.fromEntries(entries);
}

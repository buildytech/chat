import type { TraceStep, TraceBudgetLeft, TraceToolResult } from "./trace-records.ts";
import { catalogProvenance } from "@buildytech/builder-core";
import { fnv1a64 } from "../identity.ts";
import type { ExecutionBudget, CompiledScenario } from "../scenarios/compile.ts";
import type { AgentCall, AgentMessage, ProviderRequest, ProviderStep } from "./provider.ts";
import type { BudgetCounts } from "./budget.ts";
import type { PageProposal } from "./turn.ts";

/** Identity hashes, not cryptographic attestations. Sizes are UTF-8 bytes, never tokens. */
function body(value: unknown) {
	const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
	return { hash: `fnv1a64:${fnv1a64(text)}`, bytes: new TextEncoder().encode(text).length, body: value };
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }

export function createRunTrace(runId: string, modelId: string, budget: ExecutionBudget, counts: BudgetCounts, scenario?: CompiledScenario, deadline?: number) {
	const started = Date.now();
	const prefix: Record<string, unknown> = {};
	const steps: TraceStep[] = [];
	const toolResults: TraceToolResult[] = [];
	const trace = {
		format: "run-trace/1" as const, runId, modelId, scenario: scenario ? { id: scenario.profile.id, version: scenario.profile.version } : null,
		fingerprint: scenario?.fingerprint ?? null, providerVersion: scenario?.manifestVersion ?? null, provider: scenario?.profile.provider ?? "unknown",
		catalogDigest: catalogProvenance().sourceDigest, budget, startedAt: new Date(started).toISOString(),
		deadlineMs: deadline === undefined ? null : Math.max(0, deadline - started), stopReason: "running",
		prefix, steps, toolResults
	};
	let previous: AgentMessage[] = [];
	let loopSteps = 0;
	const left = (): TraceBudgetLeft => ({ steps: Math.max(0, budget.maxSteps - loopSteps), requests: Math.max(0, budget.maxRequests - counts.requests), tools: Math.max(0, budget.maxToolCalls - counts.toolCalls), writes: Math.max(0, budget.maxWriteAttempts - counts.writeAttempts), tokens: "unknown", maxCompletionTokensPerRequest: budget.maxTokens, timeMs: deadline === undefined ? "unknown" : Math.max(0, deadline - Date.now()) });
	return {
		trace,
		stop(reason: string) { trace.stopReason = reason; if (trace.steps.length) trace.steps.at(-1)!.budgetLeft = left(); },
		loopStep() { loopSteps += 1; },
		prefix(messages: AgentMessage[], tools: ProviderRequest["tools"]) {
			let context: unknown; try { context = JSON.parse(messages[1]?.text ?? "{}"); } catch { context = {}; }
			trace.prefix = { systemPrompt: body(messages[0]?.text ?? ""), tools: body(tools), context: record(context) ? Object.fromEntries(Object.entries(context).map(([key, value]) => [key, { ...body(value), stability: key === "itemIndex" ? "stable" : "variable" }])) : {} };
		},
		request(input: Pick<ProviderRequest, "messages" | "tools" | "toolChoice"> & { phase?: string; completionReason?: string }, nudged: boolean) {
			const initial = previous.length === 0;
			let retainedMessages = 0;
			while (retainedMessages < previous.length && retainedMessages < input.messages.length && JSON.stringify(previous[retainedMessages]) === JSON.stringify(input.messages[retainedMessages])) retainedMessages += 1;
			const additions = input.messages.slice(retainedMessages).map((message, index) => {
				const descriptor = body(message);
				return initial && index < 2 ? { role: message.role, hash: descriptor.hash, bytes: descriptor.bytes, source: "prefix" } : { role: message.role, ...descriptor };
			});
			const transcriptChange = retainedMessages < previous.length ? "replace" : "append";
			previous = structuredClone([...input.messages]);
			const step: TraceStep = { index: trace.steps.length + 1, startedAt: new Date().toISOString(), request: { retainedMessages, transcriptChange, ...(input.phase ? { phase: input.phase } : {}), ...(input.completionReason ? { completionReason: input.completionReason } : {}), toolChoice: input.toolChoice, parallelToolCalls: "unknown", completionTokenParameter: "unknown", tools: { hash: body(input.tools).hash, bytes: body(input.tools).bytes }, maxTokens: budget.maxTokens, nudged, messagesAdded: additions }, budgetLeft: left() };
			trace.steps.push(step);
			return (result: ProviderStep | null, latencyMs: number) => {
				if (result?.requestInfo) step.request = { ...step.request, promptCacheKeySent: result.requestInfo.promptCacheKeySent, parallelToolCalls: result.requestInfo.parallelToolCalls, completionTokenParameter: result.requestInfo.completionTokenParameter, maxTokens: result.requestInfo.maxTokens };
				step.response = { finish_reason: result?.response?.finishReason ?? "unknown", refusal: result?.response?.refusal ?? null, content: result?.ok ? body(result.message.text ?? null) : null, tool_calls: result?.ok ? result.message.calls?.map((call) => ({ id: call.id, name: call.name, arguments: body(call.argumentsJson) })) ?? [] : [], latencyMs, status: result?.response?.status ?? (result && !result.ok ? result.error.status : undefined) ?? "unknown", error: result && !result.ok ? result.error.code : result ? null : "provider_threw" };
				const usage = result?.usage;
				step.usage = { prompt: usage?.promptTokens ?? "unknown", completion: usage?.completionTokens ?? "unknown", cached: usage?.cachedTokens ?? "unknown", reasoning: usage?.reasoningTokens ?? "unknown", cost_in_usd_ticks: usage?.costUsdTicks ?? "unknown", cacheHitPercent: typeof usage?.promptTokens === "number" && usage.promptTokens > 0 && usage.cachedTokens !== undefined ? usage.cachedTokens / usage.promptTokens * 100 : "unknown" };
				step.budgetLeft = left();
			};
		},
		tool(call: AgentCall, result: unknown, durationMs: number, proposal: PageProposal | null, evidence?: unknown, executed = true) {
			const failed = record(result) && result.ok === false;
			const issues = record(result) && Array.isArray(result.issues) ? result.issues.filter(record).map((issue) => ({ path: typeof issue.path === "string" ? issue.path : "unknown", code: typeof issue.code === "string" ? issue.code : "unknown" })) : [];
			trace.toolResults.push({ step: trace.steps.length, callId: call.id, name: call.name, ...(evidence ? { evidence } : {}), args: body(call.argumentsJson), ok: !failed, result: body(result), durationMs, execution: executed ? "completed" : "skipped", ...(call.name === "write_page" ? { accepted: !failed, gate: { codes: issues.map((issue) => issue.code), issues, ...(failed && record(result) && typeof result.code === "string" ? { code: result.code } : {}) }, baseRevision: !failed && proposal ? proposal.baseRevision : null, pageRevision: null, revisionMeaning: "proposal_only_not_applied", diff: !failed && proposal ? body(proposal.diff) : null } : {}) });
			if (trace.steps.length) trace.steps.at(-1)!.budgetLeft = left();
		}
	};
}
export type RunTrace = ReturnType<typeof createRunTrace>["trace"];

/** Per-turn accounting survives provider throws, cancellation and deadline expiry. */
import { AGENT_BUDGET, type BudgetCounts } from "./budget.ts";
import { aggregateStepUsage, unknownUsage, type RunUsage, type StepUsage } from "../usage.ts";
import { turnMeta, type AgentProvider, type LiveTurnMeta, type ProviderRequest, type AgentMessage } from "./provider.ts";

type ExecutionStep = { ok: true; message: AgentMessage } | { ok: false; result: import("./turn.ts").AgentFailure; meta: LiveTurnMeta };

export type ExecutionOptions = { deadline?: number; onProviderError?: (error: unknown) => void };

export function createExecution(modelId: string, signal: AbortSignal, provider: AgentProvider, runId: string, options: ExecutionOptions) {
	const trace = { runId, steps: 0, toolCallingWorked: false, toolsCalled: [] as string[] };
	const stepUsage: StepUsage[] = [];
	const counts: BudgetCounts = { requests: 0, toolCalls: 0, writeAttempts: 0 };
	let incomplete: RunUsage["incompleteReason"];
	const finish = (): LiveTurnMeta => {
		const reason = incomplete ?? (stepUsage.length < counts.requests ? "error" : undefined);
		const usage = stepUsage.length ? aggregateStepUsage(stepUsage, reason ? { incomplete: reason } : undefined) : unknownUsage(reason ?? "error", counts.requests);
		return { ...turnMeta("chat-completions", modelId, trace.toolCallingWorked, counts.requests, trace.toolsCalled, usage, runId), budget: { ...counts } };
	};
	const fail = (code: string, message: string): ExecutionStep => ({ ok: false, result: { ok: false, code, message }, meta: finish() });
	const stopped = (): ExecutionStep | null => {
		const timeout = signal.reason instanceof Error && signal.reason.name === "TimeoutError";
		if (signal.aborted || (options.deadline !== undefined && Date.now() >= options.deadline)) {
			incomplete = timeout || (!signal.aborted && options.deadline !== undefined) ? "timeout" : "cancelled";
			return fail(incomplete === "timeout" ? "runtime_timeout" : "aborted", incomplete === "timeout" ? "The run deadline was reached. No further work was started." : "The run was cancelled.");
		}
		return null;
	};
	const request = async (input: Omit<ProviderRequest, "modelId" | "signal" | "maxTokens">): Promise<ExecutionStep> => {
		const stop = stopped();
		if (stop) return stop;
		if (counts.requests >= AGENT_BUDGET.maxRequests) return fail("request_budget", "The provider request budget was reached. No additional request was sent.");
		counts.requests += 1;
		trace.steps = counts.requests;
		try {
			const result = await provider({ ...input, modelId, signal, maxTokens: AGENT_BUDGET.maxTokens });
			if (result.usage) stepUsage.push(result.usage);
			const stop = stopped();
			if (stop) return stop;
			if (!result.ok) return { ok: false, result: { ok: false, code: result.error.code, message: result.error.message }, meta: { ...finish(), providerStatus: result.error.status, providerMs: result.error.elapsedMs } };
			return { ok: true, message: result.message };
		} catch (error) {
			const stop = stopped();
			if (stop) return stop;
			incomplete = "error";
			options.onProviderError?.(error);
			return fail("provider_failed", "The provider request failed. No automatic retry was sent.");
		}
	};
	return { trace, counts, finish, request, stopped };
}

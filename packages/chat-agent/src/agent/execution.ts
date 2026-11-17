import { createRunTrace } from "./run-trace.ts";
import { CURRENT_EXECUTION_POLICY, retryDelay, waitForRetry } from "./execution-policy.ts";
/** Per-turn accounting survives provider throws, cancellation and deadline expiry. */
import { AGENT_BUDGET, type BudgetCounts } from "./budget.ts";
import { aggregateStepUsage, unknownUsage, type RunUsage, type StepUsage } from "../usage.ts";
import { turnMeta, type AgentProvider, type LiveTurnMeta, type ProviderRequest, type AgentMessage } from "./provider.ts";

type ExecutionStep = { ok: true; message: AgentMessage } | { ok: false; result: import("./turn.ts").AgentFailure; meta: LiveTurnMeta };

import type { CompiledScenario } from "../scenarios/compile.ts";

export type ExecutionOptions = { scenario?: CompiledScenario; deadline?: number; onProviderError?: (error: unknown) => void };

export function createExecution(modelId: string, signal: AbortSignal, provider: AgentProvider, runId: string, options: ExecutionOptions) {
	const budget = options.scenario?.budget ?? AGENT_BUDGET;
	const policy = options.scenario?.executionPolicy ?? CURRENT_EXECUTION_POLICY;
	let retriesUsed = 0;
	const trace = { runId, steps: 0, toolCallingWorked: false, toolsCalled: [] as string[] };
	const stepUsage: StepUsage[] = [];
	const counts: BudgetCounts = { requests: 0, toolCalls: 0, writeAttempts: 0 };
	const recorder = createRunTrace(runId, modelId, budget, counts, options.scenario, options.deadline);
	let incomplete: RunUsage["incompleteReason"];
	const finish = (): LiveTurnMeta => {
		const reason = incomplete ?? (stepUsage.length < counts.requests ? "error" : undefined);
		const usage = stepUsage.length ? aggregateStepUsage(stepUsage, { incomplete: reason, requests: counts.requests, providerId: options.scenario?.profile.provider }) : unknownUsage(reason ?? "error", counts.requests);
		return { ...turnMeta("chat-completions", modelId, trace.toolCallingWorked, counts.requests, trace.toolsCalled, usage, runId), budget: { ...counts }, providerRetries: retriesUsed, runTrace: structuredClone(recorder.trace), ...(options.scenario ? { scenario: { id: options.scenario.profile.id, version: options.scenario.profile.version, fingerprint: options.scenario.fingerprint, provider: options.scenario.profile.provider, providerVersion: options.scenario.manifestVersion, modelId } } : {}) };
	};
	const fail = (code: string, message: string): Extract<ExecutionStep, { ok: false }> => { recorder.stop(code); return { ok: false, result: { ok: false, code, message }, meta: finish() }; };
	const stopped = (): Extract<ExecutionStep, { ok: false }> | null => {
		const timeout = signal.reason instanceof Error && signal.reason.name === "TimeoutError";
		if (signal.aborted || (options.deadline !== undefined && Date.now() >= options.deadline)) {
			incomplete = timeout || (!signal.aborted && options.deadline !== undefined) ? "timeout" : "cancelled";
			return fail(incomplete === "timeout" ? "runtime_timeout" : "aborted", incomplete === "timeout" ? "The run deadline was reached. No further work was started." : "The run was cancelled.");
		}
		return null;
	};
	const failure = (error: unknown) => {
		const stop = stopped();
		if (stop) return stop;
		incomplete = "error";
		try { options.onProviderError?.(error); } catch { /* Diagnostics cannot erase billed usage. */ }
		return fail("provider_failed", "The execution failed. Thrown errors are not retried.");
	};
	const request = async (input: Omit<ProviderRequest, "modelId" | "signal" | "maxTokens" | "provider"> & { nudged?: boolean }): Promise<ExecutionStep> => {
		const stop = stopped();
		if (stop) return stop;
		if (counts.requests >= budget.maxRequests) return fail("request_budget", "The provider request budget was reached. No additional request was sent.");
		try {
			let result;
			let pendingRetry = false;
			while (true) {
				const stop = stopped();
				if (stop) return stop;
				if (counts.requests >= budget.maxRequests) return fail("request_budget", "The provider request budget was reached.");
				if (pendingRetry) { retriesUsed += 1; pendingRetry = false; }
				counts.requests += 1;
				trace.steps = counts.requests;
				const completed = recorder.request(input, input.nudged ?? false);
				const started = Date.now();
				try { result = await provider({ ...input, modelId, signal, provider: options.scenario ? { id: options.scenario.profile.provider, version: options.scenario.manifestVersion } : undefined, maxTokens: budget.maxTokens }); } catch (error) { completed(null, Date.now() - started); throw error; }
				if (result.usage) stepUsage.push(result.usage);
				completed(result, Date.now() - started);
				const after = stopped();
				if (after) return after;
				if (result.ok || counts.requests >= budget.maxRequests) break;
				const delay = retryDelay(result.error, retriesUsed, policy, options.deadline === undefined ? Infinity : options.deadline - Date.now());
				if (delay === null) break;
				await waitForRetry(delay, signal);
				pendingRetry = true;
			}
			if (!result.ok) { recorder.stop(result.error.code); return { ok: false, result: { ok: false, code: result.error.code, message: result.error.message }, meta: { ...finish(), providerStatus: result.error.status, providerMs: result.error.elapsedMs } }; }
			return { ok: true, message: result.message };
		} catch (error) {
			return failure(error);
		}
	};
	return { recorder, trace, counts, finish, request, stopped, failure };
}

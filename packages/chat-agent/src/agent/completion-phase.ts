import type { ExecutionBudget } from "../scenarios/compile.ts";
import type { BudgetCounts } from "./budget.ts";

type CompletionReserve = { reservedSteps: number; reservedRequests: number; reservedToolCalls: number; reservedTimeMs: number };

/** Completion gets a bounded reserve; catalog reading cannot spend it. */
export function completionPhase(budget: ExecutionBudget, counts: BudgetCounts, steps: number, repairing: boolean, reserve: CompletionReserve | undefined, remainingMs = Infinity) {
	const reason = !reserve ? null : remainingMs <= reserve.reservedTimeMs ? "reserved_time" : steps >= budget.maxSteps - reserve.reservedSteps ? "reserved_steps" : counts.requests >= budget.maxRequests - reserve.reservedRequests ? "reserved_requests" : counts.toolCalls >= budget.maxToolCalls - reserve.reservedToolCalls ? "reserved_tools" : null;
	return { phase: repairing ? "repair" : reason ? "write" : "read", forceWrite: Boolean(reason), reason };
}

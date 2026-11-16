import { COST_UNAVAILABLE, readBilledTicks, aggregateBilledCost, storedCostPart, type UsageCost } from "./cost.ts";
export { COST_UNAVAILABLE, billedCostForDisplay } from "./cost.ts";

/** Provider usage. Unknown is the string "unknown", never 0, for cancelled/error paths. */

type TokenCount = number | "unknown";

export type StepUsage = {
	promptTokens: TokenCount;
	completionTokens: TokenCount;
	totalTokens: TokenCount;
	reasoningTokens?: number;
	cachedTokens?: number;
	costUsdTicks?: string;
};

export type RunUsage = {
	status: "complete" | "incomplete";
	incompleteReason?: "cancelled" | "error" | "timeout";
	steps: number;
	reportedSteps?: number;
	promptTokens: TokenCount;
	completionTokens: TokenCount;
	totalTokens: TokenCount;
	reasoningTokens?: number;
	cachedTokens?: number;
	/** Who produced the token counts. Never a local snapshot byte size. */
	reportedBy: "xai-provider" | "none";
	/** How prompt/completion were combined when reportedBy is xai-provider. */
	aggregation?: "sum-of-tool-loop-requests";
	/** Last provider usage object in the loop, when present. */
	lastStep?: StepUsage;
	cost: UsageCost;
};

export type SessionUsage = {
	status: "complete" | "incomplete";
	runs: number;
	incompleteRuns: number;
	promptTokens: TokenCount;
	completionTokens: TokenCount;
	totalTokens: TokenCount;
	reasoningTokens?: number;
	cachedTokens?: number;
	cost: UsageCost;
};

export function unknownUsage(reason: RunUsage["incompleteReason"], steps = 0): RunUsage {
	return {
		status: "incomplete",
		incompleteReason: reason,
		steps,
		reportedSteps: 0,
		promptTokens: "unknown",
		completionTokens: "unknown",
		totalTokens: "unknown",
		reportedBy: "none",
		cost: COST_UNAVAILABLE
	};
}

function asCount(value: unknown): number | null {
	if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
	return null;
}

/** Read one provider usage object. Missing fields stay absent; never invent 0. */
export function readProviderUsage(raw: unknown): StepUsage | null {
	if (!raw || typeof raw !== "object") return null;
	const u = raw as Record<string, unknown>;
	const prompt = asCount(u.prompt_tokens ?? u.inputTokens ?? u.promptTokens);
	const completion = asCount(u.completion_tokens ?? u.outputTokens ?? u.completionTokens);
	const total = asCount(u.total_tokens ?? u.totalTokens);
	const ticks = readBilledTicks(u.cost_in_usd_ticks);
	if (prompt === null && completion === null && total === null && ticks === undefined) return null;
	const details =
		u.completion_tokens_details && typeof u.completion_tokens_details === "object"
			? (u.completion_tokens_details as Record<string, unknown>)
			: u.outputTokenDetails && typeof u.outputTokenDetails === "object"
				? (u.outputTokenDetails as Record<string, unknown>)
				: null;
	const promptDetails =
		u.prompt_tokens_details && typeof u.prompt_tokens_details === "object"
			? (u.prompt_tokens_details as Record<string, unknown>)
			: null;
	const reasoning = asCount(details?.reasoning_tokens ?? details?.reasoningTokens);
	const cached = asCount(promptDetails?.cached_tokens ?? promptDetails?.cacheTokens);
	const step: StepUsage = {
		promptTokens: prompt ?? "unknown",
		completionTokens: completion ?? "unknown",
		totalTokens: total ?? (prompt !== null && completion !== null ? addCount(prompt, completion) : "unknown")
	};
	if (reasoning !== null) step.reasoningTokens = reasoning;
	if (cached !== null) step.cachedTokens = cached;
	if (ticks !== undefined) step.costUsdTicks = ticks;
	return step;
}

function addCount(a: TokenCount, b: TokenCount): TokenCount {
	if (a === "unknown" || b === "unknown") return "unknown";
	const total = a + b;
	return Number.isSafeInteger(total) ? total : "unknown";
}

/** Sum tool-loop steps. Uses prompt+completion per step; does not add total on top of those. */
export function aggregateStepUsage(steps: Array<StepUsage | null | undefined>, opts?: { incomplete?: RunUsage["incompleteReason"]; requests?: number }): RunUsage {
	const requests = opts?.requests ?? steps.length;
	const present = steps.filter((s): s is StepUsage => Boolean(s));
	if (opts?.incomplete) {
		if (present.length === 0) return unknownUsage(opts.incomplete, requests);
	}
	if (present.length === 0) {
		return unknownUsage(opts?.incomplete ?? "error", requests);
	}
	let prompt: TokenCount = 0;
	let completion: TokenCount = 0;
	let reasoning = 0;
	let cached = 0;
	let sawReasoning = false;
	let sawCached = false;
	for (const step of present) {
		prompt = addCount(prompt, step.promptTokens);
		completion = addCount(completion, step.completionTokens);
		if (typeof step.reasoningTokens === "number") {
			sawReasoning = true;
			reasoning += step.reasoningTokens;
		}
		if (typeof step.cachedTokens === "number") {
			sawCached = true;
			cached += step.cachedTokens;
		}
	}
	const total: TokenCount =
		addCount(prompt, completion);
	const last = present[present.length - 1];
	const reason = opts?.incomplete ?? (present.length < requests || prompt === "unknown" || completion === "unknown" ? "error" : undefined);
	const parts = present.map((step) => ({ ticks: step.costUsdTicks, reportedRequests: step.costUsdTicks === undefined ? 0 : 1, requests: 1, complete: step.costUsdTicks !== undefined }));
	if (requests > present.length) parts.push({ ticks: undefined, reportedRequests: 0, requests: requests - present.length, complete: false });
	const run: RunUsage = {
		status: reason ? "incomplete" : "complete",
		incompleteReason: reason,
		steps: requests,
		reportedSteps: present.length,
		promptTokens: prompt,
		completionTokens: completion,
		totalTokens: total,
		reportedBy: "xai-provider",
		aggregation: "sum-of-tool-loop-requests",
		lastStep: last,
		cost: aggregateBilledCost(parts)
	};
	if (sawReasoning && Number.isSafeInteger(reasoning)) run.reasoningTokens = reasoning;
	if (sawCached && Number.isSafeInteger(cached)) run.cachedTokens = cached;
	return run;
}

export function aggregateSessionUsage(runs: RunUsage[]): SessionUsage {
	if (runs.length === 0) {
		return {
			status: "complete",
			runs: 0,
			incompleteRuns: 0,
			promptTokens: 0,
			completionTokens: 0,
			totalTokens: 0,
			cost: COST_UNAVAILABLE
		};
	}
	const incompleteRuns = runs.filter((r) => r.status === "incomplete").length;
	let prompt: TokenCount = 0;
	let completion: TokenCount = 0;
	let reasoning = 0;
	let cached = 0;
	let sawReasoning = false;
	let sawCached = false;
	for (const run of runs) {
		prompt = addCount(prompt, run.promptTokens);
		completion = addCount(completion, run.completionTokens);
		if (typeof run.reasoningTokens === "number") {
			sawReasoning = true;
			reasoning += run.reasoningTokens;
		}
		if (typeof run.cachedTokens === "number") {
			sawCached = true;
			cached += run.cachedTokens;
		}
	}
	const session: SessionUsage = {
		status: incompleteRuns > 0 ? "incomplete" : "complete",
		runs: runs.length,
		incompleteRuns,
		promptTokens: prompt,
		completionTokens: completion,
		totalTokens: prompt === "unknown" || completion === "unknown" ? "unknown" : prompt + completion,
		cost: aggregateBilledCost(runs.map((run) => storedCostPart(run.cost, run.steps)))
	};
	if (sawReasoning && Number.isSafeInteger(reasoning)) session.reasoningTokens = reasoning;
	if (sawCached && Number.isSafeInteger(cached)) session.cachedTokens = cached;
	return session;
}

/** Never invent a dollar amount. Official rates are not pinned in this repo. */
export function costForModel(_modelId: string, usage: RunUsage): UsageCost {
	return usage.cost.available && usage.cost.kind === "billed" ? usage.cost : COST_UNAVAILABLE;
}

export function formatTokens(value: TokenCount): string {
	return value === "unknown" ? "UNKNOWN" : String(value);
}

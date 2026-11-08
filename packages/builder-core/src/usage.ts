/** Provider usage. Unknown is the string "unknown", never 0, for cancelled/error paths. */

export type TokenCount = number | "unknown";

export type StepUsage = {
	promptTokens: TokenCount;
	completionTokens: TokenCount;
	totalTokens: TokenCount;
	reasoningTokens?: number;
	cachedTokens?: number;
};

export type RunUsage = {
	status: "complete" | "incomplete";
	incompleteReason?: "cancelled" | "error" | "timeout";
	steps: number;
	promptTokens: TokenCount;
	completionTokens: TokenCount;
	totalTokens: TokenCount;
	reasoningTokens?: number;
	cachedTokens?: number;
	cost: CostUnavailable | CostEstimate;
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
	cost: CostUnavailable;
};

export type CostUnavailable = {
	available: false;
	reason: "no_official_current_rates_in_repo";
	note: "Dollar cost is shown only when official current rates for the exact model id are confirmed, with source and date, and marked estimated vs billed. Generic or remembered prices are not used.";
};

export type CostEstimate = {
	available: true;
	kind: "estimated";
	currency: "USD";
	amount: number;
	modelId: string;
	source: string;
	asOf: string;
	vsBilled: "estimated_not_billed";
};

export const COST_UNAVAILABLE: CostUnavailable = {
	available: false,
	reason: "no_official_current_rates_in_repo",
	note: "Dollar cost is shown only when official current rates for the exact model id are confirmed, with source and date, and marked estimated vs billed. Generic or remembered prices are not used."
};

export function unknownUsage(reason: RunUsage["incompleteReason"], steps = 0): RunUsage {
	return {
		status: "incomplete",
		incompleteReason: reason,
		steps,
		promptTokens: "unknown",
		completionTokens: "unknown",
		totalTokens: "unknown",
		cost: COST_UNAVAILABLE
	};
}

function asCount(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
	return null;
}

/** Read one provider usage object. Missing fields stay absent; never invent 0. */
export function readProviderUsage(raw: unknown): StepUsage | null {
	if (!raw || typeof raw !== "object") return null;
	const u = raw as Record<string, unknown>;
	const prompt = asCount(u.prompt_tokens ?? u.inputTokens ?? u.promptTokens);
	const completion = asCount(u.completion_tokens ?? u.outputTokens ?? u.completionTokens);
	const total = asCount(u.total_tokens ?? u.totalTokens);
	if (prompt === null && completion === null && total === null) return null;
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
		totalTokens: total ?? (prompt !== null && completion !== null ? prompt + completion : "unknown")
	};
	if (reasoning !== null) step.reasoningTokens = reasoning;
	if (cached !== null) step.cachedTokens = cached;
	return step;
}

function addCount(a: TokenCount, b: TokenCount): TokenCount {
	if (a === "unknown" || b === "unknown") return "unknown";
	return a + b;
}

/** Sum tool-loop steps. Uses prompt+completion per step; does not add total on top of those. */
export function aggregateStepUsage(steps: Array<StepUsage | null | undefined>, opts?: { incomplete?: RunUsage["incompleteReason"] }): RunUsage {
	const present = steps.filter((s): s is StepUsage => Boolean(s));
	if (opts?.incomplete) {
		if (present.length === 0) return unknownUsage(opts.incomplete, steps.length);
	}
	if (present.length === 0) {
		return unknownUsage(opts?.incomplete ?? "error", 0);
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
		prompt === "unknown" || completion === "unknown" ? "unknown" : prompt + completion;
	const run: RunUsage = {
		status: opts?.incomplete ? "incomplete" : "complete",
		incompleteReason: opts?.incomplete,
		steps: present.length,
		promptTokens: prompt,
		completionTokens: completion,
		totalTokens: total,
		cost: COST_UNAVAILABLE
	};
	if (sawReasoning) run.reasoningTokens = reasoning;
	if (sawCached) run.cachedTokens = cached;
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
		cost: COST_UNAVAILABLE
	};
	if (sawReasoning) session.reasoningTokens = reasoning;
	if (sawCached) session.cachedTokens = cached;
	return session;
}

/** Never invent a dollar amount. Official rates are not pinned in this repo. */
export function costForModel(_modelId: string, _usage: RunUsage): CostUnavailable {
	return COST_UNAVAILABLE;
}

export function formatTokens(value: TokenCount): string {
	return value === "unknown" ? "UNKNOWN" : String(value);
}

import type { ProviderRequest } from "./provider.ts";

type TraceBody = { hash: string; bytes: number; body?: unknown };
type UnknownNumber = number | "unknown";
export type TraceBudgetLeft = { steps: number; requests: number; tools: number; writes: number; tokens: "unknown"; maxCompletionTokensPerRequest: number; timeMs: UnknownNumber };
export type TraceStep = {
	index: number; startedAt: string; budgetLeft: TraceBudgetLeft;
	request: { retainedMessages?: number; transcriptChange?: "append" | "replace"; promptCacheKeySent?: boolean; phase?: string; completionReason?: string; toolChoice: ProviderRequest["toolChoice"]; parallelToolCalls: boolean | "provider_default" | "unknown"; completionTokenParameter: string; tools: TraceBody; maxTokens: number; nudged: boolean; messagesAdded: Array<TraceBody & { role: string; source?: string }> };
	response?: { finish_reason: string; refusal: string | null; content: TraceBody | null; tool_calls: Array<{ id: string; name: string; arguments: TraceBody }>; latencyMs: number; status: UnknownNumber; error: string | null };
	usage?: { prompt: UnknownNumber; completion: UnknownNumber; cached: UnknownNumber; reasoning: UnknownNumber; cost_in_usd_ticks: string; cacheHitPercent: UnknownNumber };
};
export type TraceToolResult = {
	step: number; callId: string; name: string; args: TraceBody; ok: boolean; result: TraceBody;
	durationMs: number; execution: "completed" | "skipped"; evidence?: unknown;
	accepted?: boolean; baseRevision?: number | null; pageRevision?: null;
	revisionMeaning?: string; diff?: TraceBody | null;
	gate?: { codes: string[]; issues: Array<{ path: string; code: string; expected?: string; got?: unknown }>; code?: string };
};

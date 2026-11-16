import type { RunUsage, StepUsage } from "../usage.ts";
import type { ResolvedAgentTool } from "./agent-tools.ts";
import type { BudgetCounts } from "./budget.ts";

export type AgentCall = { id: string; name: string; argumentsJson: string };
export type AgentMessage = {
	role: "system" | "user" | "assistant" | "tool";
	text?: string;
	calls?: AgentCall[];
	callId?: string;
	name?: string;
};

export type LiveTurnMeta = {
	runId: string;
	path: "chat-completions";
	modelId: string;
	requestedModelId: string;
	toolCallingWorked: boolean;
	steps: number;
	toolsCalled: string[];
	usage: RunUsage;
	/** Actual attempted work, including named fallback and final no-tools requests. */
	budget?: BudgetCounts;
	scenario?: { id: string; version: number; fingerprint: string; provider: string; providerVersion: number; modelId: string };
	/** HTTP status of a failed provider request (status only; never the body). */
	providerStatus?: number;
	/** Wall time of the failed provider request in ms. */
	providerMs?: number;
};

export function turnMeta(
	path: LiveTurnMeta["path"],
	modelId: string,
	toolCallingWorked: boolean,
	steps: number,
	toolsCalled: string[],
	usage: RunUsage,
	runId: string
): LiveTurnMeta {
	return { runId, path, modelId, requestedModelId: modelId, toolCallingWorked, steps, toolsCalled, usage };
}


export type ProviderStep =
	| { ok: true; message: AgentMessage; usage?: StepUsage }
	| { ok: false; error: { code: string; message: string; status?: number; elapsedMs?: number }; usage?: StepUsage };

/** Transport input without credentials or endpoint; supplied by the runtime host. */
export type ProviderRequest = {
	provider?: { id: string; version: number };
	modelId: string;
	messages: readonly AgentMessage[];
	tools: readonly ResolvedAgentTool[];
	toolChoice: "auto" | "none" | "required" | { name: string };
	maxTokens: number;
	signal: AbortSignal;
};
export type AgentProvider = (input: ProviderRequest) => Promise<ProviderStep>;

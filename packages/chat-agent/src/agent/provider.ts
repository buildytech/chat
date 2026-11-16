import type { AgentFailure } from "./turn.ts";
import type { RunUsage, StepUsage } from "../usage.ts";
import type { agentOpenAiTools } from "./agent-tools.ts";
import type { BudgetCounts } from "./budget.ts";

export type ChatMessage = {
	role: "system" | "user" | "assistant" | "tool";
	content?: string | null;
	tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
	tool_call_id?: string;
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
	| { ok: true; message: ChatMessage }
	| { ok: false; result: AgentFailure; meta: LiveTurnMeta };


/** Transport input without credentials or endpoint; supplied by the runtime host. */
export type ProviderRequest = {
	modelId: string;
	messages: ChatMessage[];
	tools: ReturnType<typeof agentOpenAiTools>;
	toolChoice: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
	maxTokens: number;
	signal: AbortSignal;
	stepUsage: StepUsage[];
	trace: { runId: string; steps: number; toolCallingWorked: boolean; toolsCalled: string[] };
};
export type AgentProvider = (input: ProviderRequest) => Promise<ProviderStep>;

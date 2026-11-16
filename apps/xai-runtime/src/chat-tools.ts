/** xAI runtime composition: install the gate, bind transport credentials, redact failures. */
import { DEFAULT_XAI_BASE_URL, runAgentLoop, turnMeta, safeErrorMessage, unknownUsage, type AgentReply, type AgentFailure, type LiveTurnMeta, type TurnContext } from "@buildytech/chat-agent";
import { installPropsGate } from "@buildytech/builder-core/props-gate";
import { providerStep } from "./xai-provider.ts";
installPropsGate();

function newRunId(): string {
	return `xai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}


type TurnResult = AgentReply | AgentFailure;

export async function runXaiCatalogTurn(apiKey: string, modelId: string, ctx: TurnContext, signal: AbortSignal, baseUrl: string = DEFAULT_XAI_BASE_URL): Promise<{ result: TurnResult; meta: LiveTurnMeta }> {
	try {
		return await runAgentLoop(modelId, ctx, signal, (input) => providerStep({ ...input, apiKey, baseUrl }), newRunId());
	} catch (err) {
		const safe = safeErrorMessage(err, [apiKey]);
		const aborted = safe.code === "AbortError" || safe.message.toLowerCase().includes("abort") || signal.aborted;
		// The caller only sees a generic failure; the function log must name the exception (redacted, 280 chars).
		if (!aborted) console.error(JSON.stringify({ runtime: "xai-grok", event: "xai_run_exception", modelId, name: err instanceof Error ? err.name : typeof err, code: safe.code, message: safe.message }));
		return {
			result: {
				ok: false,
				code: aborted ? "aborted" : "xai_chat_failed",
				message: aborted ? "The run was cancelled. Usage is unknown, not zero." : "The xAI chat request could not be completed. No automatic retry was sent."
			},
			meta: turnMeta("chat-completions", modelId, false, 0, [], unknownUsage(aborted ? "cancelled" : "error", 0), newRunId())
		};
	}
}

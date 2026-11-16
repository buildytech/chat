/** xAI runtime composition: install the gate, bind transport credentials, redact failures. */
import { DEFAULT_XAI_BASE_URL, resolveScenario, runAgentLoop, turnMeta, safeErrorMessage, unknownUsage, type AgentReply, type AgentFailure, type LiveTurnMeta, type TurnContext } from "@buildytech/chat-agent";
import { installPropsGate } from "@buildytech/builder-core/props-gate";
import { providerStep } from "@buildytech/provider-xai";
installPropsGate();

function newRunId(): string {
	return `xai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}


function logException(err: unknown, apiKey: string, modelId: string, signal: AbortSignal): void {
	const safe = safeErrorMessage(err, [apiKey]);
	if (!signal.aborted) console.error(JSON.stringify({ runtime: "xai-grok", event: "xai_run_exception", modelId, name: err instanceof Error ? err.name : typeof err, code: safe.code, message: safe.message }));
}

type TurnResult = AgentReply | AgentFailure;

export async function runXaiCatalogTurn(apiKey: string, modelId: string, ctx: TurnContext, signal: AbortSignal, baseUrl: string = DEFAULT_XAI_BASE_URL, deadline?: number): Promise<{ result: TurnResult; meta: LiveTurnMeta }> {
	try {
		const compiled = resolveScenario(ctx.mode, modelId, ctx.scenario);
		if (!compiled.ok || compiled.scenario.profile.provider !== "xai") return { result: { ok: false, code: "invalid_scenario", message: "The scenario could not be resolved.", issues: (compiled.ok ? [{ path: "/provider", code: "adapter_mismatch" }] : compiled.issues).map((issue) => ({ ...issue, expected: "registered compatible scenario" })) }, meta: turnMeta("chat-completions", modelId, false, 0, [], unknownUsage("error", 0), newRunId()) };
		const turn = await runAgentLoop(modelId, ctx, signal, (input) => providerStep({ ...input, apiKey, baseUrl }), newRunId(), { scenario: compiled.scenario, deadline, onProviderError: (error) => logException(error, apiKey, modelId, signal) });
		if (!turn.result.ok && turn.result.code === "provider_failed") return { ...turn, result: { ...turn.result, code: "xai_chat_failed", message: "The xAI chat request could not be completed." } };
		return turn;
	} catch (err) {
		const safe = safeErrorMessage(err, [apiKey]);
		const aborted = safe.code === "AbortError" || safe.message.toLowerCase().includes("abort") || signal.aborted;
		// The caller only sees a generic failure; the function log must name the exception (redacted, 280 chars).
		if (!aborted) logException(err, apiKey, modelId, signal);
		return {
			result: {
				ok: false,
				code: aborted ? "aborted" : "xai_chat_failed",
				message: aborted ? "The run was cancelled. Usage is unknown, not zero." : "The xAI chat request could not be completed."
			},
			meta: turnMeta("chat-completions", modelId, false, 0, [], unknownUsage(aborted ? "cancelled" : "error", 0), newRunId())
		};
	}
}

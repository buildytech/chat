/**
 * xAI runtime composition: install the gate and bind the runtime's key and log sink to the shared catalog turn, which
 * lives in @buildytech/provider-xai/wire so the desktop webview runs the same loop (ADR 0065). The key never leaves here
 * except on the provider request; failures are redacted with it.
 */
import { DEFAULT_XAI_BASE_URL, type TurnContext } from "@buildytech/chat-agent";
import { installPropsGate } from "@buildytech/builder-core/props-gate";
import { runCatalogTurn } from "@buildytech/provider-xai/wire";
installPropsGate();

export { turnAnswer, turnInput } from "@buildytech/provider-xai/wire";

/** The sanitized exception line: event, model, error name, redacted code and message. */
const log = (event: Record<string, unknown>) => console.error(JSON.stringify(event));

export function runXaiCatalogTurn(apiKey: string, modelId: string, ctx: TurnContext, signal: AbortSignal, baseUrl: string = DEFAULT_XAI_BASE_URL, deadline?: number) {
	return runCatalogTurn(apiKey, modelId, ctx, signal, baseUrl, deadline, { log });
}

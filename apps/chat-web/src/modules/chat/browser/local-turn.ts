/**
 * The desktop host's turn (ADR 0065): a host whose status says `capabilities.loop: "client"` runs no agent loop; the
 * webview runs the same catalog turn as the runtime (@buildytech/provider-xai/wire) and sends each model request to the
 * host's same-origin forward, which puts the key it holds on it. The webview never sees a key: it sends HOST_HELD_KEY.
 * The steps mirror the runtime's POST /v1/run (apps/xai-runtime/src/http.ts handleRun) and answer with the same
 * Response, so the caller reads both the same way. No SvelteKit import: the node tests run this file.
 * The write gates must be loaded first (send.ts awaits loadPropsGate); the turn's own writes are judged strictly
 * (a block that shows nothing fails, as on the runtime) while the preview keeps its own policy between model calls.
 */
import { clampRunBudgetMs, contractFingerprint, mapChatRunRequest } from "@buildytech/chat-agent";
import { HOST_HELD_KEY, OPENROUTER_FORWARD_BASE, runCatalogTurn, turnAnswer, turnInput } from "@buildytech/provider-xai/wire";

/** The host's forward of xAI Chat Completions (POST <base>/chat/completions only). */
export const LOCAL_XAI_BASE = "/runtime/v1/xai";

type LocalTurnStatus = {
	ready: boolean;
	code: string;
	key?: { present: boolean };
	models?: { listed?: boolean; chatIds?: string[] };
	/** Signed in with OpenRouter, the turn goes to the host's OpenRouter forward (ADR 0067). */
	provider?: { id: "xai" | "openrouter" };
};

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

export async function runLocalTurn(body: Record<string, unknown>, status: LocalTurnStatus, signal?: AbortSignal, baseUrl?: string): Promise<Response> {
	const wire = status.provider?.id === "openrouter" ? "openrouter" : "xai";
	const base = baseUrl ?? (wire === "openrouter" ? OPENROUTER_FORWARD_BASE : LOCAL_XAI_BASE);
	const modelId = typeof body.modelId === "string" ? body.modelId : "";
	if (body.contract !== contractFingerprint()) return json(409, { ok: false, code: "client_outdated", message: "This tab runs an older version of the app. Reload the page to continue.", modelId, requestedModelId: modelId, liveModel: false });
	const mapped = mapChatRunRequest(body, { discoveredChatIds: status.models?.listed ? status.models.chatIds : undefined, allowUnlistedTrial: !status.ready });
	if (!mapped.ok) return json(422, { ok: false, code: mapped.code, message: mapped.message, requestedId: mapped.requestedId, liveModel: false });
	if (status.key && !status.key.present) return json(503, { error: wire === "openrouter" ? { code: "openrouter_key_missing", message: "Not signed in with OpenRouter on this computer. No provider call was made." } : { code: "xai_api_key_missing", message: "No xAI key is stored on this computer. No provider call was made." }, liveModel: false, modelId: mapped.request.modelId });
	if (!status.ready) return json(503, { error: { code: status.code, message: "xAI runtime is not ready. This is not a live Grok reply. No provider call was made." }, modelId: mapped.request.modelId, liveModel: false });
	const ms = clampRunBudgetMs(body.abortMs, {});
	const timeout = AbortSignal.timeout(ms);
	const run = signal ? AbortSignal.any([signal, timeout]) : timeout;
	const turn = await runCatalogTurn(HOST_HELD_KEY, mapped.request.modelId, turnInput(mapped.request), run, base, Date.now() + ms, { strictRenderWrites: true, wire });
	const answer = turnAnswer(mapped.request, turn, ms, Boolean(signal?.aborted));
	return json(answer.status, answer.body);
}

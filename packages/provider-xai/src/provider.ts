/** xAI Chat Completions transport. No page writes or agent-loop decisions. */
import { assertNoFallback, readProviderUsage, type ProviderRequest, type ProviderStep } from "@buildytech/chat-agent";

import { xaiMessage, readXaiMessage, xaiRefused } from "./codec.ts";
import { classifyProviderFailure, retryAfterMs } from "./errors.ts";
import { xaiCapabilities } from "./capabilities.ts";

function silentFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	return fetch(input, init);
}


export async function providerStep(input: ProviderRequest & { apiKey: string; baseUrl: string }): Promise<ProviderStep> {
	if (input.provider && input.provider.id !== "xai") return { ok: false, error: { code: "provider_mismatch", message: "The request is bound to another provider. No request was sent." } };
	const capabilities = xaiCapabilities(input.modelId, input.provider?.version);
	if (!capabilities) return { ok: false, error: { code: "unknown_provider_version", message: "The requested provider policy version is unavailable. No request was sent." } };
	const choice = input.toolChoice;
	if (capabilities.toolLoop !== "enabled") return { ok: false, error: { code: capabilities.unavailableCode ?? "model_tools_unavailable", message: "This model is not enabled for the xAI tool adapter. No fallback was selected." } };
	if (!Number.isSafeInteger(input.maxTokens) || input.maxTokens <= 0 || (choice === "required" && input.tools.length === 0) || (typeof choice === "object" && !input.tools.some((tool) => tool.name === choice.name))) {
		return { ok: false, error: { code: "unsupported_request", message: "Invalid token limit or unavailable tool choice. No provider request was sent." } };
	}
	const requestStarted = Date.now();
	const res = await silentFetch(`${input.baseUrl}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${input.apiKey}`,
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify({
			model: input.modelId,
			messages: input.messages.map(xaiMessage),
			tools: input.tools.map((tool) => ({ type: "function", function: tool })),
			// Choice comes from the versioned agent mode policy; the host may explicitly force a repair write.
			tool_choice: typeof input.toolChoice === "string" ? input.toolChoice : { type: "function", function: input.toolChoice },
			stream: false,
			...(input.provider?.version === 1 ? {} : { parallel_tool_calls: false }),
			[capabilities.completionTokenParameter]: input.maxTokens,
			temperature: capabilities.fixedTemperature
		}),
		signal: input.signal
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		const failure = classifyProviderFailure(res.status, body.slice(0, 240));
		return { ok: false, error: { ...failure, status: res.status, retryAfterMs: retryAfterMs(res.headers.get("retry-after")), elapsedMs: Date.now() - requestStarted }, usage: errorUsage(body) };
	}
	const payload = (await res.json()) as {
		choices?: Array<{ finish_reason?: string; message?: unknown }>;
		usage?: unknown;
		model?: string;
	};
	const usage = readProviderUsage(payload.usage) ?? undefined;
	const used = typeof payload.model === "string" ? payload.model : input.modelId;
	const switched = assertNoFallback(input.modelId, used);
	if (switched) return { ok: false, error: { code: switched.code, message: switched.message }, usage };
	if (xaiRefused(payload.choices?.[0]?.message)) return { ok: false, error: { code: "provider_refusal", message: "The provider declined this request." }, usage, response: { finishReason: payload.choices?.[0]?.finish_reason, refusal: "provider_refused", status: res.status } };
	const message = readXaiMessage(payload.choices?.[0]?.message);
	if (!message) return { ok: false, error: { code: "malformed_response", message: "Chat completion had no supported assistant message." }, usage };
	return { ok: true, message, usage, response: { finishReason: payload.choices?.[0]?.finish_reason, refusal: null, status: res.status } };
}

function errorUsage(body: string) {
	try {
		const payload: unknown = JSON.parse(body);
		return payload && typeof payload === "object" && "usage" in payload ? readProviderUsage(payload.usage) ?? undefined : undefined;
	} catch { return undefined; }
}

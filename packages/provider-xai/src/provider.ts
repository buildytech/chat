/** xAI Chat Completions transport. No page writes or agent-loop decisions. */
import { assertNoFallback, readProviderUsage, type ProviderRequest, type ProviderStep } from "@buildytech/chat-agent";

import { xaiMessage, readXaiMessage, xaiRefused } from "./codec.ts";
import { xaiCapabilities } from "./capabilities.ts";

function silentFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	return fetch(input, init);
}


function classifyProviderFailure(status: number, snippet: string): { code: string; message: string } {
	const lower = snippet.toLowerCase();
	if (/tool|function.?call/.test(lower) && /not.?support|unavail|invalid|unknown/.test(lower)) {
		return {
			code: "tools_unsupported",
			message: "This Grok model rejected application tools. Tool support is not assumed. No other model was substituted."
		};
	}
	if (status === 404 || /model.?not.?found|unknown.?model|does not exist/.test(lower)) {
		return {
			code: "model_unavailable",
			message: "The requested Grok chat model is not available on this account. No fallback model was selected."
		};
	}
	if (status === 429) {
		return { code: "rate_limited", message: "The xAI chat request was rate limited. No automatic retry was sent." };
	}
	return { code: "provider_failed", message: "The xAI chat request could not be completed. No automatic retry was sent." };
}


export async function providerStep(input: ProviderRequest & { apiKey: string; baseUrl: string }): Promise<ProviderStep> {
	const capabilities = xaiCapabilities(input.modelId);
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
			max_tokens: input.maxTokens,
			temperature: 0
		}),
		signal: input.signal
	});
	if (!res.ok) {
		const snippet = await res.text().then((text) => text.slice(0, 240), () => "");
		const failure = classifyProviderFailure(res.status, snippet);
		return { ok: false, error: { ...failure, status: res.status, elapsedMs: Date.now() - requestStarted } };
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
	if (xaiRefused(payload.choices?.[0]?.message)) return { ok: false, error: { code: "provider_refusal", message: "The provider declined this request." }, usage };
	const message = readXaiMessage(payload.choices?.[0]?.message);
	if (!message) return { ok: false, error: { code: "malformed_response", message: "Chat completion had no supported assistant message." }, usage };
	return { ok: true, message, usage };
}

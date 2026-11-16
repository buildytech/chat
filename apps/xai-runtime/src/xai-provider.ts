/** xAI Chat Completions transport. No page writes or agent-loop decisions. */
import { aggregateStepUsage, assertNoFallback, readProviderUsage, unknownUsage, turnMeta, type ChatMessage, type ProviderRequest, type ProviderStep } from "@buildytech/chat-agent";

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
	return { code: "xai_chat_failed", message: "The xAI chat request could not be completed. No automatic retry was sent." };
}


export async function providerStep(input: ProviderRequest & { apiKey: string; baseUrl: string }): Promise<ProviderStep> {
	const { trace } = input;
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
			messages: input.messages,
			tools: input.tools,
			// Choice comes from the versioned agent mode policy; the host may explicitly force a repair write.
			tool_choice: input.toolChoice,
			stream: false,
			max_tokens: input.maxTokens,
			temperature: 0
		}),
		signal: input.signal
	});
	const usageSoFar = () =>
		input.stepUsage.length ? aggregateStepUsage(input.stepUsage, { incomplete: "error" }) : unknownUsage("error", trace.steps);
	if (!res.ok) {
		const snippet = await res.text().then((text) => text.slice(0, 240), () => "");
		const failure = classifyProviderFailure(res.status, snippet);
		return {
			ok: false,
			result: { ok: false, code: failure.code, message: failure.message },
			meta: {
				...turnMeta("chat-completions", input.modelId, trace.toolCallingWorked, trace.steps, trace.toolsCalled, usageSoFar(), trace.runId),
				providerStatus: res.status,
				providerMs: Date.now() - requestStarted
			}
		};
	}
	const payload = (await res.json()) as {
		choices?: Array<{ finish_reason?: string; message?: ChatMessage }>;
		usage?: unknown;
		model?: string;
	};
	const used = typeof payload.model === "string" ? payload.model : input.modelId;
	const switched = assertNoFallback(input.modelId, used);
	if (switched) {
		return {
			ok: false,
			result: { ok: false, code: switched.code, message: switched.message },
			meta: turnMeta("chat-completions", input.modelId, trace.toolCallingWorked, trace.steps, trace.toolsCalled, unknownUsage("error", trace.steps), trace.runId)
		};
	}
	const usage = readProviderUsage(payload.usage);
	if (usage) input.stepUsage.push(usage);
	const message = payload.choices?.[0]?.message;
	if (!message) {
		return {
			ok: false,
			result: { ok: false, code: "malformed_response", message: "Chat completion had no message." },
			meta: turnMeta("chat-completions", input.modelId, trace.toolCallingWorked, trace.steps, trace.toolsCalled, usageSoFar(), trace.runId)
		};
	}
	return { ok: true, message };
}

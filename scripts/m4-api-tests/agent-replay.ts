/** Scripted model for the ADR 0034 replays: chat/completions answers are played back in order, every request is recorded. */
export const MODEL = "grok-4.20-0309-non-reasoning";

export type Scripted = { content?: string | null; calls?: Array<{ name: string; arguments: Record<string, unknown> }> };
export type Seen = { requests: Array<Record<string, unknown>>; toolMessages: Array<{ name: string; content: Record<string, unknown> }> };

export async function withProvider<T>(script: Scripted[], run: (seen: Seen) => Promise<T>): Promise<T> {
	const original = globalThis.fetch;
	const seen: Seen = { requests: [], toolMessages: [] };
	let index = 0;
	globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body ?? "{}")) as { messages: Array<{ role: string; name?: string; content?: string }> };
		seen.requests.push(body as Record<string, unknown>);
		seen.toolMessages = body.messages.filter((m) => m.role === "tool").map((m) => ({ name: String(m.name), content: JSON.parse(String(m.content)) as Record<string, unknown> }));
		const step = script[Math.min(index, script.length - 1)]!;
		index += 1;
		const message = {
			role: "assistant",
			content: step.content ?? null,
			...(step.calls?.length ? { tool_calls: step.calls.map((call, i) => ({ id: `call-${index}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } })) } : {})
		};
		return new Response(JSON.stringify({ model: MODEL, choices: [{ message }], usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100 } }), { status: 200, headers: { "content-type": "application/json" } });
	}) as typeof fetch;
	try {
		return await run(seen);
	} finally {
		globalThis.fetch = original;
	}
}

export const toolNames = (request: Record<string, unknown>) => (request.tools as Array<{ function: { name: string } }>).map((tool) => tool.function.name);
export const signal = () => new AbortController().signal;


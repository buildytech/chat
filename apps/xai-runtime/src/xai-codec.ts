/** Wire representation stays inside the xAI adapter. Unsupported payloads fail closed. */
import type { AgentMessage } from "@buildytech/chat-agent";

export function xaiMessage(message: AgentMessage): Record<string, unknown> {
	return {
		role: message.role,
		content: message.text ?? null,
		...(message.calls?.length ? { tool_calls: message.calls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: call.argumentsJson } })) } : {}),
		...(message.callId ? { tool_call_id: message.callId } : {}),
		...(message.name ? { name: message.name } : {})
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> | null {
	return isRecord(value) ? value : null;
}

function text(value: unknown): string | null {
	if (value == null) return "";
	if (typeof value === "string") return value;
	if (!Array.isArray(value)) return null;
	const parts: string[] = [];
	for (const part of value) {
		const item = record(part);
		if (item?.type !== "text" || typeof item.text !== "string") return null;
		parts.push(item.text);
	}
	return parts.join("");
}

export function readXaiMessage(value: unknown): AgentMessage | null {
	const message = record(value);
	if (!message || message.role !== "assistant" || message.refusal) return null;
	const content = text(message.content);
	if (content === null) return null;
	const calls = [];
	const ids = new Set<string>();
	if (message.tool_calls !== undefined) {
		if (!Array.isArray(message.tool_calls)) return null;
		for (const value of message.tool_calls) {
			const call = record(value);
			const fn = record(call?.function);
			if (!call || call.type !== "function" || typeof call.id !== "string" || !call.id || ids.has(call.id) || typeof fn?.name !== "string" || !fn.name || typeof fn.arguments !== "string") return null;
			ids.add(call.id);
			calls.push({ id: call.id, name: fn.name, argumentsJson: fn.arguments });
		}
	}
	return { role: "assistant", text: content, ...(calls.length ? { calls } : {}) };
}

export function xaiRefused(value: unknown): boolean {
	const message = record(value);
	return typeof message?.refusal === "string" && message.refusal.length > 0;
}

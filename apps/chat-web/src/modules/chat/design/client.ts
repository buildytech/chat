/**
 * Browser side of `POST /runtime/v1/design`: one Design-agent completion. The runtime holds the provider key.
 */
import type { DesignChatMessage } from "../../../lib/theme/design-turn.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export async function completeDesign(messages: readonly DesignChatMessage[], modelId: string, signal?: AbortSignal): Promise<string> {
	const res = await fetch("/runtime/v1/design", {
		method: "POST",
		credentials: "same-origin",
		cache: "no-store",
		headers: { "content-type": "application/json", accept: "application/json" },
		body: JSON.stringify({ modelId, messages }),
		signal
	});
	const json: unknown = await res.json().catch(() => null);
	if (!isRecord(json)) throw new Error("The runtime answered without JSON.");
	if (json.ok === true && typeof json.text === "string") return json.text;
	const code = typeof json.code === "string" ? json.code : `http_${res.status}`;
	const message = typeof json.message === "string" ? json.message : "The design request failed.";
	throw Object.assign(new Error(message), { code });
}

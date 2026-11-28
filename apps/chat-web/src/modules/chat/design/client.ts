/**
 * Browser side of `POST /runtime/v1/design`: one Design-agent completion. The runtime holds the provider key.
 * The app sends its model id and the Design role's provider (ADR 0071); the host maps an OpenRouter wire id.
 */
import type { ProviderId } from "@buildytech/chat-agent";
import type { DesignChatMessage } from "../../../lib/theme/design-turn.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

type DesignCompletion = { text: string; ticks: number | null };

function ticksOf(value: unknown): number | null {
	if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
	if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) return Number(value);
	return null;
}

export async function completeDesign(messages: readonly DesignChatMessage[], modelId: string, provider: ProviderId, signal?: AbortSignal): Promise<DesignCompletion> {
	const res = await fetch("/runtime/v1/design", {
		method: "POST",
		credentials: "same-origin",
		cache: "no-store",
		headers: { "content-type": "application/json", accept: "application/json" },
		body: JSON.stringify({ modelId, messages, provider }),
		signal
	});
	const json: unknown = await res.json().catch(() => null);
	if (!isRecord(json)) throw new Error("The runtime answered without JSON.");
	if (json.ok === true && typeof json.text === "string") return { text: json.text, ticks: ticksOf(json.costUsdTicks) };
	const code = typeof json.code === "string" ? json.code : `http_${res.status}`;
	const message = typeof json.message === "string" ? json.message : "The design request failed.";
	throw Object.assign(new Error(message), { code });
}

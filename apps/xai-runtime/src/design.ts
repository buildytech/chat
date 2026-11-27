/**
 * Design mode endpoint (ADR 0070): `POST /v1/design` with `{ modelId, messages }` runs one chat completion
 * with no tools and answers `{ ok, text }`. The key stays here; the browser never sees it. The host validator
 * and Brand Skin write live in the client (runDesignTurn).
 */
import { readXaiKeyState, resolveChatModelRequest, safeErrorMessage, secretValues, xaiBaseUrl, type EnvMap } from "@buildytech/chat-agent";
import { xaiCapabilities } from "@buildytech/provider-xai";
import { runtimeStatus } from "./status.ts";

const MAX_BODY = 128_000;
const MAX_MESSAGES = 40;
const MAX_CONTENT = 16_000;
const MAX_TOKENS = 8192;
const TIMEOUT_MS = 60_000;

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

const isBody = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

type ChatRole = "system" | "user" | "assistant";

function readMessages(value: unknown): Array<{ role: ChatRole; content: string }> | null {
	if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return null;
	const out: Array<{ role: ChatRole; content: string }> = [];
	for (const row of value) {
		if (!isBody(row)) return null;
		const role = row.role;
		const content = typeof row.content === "string" ? row.content : typeof row.text === "string" ? row.text : null;
		if ((role !== "system" && role !== "user" && role !== "assistant") || content === null || content.length > MAX_CONTENT) return null;
		out.push({ role, content });
	}
	return out;
}

function assistantText(payload: unknown): string | null {
	if (!isBody(payload) || !Array.isArray(payload.choices)) return null;
	const choice = payload.choices[0];
	if (!isBody(choice)) return null;
	const message = choice.message;
	if (!isBody(message)) return null;
	if (typeof message.content === "string") return message.content;
	if (Array.isArray(message.content)) {
		const parts = message.content.flatMap((part) => (isBody(part) && typeof part.text === "string" ? [part.text] : []));
		return parts.length ? parts.join("") : null;
	}
	return null;
}

function logDesign(event: Record<string, unknown>): void {
	console.log(JSON.stringify({ runtime: "xai-grok", event: "xai_design", ...event }));
}

export async function handleDesign(request: Request, env: EnvMap): Promise<Response> {
	const raw = await request.text();
	if (raw.length > MAX_BODY) return json(413, { ok: false, code: "too_large", message: "payload too large" });
	let body: unknown;
	try {
		body = JSON.parse(raw || "{}");
	} catch {
		return json(400, { ok: false, code: "invalid_json", message: "invalid json" });
	}
	if (!isBody(body)) return json(400, { ok: false, code: "invalid_body", message: "Send one JSON object." });
	const messages = readMessages(body.messages);
	if (!messages) return json(422, { ok: false, code: "invalid_request", message: "messages is a non-empty list of role and content." });
	const requestedId = typeof body.modelId === "string" ? body.modelId : "";
	if (!requestedId.trim()) return json(422, { ok: false, code: "missing_model_id", message: "Select a Grok chat model before sending." });
	if (!readXaiKeyState(env).present) return json(503, { ok: false, code: "xai_api_key_missing", message: "XAI_API_KEY is not provisioned here. No provider call was made." });
	const status = await runtimeStatus(env);
	const resolved = resolveChatModelRequest({
		requestedId,
		discoveredChatIds: status.models.listed ? status.models.chatIds : undefined,
		allowUnlistedTrial: !status.ready
	});
	if (!resolved.ok) return json(422, { ok: false, code: resolved.code, message: resolved.message });
	if (!status.ready) return json(503, { ok: false, code: status.code, message: "xAI runtime is not ready. No provider call was made." });
	const capabilities = xaiCapabilities(resolved.modelId);
	if (!capabilities) return json(422, { ok: false, code: "unknown_chat_model", message: "That model is not enabled for Design on this host. No provider call was made." });
	const started = Date.now();
	try {
		const res = await fetch(`${xaiBaseUrl(env)}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.XAI_API_KEY!.trim()}`,
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify({
				model: resolved.modelId,
				messages,
				stream: false,
				[capabilities.completionTokenParameter]: MAX_TOKENS,
				temperature: capabilities.fixedTemperature
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!res.ok) {
			logDesign({ ok: false, code: "provider_error", status: res.status, modelId: resolved.modelId, ms: Date.now() - started });
			return json(502, { ok: false, code: "provider_error", message: "The design request could not be completed. No automatic retry was sent." });
		}
		const payload: unknown = await res.json();
		const text = assistantText(payload);
		if (text === null) {
			logDesign({ ok: false, code: "malformed_response", modelId: resolved.modelId, ms: Date.now() - started });
			return json(502, { ok: false, code: "malformed_response", message: "The provider answer had no assistant text." });
		}
		logDesign({ ok: true, code: "ok", modelId: resolved.modelId, ms: Date.now() - started });
		return json(200, { ok: true, text });
	} catch (err) {
		const safe = safeErrorMessage(err, secretValues(env));
		logDesign({ ok: false, code: safe.code || "design_failed", modelId: resolved.modelId, ms: Date.now() - started });
		return json(502, { ok: false, code: safe.code || "design_failed", message: "The design request could not be completed. No automatic retry was sent." });
	}
}

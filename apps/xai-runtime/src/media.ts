/**
 * Media mode endpoint (t109u): `POST /v1/media` with `{ action: "generate", prompt, aspect, n }` starts one deferred Grok Imagine
 * request and answers `{ requestId }`; `{ action: "result", requestId }` reads it (`pending`, or `done` with temporary https
 * URLs and the billed cost). The key stays here; the browser never sees it. No page is read or written: the browser picks a
 * candidate and writes `image` through its own page gate.
 */
import { readXaiKeyState, safeErrorMessage, secretValues, xaiBaseUrl, type EnvMap } from "@buildytech/chat-agent";
import { MAX_IMAGE_PROMPT, XAI_IMAGE_MODEL, isImageAspect, pollImages, submitImages } from "@buildytech/provider-xai";

const MAX_BODY = 16_000;
const POLL_MS = 20_000;

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
	const raw = await request.text();
	if (raw.length > MAX_BODY) return null;
	try {
		const body: unknown = JSON.parse(raw || "{}");
		return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

/** One sanitized log line: action, outcome, timing and cost; never the prompt, URLs or headers. */
function logMedia(event: Record<string, unknown>): void {
	console.log(JSON.stringify({ runtime: "xai-grok", event: "xai_media", ...event }));
}

export async function handleMedia(request: Request, env: EnvMap): Promise<Response> {
	if (!readXaiKeyState(env).present) return json(503, { ok: false, code: "xai_api_key_missing", message: "XAI_API_KEY is not provisioned here. No provider call was made." });
	const body = await readBody(request);
	if (!body) return json(400, { ok: false, code: "invalid_body", message: "Send one JSON object." });
	const transport = { apiKey: env.XAI_API_KEY!.trim(), baseUrl: xaiBaseUrl(env), signal: AbortSignal.timeout(POLL_MS) };
	const started = Date.now();
	try {
		if (body.action === "generate") {
			const prompt = typeof body.prompt === "string" ? body.prompt : "";
			if (!prompt.trim() || prompt.length > MAX_IMAGE_PROMPT || !isImageAspect(body.aspect)) return json(422, { ok: false, code: "invalid_request", message: "A prompt (up to 4000 characters) and a supported aspect are required." });
			const n = typeof body.n === "number" ? body.n : 3;
			const out = await submitImages({ ...transport, prompt, aspect: body.aspect, n });
			logMedia({ action: "generate", ok: out.ok, code: out.ok ? "ok" : out.code, aspect: body.aspect, n, ms: Date.now() - started });
			return json(out.ok ? 202 : 502, { ...out, model: XAI_IMAGE_MODEL });
		}
		if (body.action === "result") {
			const out = await pollImages({ ...transport, requestId: typeof body.requestId === "string" ? body.requestId : "" });
			if (!out.ok || out.status === "done") logMedia({ action: "result", ok: out.ok, code: out.ok ? "done" : out.code, images: out.ok ? out.urls.length : 0, costUsdTicks: out.ok ? out.costUsdTicks : null });
			return json(out.ok ? 200 : 502, { ...out, model: XAI_IMAGE_MODEL });
		}
		return json(422, { ok: false, code: "unknown_action", message: "action is generate or result." });
	} catch (err) {
		const safe = safeErrorMessage(err, secretValues(env));
		return json(502, { ok: false, code: safe.code || "media_failed", message: "The image request could not be completed. No automatic retry was sent." });
	}
}

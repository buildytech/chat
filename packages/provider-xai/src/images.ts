/**
 * xAI image generation transport (Grok Imagine), server only. Deferred flow of the REST reference
 * (https://docs.x.ai/developers/rest-api-reference/inference/images): `POST /v1/images/generations` with `deferred: true`
 * answers a `request_id` at once; `GET /v1/images/{request_id}` answers 202 `pending`, 200 `done` with `data[].url` or
 * 200 `failed` with `error`. While a request is pending the poll may also answer 404 for a few seconds (observed
 * 2026-11-21), so a 404 reads as pending; the caller bounds the wait. The returned URLs are temporary (imgen.x.ai); no
 * storage is requested here (owner decision t109u: storage comes later).
 */
import { classifyProviderFailure } from "./errors.ts";

/** The image model (docs: Image Generation, grok-imagine-image-2.0, flat per-image price). */
export const XAI_IMAGE_MODEL = "grok-imagine-image-2.0";
/** Aspect ratios the generations endpoint accepts that the page blocks use. */
export const IMAGE_ASPECTS = ["1:1", "4:3", "3:4", "16:9", "21:9"] as const;
export type ImageAspect = (typeof IMAGE_ASPECTS)[number];
export const MAX_IMAGE_CANDIDATES = 3;
export const MAX_IMAGE_PROMPT = 4000;

type Transport = { apiKey: string; baseUrl: string; signal?: AbortSignal };
type Failure = { ok: false; code: string; message: string; status?: number };

export type ImageSubmit = { ok: true; requestId: string } | Failure;
export type ImagePoll =
	| { ok: true; status: "pending" }
	| { ok: true; status: "done"; urls: string[]; costUsdTicks: number | null }
	| Failure;

export function isImageAspect(value: unknown): value is ImageAspect {
	return typeof value === "string" && (IMAGE_ASPECTS as readonly string[]).includes(value);
}

const REQUEST_ID = /^[A-Za-z0-9-]{8,80}$/;
export const isImageRequestId = (value: unknown): value is string => typeof value === "string" && REQUEST_ID.test(value);

async function failure(res: Response): Promise<Failure> {
	const body = await res.text().catch(() => "");
	const failed = classifyProviderFailure(res.status, body.slice(0, 240));
	return { ok: false, code: failed.code, message: failed.message, status: res.status };
}

/** Start one deferred generation of `n` candidates. Nothing is retried. */
export async function submitImages(input: Transport & { prompt: string; aspect: ImageAspect; n: number }): Promise<ImageSubmit> {
	const n = Math.min(Math.max(Math.trunc(input.n), 1), MAX_IMAGE_CANDIDATES);
	const prompt = input.prompt.trim().slice(0, MAX_IMAGE_PROMPT);
	if (!prompt) return { ok: false, code: "empty_prompt", message: "The image brief is empty. No request was sent." };
	const res = await fetch(`${input.baseUrl}/images/generations`, {
		method: "POST",
		headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ model: XAI_IMAGE_MODEL, prompt, n, aspect_ratio: input.aspect, response_format: "url", deferred: true }),
		signal: input.signal
	});
	if (!res.ok) return failure(res);
	const payload = (await res.json().catch(() => null)) as { request_id?: unknown } | null;
	if (!isImageRequestId(payload?.request_id)) return { ok: false, code: "malformed_response", message: "The image request returned no request id." };
	return { ok: true, requestId: payload.request_id };
}

function httpsUrls(data: unknown): string[] {
	if (!Array.isArray(data)) return [];
	return data.map((item) => (item && typeof item === "object" ? (item as { url?: unknown }).url : null)).filter((url): url is string => typeof url === "string" && url.startsWith("https://") && url.length <= 2048);
}

/** Read one deferred request: pending, done (temporary https URLs and the billed cost), or failed. */
export async function pollImages(input: Transport & { requestId: string }): Promise<ImagePoll> {
	if (!isImageRequestId(input.requestId)) return { ok: false, code: "bad_request_id", message: "Unknown image request." };
	const res = await fetch(`${input.baseUrl}/images/${encodeURIComponent(input.requestId)}`, {
		headers: { Authorization: `Bearer ${input.apiKey}`, Accept: "application/json" },
		signal: input.signal
	});
	if (res.status === 202 || res.status === 404) {
		await res.body?.cancel().catch(() => undefined);
		return { ok: true, status: "pending" };
	}
	if (!res.ok) return failure(res);
	const payload = (await res.json().catch(() => null)) as { status?: unknown; data?: unknown; error?: { code?: unknown }; usage?: { cost_in_usd_ticks?: unknown } } | null;
	if (payload?.status === "pending") return { ok: true, status: "pending" };
	if (payload?.status === "failed") return { ok: false, code: typeof payload.error?.code === "string" ? `image_${payload.error.code}` : "image_failed", message: "The image model could not draw this brief." };
	const urls = httpsUrls(payload?.data);
	if (!urls.length) return { ok: false, code: "malformed_response", message: "The image request finished without pictures." };
	const ticks = payload?.usage?.cost_in_usd_ticks;
	return { ok: true, status: "done", urls, costUsdTicks: typeof ticks === "number" && Number.isFinite(ticks) ? ticks : null };
}

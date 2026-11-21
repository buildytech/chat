/**
 * Browser side of `POST /runtime/v1/media` (t109u): start one generation, then poll until its candidates are ready. The
 * runtime holds the xAI key; this file only sends the prompt and reads temporary https URLs.
 */
import type { MediaAspect } from "./slots.ts";

type MediaResult = { ok: true; urls: string[]; costUsdTicks: number | null; ms: number } | { ok: false; code: string; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const POLL_EVERY_MS = 2500;
const GIVE_UP_MS = 150_000;

async function call(body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
	const res = await fetch("/runtime/v1/media", {
		method: "POST",
		credentials: "same-origin",
		cache: "no-store",
		headers: { "content-type": "application/json", accept: "application/json" },
		body: JSON.stringify(body),
		signal
	});
	const json: unknown = await res.json().catch(() => null);
	if (!isRecord(json)) return { ok: false, code: `http_${res.status}`, message: "The runtime answered without JSON." };
	return json;
}

const sleep = (ms: number, signal?: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener("abort", () => {
			clearTimeout(timer);
			reject(new DOMException("aborted", "AbortError"));
		});
	});

function failure(body: Record<string, unknown>): MediaResult {
	return { ok: false, code: typeof body.code === "string" ? body.code : "media_failed", message: typeof body.message === "string" ? body.message : "The image request failed." };
}

/** Generate `n` candidates for one prompt; resolves when they are drawn, failed, or the wait ran out. */
export async function generateCandidates(prompt: string, aspect: MediaAspect, n: number, signal?: AbortSignal): Promise<MediaResult> {
	const started = Date.now();
	const submitted = await call({ action: "generate", prompt, aspect, n }, signal);
	if (submitted.ok !== true || typeof submitted.requestId !== "string") return failure(submitted);
	while (Date.now() - started < GIVE_UP_MS) {
		await sleep(POLL_EVERY_MS, signal);
		const polled = await call({ action: "result", requestId: submitted.requestId }, signal);
		if (polled.ok !== true) return failure(polled);
		if (polled.status === "done" && Array.isArray(polled.urls)) {
			const urls = polled.urls.filter((url): url is string => typeof url === "string");
			return { ok: true, urls, costUsdTicks: typeof polled.costUsdTicks === "number" ? polled.costUsdTicks : null, ms: Date.now() - started };
		}
	}
	return { ok: false, code: "media_timeout", message: "The pictures were not ready in time. Try again." };
}

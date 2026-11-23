/**
 * Browser side of `POST /runtime/v1/media` (t109u): start one generation, then poll until its candidates are ready. The
 * runtime holds the xAI key; this file only sends the prompt and reads picture addresses (https on web hosts, content-addressed local files on the desktop).
 */
import type { MediaAspect } from "./slots.ts";
import { isRuntimePicture } from "../../../lib/runtime-files.ts";

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

function doneResult(body: Record<string, unknown>, started: number): MediaResult {
	const urls = Array.isArray(body.urls) ? body.urls.filter((url): url is string => typeof url === "string") : [];
	return { ok: true, urls, costUsdTicks: typeof body.costUsdTicks === "number" ? body.costUsdTicks : null, ms: Date.now() - started };
}

/** Generate `n` candidates for one prompt; resolves when they are drawn, failed, or the wait ran out. */
export async function generateCandidates(prompt: string, aspect: MediaAspect, n: number, signal?: AbortSignal): Promise<MediaResult> {
	const started = Date.now();
	const submitted = await call({ action: "generate", prompt, aspect, n }, signal);
	if (submitted.ok !== true || typeof submitted.requestId !== "string") return failure(submitted);
	// The desktop signed in with OpenRouter draws at once and answers done (ADR 0067): nothing to poll.
	if (submitted.status === "done" && Array.isArray(submitted.urls)) return doneResult(submitted, started);
	while (Date.now() - started < GIVE_UP_MS) {
		await sleep(POLL_EVERY_MS, signal);
		const polled = await call({ action: "result", requestId: submitted.requestId }, signal);
		if (polled.ok !== true) return failure(polled);
		if (polled.status === "done" && Array.isArray(polled.urls)) return doneResult(polled, started);
	}
	return { ok: false, code: "media_timeout", message: "The pictures were not ready in time. Try again." };
}

/** Image hosts the runtime proxies for the ZIP export (apps/xai-runtime/src/media-asset.ts keeps the same list). */
const PROXIED_HOSTS = new Set(["imgen.x.ai", "files-cdn.x.ai"]);

function proxiedHost(url: string): boolean {
	if (isRuntimePicture(url)) return true;
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" && PROXIED_HOSTS.has(parsed.hostname);
	} catch {
		return false;
	}
}

/** The ZIP export's reader for xAI pictures (no CORS there): the bytes through the runtime, or null. ADR 0061. */
async function fetchViaRuntime(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
	const res = await fetch("/runtime/v1/media", {
		method: "POST",
		credentials: "same-origin",
		cache: "no-store",
		headers: { "content-type": "application/json", accept: "image/*" },
		body: JSON.stringify({ action: "asset", url }),
		signal: AbortSignal.timeout(30_000)
	});
	const type = res.headers.get("content-type") ?? "";
	if (!res.ok || !type.startsWith("image/")) return null;
	return { bytes: new Uint8Array(await res.arrayBuffer()), type };
}

export const runtimeImageSource = { handles: proxiedHost, fetch: fetchViaRuntime };

type EncodedSize = { width: number; height: number; bytes: Uint8Array; type: string; quality?: number; sharpen?: number };

function base64Bytes(data: string): Uint8Array {
	const binary = atob(data);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
	return out;
}

const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

type Encoded = { original: { width: number; height: number; bytes?: number; type?: string }; variants: EncodedSize[]; filters?: Record<string, number> };

/** The ZIP export's encoder: the original (its bytes, or the address of an xAI picture) goes to the runtime, its WebP sizes come back (ADR 0062). */
async function encodeViaRuntime(input: { bytes: Uint8Array; type: string } | { url: string }): Promise<Encoded | null> {
	let body: ArrayBuffer | undefined;
	let query = "";
	if ("url" in input) query = `&url=${encodeURIComponent(input.url)}`;
	else {
		body = new ArrayBuffer(input.bytes.byteLength);
		new Uint8Array(body).set(input.bytes);
	}
	const res = await fetch(`/runtime/v1/media?action=encode${query}`, {
		method: "POST",
		credentials: "same-origin",
		cache: "no-store",
		headers: { "content-type": "url" in input ? "application/octet-stream" : input.type.split(";")[0]!.trim(), accept: "application/json" },
		body,
		signal: AbortSignal.timeout(90_000)
	});
	const json: unknown = await res.json().catch(() => null);
	if (!res.ok || !isRecord(json) || json.ok !== true || !Array.isArray(json.variants)) throw new Error(isRecord(json) && typeof json.code === "string" ? json.code : `encode http ${res.status}`);
	const original = isRecord(json.original) ? json.original : {};
	const variants = json.variants.filter(isRecord).flatMap((v): EncodedSize[] =>
		typeof v.data === "string" && num(v.width) > 0 ? [{ width: num(v.width), height: num(v.height), bytes: base64Bytes(v.data), type: typeof v.type === "string" ? v.type : "image/webp", quality: num(v.quality) || undefined, sharpen: num(v.sharpen) || undefined }] : []
	);
	const filters = isRecord(json.filters) ? Object.fromEntries(Object.entries(json.filters).map(([k, v]) => [k, num(v)])) : undefined;
	return { original: { width: num(original.width), height: num(original.height), bytes: num(original.bytes) || undefined, type: typeof original.type === "string" ? original.type : undefined }, variants, ...(filters ? { filters } : {}) };
}

export const runtimeImageEncoder = { bytes: (image: { bytes: Uint8Array; type: string }) => encodeViaRuntime(image), url: { handles: proxiedHost, encode: (url: string) => encodeViaRuntime({ url }) } };

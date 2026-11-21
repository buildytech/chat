/**
 * Picture proxy of the ZIP export (ADR 0061): `POST /v1/media` with `{ action: "asset", url }` answers the picture's bytes
 * for hosts the browser cannot read cross-origin. Only the image hosts of xAI (Media mode's temporary results and the
 * xAI file CDN), https only, no redirects, a picture type, at most MAX_ASSET_BYTES (under the 4.5 MB Vercel response
 * cap). It sits behind the same gate as every runtime path; it needs no key and never logs the address.
 */
export const ASSET_HOSTS = new Set(["imgen.x.ai", "files-cdn.x.ai"]);
export const MAX_ASSET_BYTES = 4_000_000;
export const ASSET_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const ASSET_TIMEOUT_MS = 20_000;

type AssetFailure = { status: number; code: string };

function fail(failure: AssetFailure, message: string): Response {
	return new Response(JSON.stringify({ ok: false, code: failure.code, message }), { status: failure.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

/** The address when the proxy may read it, else null. */
function assetUrl(raw: unknown): URL | null {
	if (typeof raw !== "string" || raw.length > 2048) return null;
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	if (url.protocol !== "https:" || url.username || url.password || url.port || !ASSET_HOSTS.has(url.hostname)) return null;
	return url;
}

async function readCapped(res: Response, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
	if (!res.body) return null;
	const reader = res.body.getReader();
	const parts: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.length;
		if (total > max) {
			await reader.cancel().catch(() => undefined);
			return null;
		}
		parts.push(value);
	}
	const out = new Uint8Array(new ArrayBuffer(total));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

function logAsset(event: Record<string, unknown>): void {
	console.log(JSON.stringify({ runtime: "xai-grok", event: "xai_media", action: "asset", ...event }));
}

type Fetched = { ok: true; bytes: Uint8Array<ArrayBuffer>; type: string; host: string } | { ok: false; failure: AssetFailure; host: string };

/** Reads an allowed picture (https, xAI image host, no redirects, picture type) up to `max` bytes. */
export async function fetchAllowedPicture(raw: unknown, max: number, fetchImpl: typeof fetch = fetch): Promise<Fetched> {
	const url = assetUrl(raw);
	if (!url) return { ok: false, failure: { status: 422, code: "asset_not_allowed" }, host: "" };
	let res: Response;
	try {
		res = await fetchImpl(url, { redirect: "error", headers: { accept: "image/*" }, signal: AbortSignal.timeout(ASSET_TIMEOUT_MS) });
	} catch {
		return { ok: false, failure: { status: 502, code: "asset_unreachable" }, host: url.hostname };
	}
	const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
	const length = Number(res.headers.get("content-length") ?? 0);
	const failure: AssetFailure | null = !res.ok
		? { status: res.status === 404 || res.status === 410 ? 404 : 502, code: `asset_upstream_${res.status}` }
		: !ASSET_TYPES.has(type)
			? { status: 415, code: "asset_not_image" }
			: length > max
				? { status: 413, code: "asset_too_large" }
				: null;
	if (failure) {
		await res.body?.cancel().catch(() => undefined);
		return { ok: false, failure, host: url.hostname };
	}
	const bytes = await readCapped(res, max);
	return bytes ? { ok: true, bytes, type, host: url.hostname } : { ok: false, failure: { status: 413, code: "asset_too_large" }, host: url.hostname };
}

export async function handleAsset(raw: unknown, fetchImpl: typeof fetch = fetch): Promise<Response> {
	const started = Date.now();
	const got = await fetchAllowedPicture(raw, MAX_ASSET_BYTES, fetchImpl);
	if (!got.ok) {
		if (got.failure.code !== "asset_not_allowed") logAsset({ ok: false, code: got.failure.code, host: got.host, ms: Date.now() - started });
		return fail(got.failure, got.failure.code === "asset_not_allowed" ? "Only https pictures of the xAI image hosts are proxied." : "The picture could not be read.");
	}
	logAsset({ ok: true, host: got.host, bytes: got.bytes.length, ms: Date.now() - started });
	return new Response(got.bytes, { status: 200, headers: { "content-type": got.type, "content-length": String(got.bytes.length), "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

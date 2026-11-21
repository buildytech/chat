/**
 * WebP sizes of one picture for the ZIP export (ADR 0062): `POST /v1/media?action=encode` with the original picture as
 * the body (an image type, at most MAX_ENCODE_BYTES, under Vercel's 4.5 MB request cap), or `&url=` of an xAI image host
 * that the runtime reads itself (at most MAX_URL_BYTES: a 2k Grok Imagine PNG is about 7 MB), answers JSON with up to three WebP sizes, each made from the
 * original (never from another size): the tiers of TIERS, never wider than the original (tiers that land on the same
 * width keep the smaller tier). Before encoding, a subtle grade: a little less contrast and a slightly cooler white
 * balance (FILTERS, overridable per request within FILTER_LIMITS through `contrast` and `cool` query values). The
 * answer stays under the 4.5 MB Vercel response cap; a failure answers an error and the caller keeps the original.
 */
import { fetchAllowedPicture } from "./media-asset.ts";

export const MAX_ENCODE_BYTES = 4_000_000;
export const MAX_URL_BYTES = 24_000_000;
/** The base64 answer must stay under Vercel's 4.5 MB response cap. */
const MAX_ANSWER_BYTES = 3_200_000;
export const ENCODE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

type Tier = { width: number; quality: number; sharpen: number };
/** 1920 q82; 1280 q78 with a mild sharpen (sigma); 960 q72. */
export const TIERS: readonly Tier[] = [
	{ width: 960, quality: 72, sharpen: 0 },
	{ width: 1280, quality: 78, sharpen: 0.6 },
	{ width: 1920, quality: 82, sharpen: 0 }
];
/**
 * The grade before encoding. `contrast`: -0.06 is 6% less contrast around mid grey. `cool`: 0.03 lowers red and raises blue
 * by 3% (a slightly cooler white balance). Subtle on purpose: page art direction may be warm (embers, candle light).
 */
export const FILTERS = { contrast: -0.06, cool: 0.03 } as const;
export const FILTER_LIMITS = { contrast: [-0.2, 0.1], cool: [-0.1, 0.1] } as const;

type Filters = { contrast: number; cool: number };
type Variant = { width: number; height: number; bytes: number; quality: number; sharpen: number; type: "image/webp"; data: string };
type Sharp = typeof import("sharp").default;

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

const clamp = (value: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, value));

/** The grade of one request: the defaults, or a `contrast` / `cool` query value inside its limits. */
function filtersOf(url: URL): Filters {
	const read = (name: keyof Filters) => {
		const raw = url.searchParams.get(name);
		const value = raw === null ? Number.NaN : Number(raw);
		return Number.isFinite(value) ? clamp(value, FILTER_LIMITS[name]) : FILTERS[name];
	};
	return { contrast: read("contrast"), cool: read("cool") };
}

/** Output widths for an original `width` px wide: each tier capped at the original, one size per width (the smaller tier wins). */
function plan(width: number): Tier[] {
	const out = new Map<number, Tier>();
	for (const tier of TIERS) {
		const target = Math.min(tier.width, width);
		if (!out.has(target)) out.set(target, { ...tier, width: target });
	}
	return [...out.values()];
}

async function encodeOne(sharp: Sharp, input: Uint8Array, tier: Tier, filters: Filters): Promise<Variant> {
	const a = 1 + filters.contrast;
	let pipeline = sharp(input, { failOn: "error" })
		.rotate()
		.resize({ width: tier.width, withoutEnlargement: true })
		.recomb([
			[1 - filters.cool, 0, 0],
			[0, 1, 0],
			[0, 0, 1 + filters.cool]
		])
		.linear(a, 128 * (1 - a));
	if (tier.sharpen > 0) pipeline = pipeline.sharpen({ sigma: tier.sharpen });
	const { data, info } = await pipeline.webp({ quality: tier.quality, effort: 4 }).toBuffer({ resolveWithObject: true });
	return { width: info.width, height: info.height, bytes: data.length, quality: tier.quality, sharpen: tier.sharpen, type: "image/webp", data: data.toString("base64") };
}

function logEncode(event: Record<string, unknown>): void {
	console.log(JSON.stringify({ runtime: "xai-grok", event: "xai_media", action: "encode", ...event }));
}

async function readImage(request: Request): Promise<Uint8Array | null> {
	const length = Number(request.headers.get("content-length") ?? 0);
	if (length > MAX_ENCODE_BYTES) return null;
	const bytes = new Uint8Array(await request.arrayBuffer());
	return bytes.length > 0 && bytes.length <= MAX_ENCODE_BYTES ? bytes : null;
}

type Input = { ok: true; bytes: Uint8Array; type: string } | { ok: false; response: Response };

/** The original: read from `url` (xAI image hosts only) or taken from the body. */
async function inputOf(request: Request, url: URL): Promise<Input> {
	const source = url.searchParams.get("url");
	if (source !== null) {
		const got = await fetchAllowedPicture(source, MAX_URL_BYTES);
		return got.ok ? { ok: true, bytes: got.bytes, type: got.type } : { ok: false, response: json(got.failure.status, { ok: false, code: got.failure.code, message: "The picture could not be read from that address." }) };
	}
	const type = (request.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
	if (!ENCODE_TYPES.has(type)) return { ok: false, response: json(415, { ok: false, code: "encode_not_image", message: "The body must be the picture itself: jpeg, png, webp, avif or gif." }) };
	const bytes = await readImage(request);
	return bytes ? { ok: true, bytes, type } : { ok: false, response: json(413, { ok: false, code: "encode_too_large", message: "The picture is empty or larger than 4 MB." }) };
}

export async function handleEncode(request: Request, loadSharp: () => Promise<Sharp> = async () => (await import("sharp")).default): Promise<Response> {
	const url = new URL(request.url);
	const got = await inputOf(request, url);
	if (!got.ok) return got.response;
	const { bytes: input, type } = got;
	const filters = filtersOf(url);
	const started = Date.now();
	try {
		const sharp = await loadSharp();
		const meta = await sharp(input, { failOn: "error" }).rotate().metadata();
		const width = meta.autoOrient?.width ?? meta.width;
		const height = meta.autoOrient?.height ?? meta.height;
		if (!width || !height) throw new Error("no size");
		const variants: Variant[] = [];
		let total = 0;
		for (const tier of plan(width)) {
			const variant = await encodeOne(sharp, input, tier, filters);
			total += variant.data.length;
			if (total > MAX_ANSWER_BYTES) break;
			variants.push(variant);
		}
		if (!variants.length) throw new Error("no variant fits the answer");
		logEncode({ ok: true, width, bytes: input.length, out: variants.map((v) => [v.width, v.bytes]), ms: Date.now() - started });
		return json(200, { ok: true, original: { width, height, bytes: input.length, type }, filters, variants });
	} catch (err) {
		const code = err instanceof Error && /unsupported|corrupt|bad|invalid|no size/i.test(err.message) ? "encode_unreadable" : "encode_failed";
		logEncode({ ok: false, code, bytes: input.length, ms: Date.now() - started });
		return json(422, { ok: false, code, message: "The picture could not be converted; keep the original." });
	}
}

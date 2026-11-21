/** WebP sizes of the ZIP export (ADR 0062): POST /v1/media?action=encode with real sharp; tiers from the original, never upscaled, a subtle grade. */
import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { handleRuntimeFetch } from "../../apps/xai-runtime/src/http.ts";

const encode = (body: Uint8Array, type = "image/jpeg", query = "") =>
	handleRuntimeFetch(new Request(`http://127.0.0.1:18100/runtime/v1/media?action=encode${query}`, { method: "POST", headers: { "content-type": type }, body }), {});

/** A noisy test picture (noise keeps the encoder honest about sizes). */
async function picture(width: number, height: number): Promise<Uint8Array> {
	const raw = new Uint8Array(width * height * 3).map((_, i) => (i * 7919 + (i >> 9) * 31) & 0xff);
	return new Uint8Array(await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toBuffer());
}

type Answer = { ok: boolean; original: { width: number; height: number; bytes: number }; filters: Record<string, number>; variants: Array<{ width: number; height: number; bytes: number; quality: number; sharpen: number; type: string; data: string }> };

test("a wide original gets 960 q72, 1280 q78 sharpened and 1920 q82, each a real WebP of that width", async () => {
	const res = await encode(await picture(2400, 1350));
	assert.equal(res.status, 200);
	const out = (await res.json()) as Answer;
	assert.deepEqual(out.variants.map((v) => [v.width, v.height, v.quality, v.sharpen]), [[960, 540, 72, 0], [1280, 720, 78, 0.6], [1920, 1080, 82, 0]]);
	assert.deepEqual(out.filters, { contrast: -0.06, cool: 0.03 });
	for (const v of out.variants) {
		const meta = await sharp(Buffer.from(v.data, "base64")).metadata();
		assert.equal(meta.format, "webp");
		assert.equal(meta.width, v.width);
		assert.equal(Buffer.from(v.data, "base64").length, v.bytes);
	}
});

test("never upscales: tiers above the original collapse to its width, one size per width (the smaller tier wins)", async () => {
	const out = (await (await encode(await picture(1152, 864))).json()) as Answer;
	assert.deepEqual(out.variants.map((v) => [v.width, v.quality, v.sharpen]), [[960, 72, 0], [1152, 78, 0.6]]);
	const small = (await (await encode(await picture(640, 480))).json()) as Answer;
	assert.deepEqual(small.variants.map((v) => v.width), [640]);
});

test("the grade: less contrast and a cooler balance by default, overridable inside its limits", async () => {
	// A warm grey patch: after the default grade red goes down, blue goes up, and both move toward mid grey.
	const warm = new Uint8Array(await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 230, g: 160, b: 90 } } }).png().toBuffer());
	const mean = async (query: string) => {
		const out = (await (await encode(warm, "image/png", query)).json()) as Answer;
		const stats = await sharp(Buffer.from(out.variants[0]!.data, "base64")).stats();
		return { r: stats.channels[0]!.mean, b: stats.channels[2]!.mean, filters: out.filters };
	};
	const graded = await mean("");
	const plain = await mean("&contrast=0&cool=0");
	assert.ok(graded.r < plain.r - 5 && graded.b > plain.b + 2, JSON.stringify({ graded, plain }));
	assert.deepEqual((await mean("&contrast=-5&cool=9")).filters, { contrast: -0.2, cool: 0.1 }, "clamped");
});

test("refuses what is not a picture, an empty or oversize body and an unreadable picture (the caller keeps the original)", async () => {
	assert.equal((await encode(new Uint8Array([1, 2]), "text/plain")).status, 415);
	assert.equal((await encode(new Uint8Array(0))).status, 413);
	assert.equal((await encode(new Uint8Array(4_000_001))).status, 413);
	const broken = await encode(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]));
	assert.equal(broken.status, 422);
	assert.match(((await broken.json()) as { code: string }).code, /^encode_/);
});

test("by address: the runtime reads an xAI picture itself (larger than an upload may be), other hosts are refused", async () => {
	const big = await picture(2368, 1776);
	const original = globalThis.fetch;
	const seen: string[] = [];
	globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
		seen.push(`${String(url)} ${init?.redirect}`);
		return new Response(big, { status: 200, headers: { "content-type": "image/jpeg" } });
	};
	try {
		const res = await handleRuntimeFetch(new Request(`http://127.0.0.1:18100/runtime/v1/media?action=encode&url=${encodeURIComponent("https://imgen.x.ai/xai-imgen/big.png")}`, { method: "POST" }), {});
		assert.equal(res.status, 200);
		const out = (await res.json()) as Answer;
		assert.deepEqual(out.variants.map((v) => v.width), [960, 1280, 1920]);
		assert.equal(out.original.width, 2368);
		assert.deepEqual(seen, ["https://imgen.x.ai/xai-imgen/big.png error"]);
		const refused = await handleRuntimeFetch(new Request(`http://127.0.0.1:18100/runtime/v1/media?action=encode&url=${encodeURIComponent("https://example.com/a.png")}`, { method: "POST" }), {});
		assert.equal(refused.status, 422);
		assert.equal(seen.length, 1, "no fetch for a refused host");
	} finally {
		globalThis.fetch = original;
	}
});

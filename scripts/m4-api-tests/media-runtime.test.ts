/** Media mode runtime (t109u): the deferred Grok Imagine flow behind POST /v1/media, with a mocked provider (no network, no key value in output). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { pollImages, submitImages, XAI_IMAGE_MODEL } from "@buildytech/provider-xai";
import { handleRuntimeFetch } from "../../apps/xai-runtime/src/http.ts";

type Call = { url: string; init?: RequestInit };

async function withFetch<T>(responses: Array<() => Response>, run: (calls: Call[]) => Promise<T>): Promise<T> {
	const original = globalThis.fetch;
	const calls: Call[] = [];
	globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		calls.push({ url: String(url), init });
		const next = responses.shift();
		if (!next) throw new Error("unexpected fetch");
		return next();
	};
	try {
		return await run(calls);
	} finally {
		globalThis.fetch = original;
	}
}

const reply = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const env = { XAI_API_KEY: "test-key-not-real", XAI_BASE_URL: "https://xai.test/v1" };
const post = (body: unknown) => new Request("http://127.0.0.1:18100/runtime/v1/media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("submit sends one deferred generation with the model, aspect and candidate count, capped at 3", async () => {
	await withFetch([reply(200, { request_id: "8d6f4017-db06-9c5d" })], async (calls) => {
		const out = await submitImages({ apiKey: "k", baseUrl: "https://xai.test/v1", prompt: " Шашлык на углях ", aspect: "21:9", n: 7 });
		assert.deepEqual(out, { ok: true, requestId: "8d6f4017-db06-9c5d" });
		assert.equal(calls[0].url, "https://xai.test/v1/images/generations");
		const sent = JSON.parse(String(calls[0].init?.body));
		assert.deepEqual(sent, { model: XAI_IMAGE_MODEL, prompt: "Шашлык на углях", n: 3, aspect_ratio: "21:9", response_format: "url", deferred: true });
	});
});

test("poll reads 404 and 202 as pending, done as https URLs with the cost, failed as a code", async () => {
	await withFetch(
		[
			() => new Response("not found", { status: 404 }),
			reply(202, { status: "pending" }),
			reply(200, { status: "done", data: [{ url: "https://imgen.x.ai/a.jpeg" }, { url: "http://bad" }], usage: { cost_in_usd_ticks: 800000000 } }),
			reply(200, { status: "failed", error: { code: "invalid_argument", message: "x" } })
		],
		async () => {
			const args = { apiKey: "k", baseUrl: "https://xai.test/v1", requestId: "8d6f4017-db06-9c5d" };
			assert.deepEqual(await pollImages(args), { ok: true, status: "pending" });
			assert.deepEqual(await pollImages(args), { ok: true, status: "pending" });
			assert.deepEqual(await pollImages(args), { ok: true, status: "done", urls: ["https://imgen.x.ai/a.jpeg"], costUsdTicks: 800000000 });
			const failed = await pollImages(args);
			assert.equal(failed.ok, false);
			assert.equal(!failed.ok && failed.code, "image_invalid_argument");
		}
	);
});

test("POST /v1/media validates before any provider call and never echoes the key", async () => {
	await withFetch([], async (calls) => {
		for (const body of [{ action: "generate", prompt: "", aspect: "4:3" }, { action: "generate", prompt: "x", aspect: "7:5" }, { action: "nope" }]) {
			const res = await handleRuntimeFetch(post(body), env, { surface: "node" });
			assert.equal(res.ok, false);
			assert.doesNotMatch(await res.text(), /test-key-not-real/);
		}
		const missing = await handleRuntimeFetch(post({ action: "generate", prompt: "x", aspect: "4:3" }), {}, { surface: "node" });
		assert.equal(missing.status, 503);
		assert.equal(calls.length, 0);
	});
});

test("POST /v1/media generate then result: request id, then the candidates", async () => {
	await withFetch([reply(200, { request_id: "req-12345678" }), reply(200, { status: "done", data: [{ url: "https://imgen.x.ai/1.jpeg" }, { url: "https://imgen.x.ai/2.jpeg" }], usage: { cost_in_usd_ticks: 800000000 } })], async (calls) => {
		const started = await handleRuntimeFetch(post({ action: "generate", prompt: "Сочный шашлык из свиной шеи на шампурах", aspect: "4:3", n: 2 }), env, { surface: "node" });
		assert.equal(started.status, 202);
		assert.equal((await started.json()).requestId, "req-12345678");
		const done = await handleRuntimeFetch(post({ action: "result", requestId: "req-12345678" }), env, { surface: "node" });
		const body = await done.json();
		assert.equal(body.status, "done");
		assert.deepEqual(body.urls, ["https://imgen.x.ai/1.jpeg", "https://imgen.x.ai/2.jpeg"]);
		assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer test-key-not-real");
	});
});

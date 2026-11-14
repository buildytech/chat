/**
 * Logs carry no secrets (12-factor, plan item 6): (1) every log sink in the source is a known one whose arguments name no secret,
 * the browser app has none; (2) a run of the runtime with canary secrets (and a provider error that echoes them) writes
 * neither them nor their Basic Auth encoding to stdout, stderr or a response.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { basicAuthorizationHeader, contractFingerprint } from "../../packages/chat-agent/src/index.ts";
import { handleRuntimeFetch } from "../../apps/xai-runtime/src/http.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
const sources = (dir: string) => walk(join(ROOT, dir)).filter((p) => /\.(ts|svelte)$/.test(p) && !/\.test\.ts$/.test(p));

/** The text of a call starting at `index` (balanced parentheses). */
function callText(text: string, index: number): string {
	let depth = 0;
	for (let i = text.indexOf("(", index); i < text.length; i++) {
		if (text[i] === "(") depth++;
		else if (text[i] === ")" && --depth === 0) return text.slice(index, i + 1);
	}
	return text.slice(index);
}

const SINK = /\b(?:console\.(?:log|info|warn|error|debug|trace)|process\.(?:stdout|stderr)\.write)\s*\(/g;
const SECRET_WORDS = /\b(?:apiKey|api_key|XAI_API_KEY|authorization|password|secret|token|credential|process\.env|env)\b/i;

test("log sinks: the browser app has none; the server ones are the known ones and name no secret", () => {
	const web = sources("apps/chat-web/src").filter((p) => SINK.test(readFileSync(p, "utf8")) && !((SINK.lastIndex = 0), false));
	assert.deepEqual(web.map((p) => relative(ROOT, p)), [], "no console output in the browser app");
	const found: string[] = [];
	for (const file of [...sources("apps/xai-runtime/src"), ...sources("packages/chat-agent/src"), ...sources("packages/builder-core/src")]) {
		const text = readFileSync(file, "utf8");
		for (const m of text.matchAll(SINK)) {
			const call = callText(text, m.index!);
			found.push(`${relative(ROOT, file)}: ${call.slice(0, 60).replace(/\s+/g, " ")}`);
			const own = call.replace(/safeErrorMessage\([^)]*\)/g, "").replace(/JSON\.stringify\(status, null, 2\)/g, "");
			assert.doesNotMatch(own, SECRET_WORDS, `${relative(ROOT, file)} logs something that names a secret: ${call.slice(0, 160)}`);
		}
	}
	// The set of sinks only changes on purpose: a new one is reviewed here.
	assert.deepEqual(found.map((s) => s.split(":")[0]).sort(), [
		"apps/xai-runtime/src/chat-tools.ts",
		"apps/xai-runtime/src/http.ts",
		"apps/xai-runtime/src/http.ts",
		"apps/xai-runtime/src/server.ts",
		"apps/xai-runtime/src/server.ts",
		"apps/xai-runtime/src/status.ts"
	], found.join("\n"));
});

const KEY = "xai-CANARYKEY0123456789abcdef";
const USER = "canary-user";
const PASS = "canary-pass-9f8e7d6c";
const SECRETS = [KEY, USER, PASS, Buffer.from(`${USER}:${PASS}`).toString("base64")];

test("a runtime run with canary secrets and a provider error that echoes them leaks nothing to logs or responses", async () => {
	const out: string[] = [];
	const realLog = console.log, realError = console.error, realWarn = console.warn, realInfo = console.info;
	const realWrite = { out: process.stdout.write, err: process.stderr.write };
	const realFetch = globalThis.fetch;
	const capture = (...args: unknown[]) => void out.push(args.map(String).join(" "));
	console.log = console.error = console.warn = console.info = capture;
	process.stdout.write = ((chunk: string | Uint8Array) => (out.push(String(chunk)), true)) as typeof process.stdout.write;
	process.stderr.write = ((chunk: string | Uint8Array) => (out.push(String(chunk)), true)) as typeof process.stderr.write;
	// The provider "fails" with an error that echoes the key and the header the way upstream errors do.
	const model = { id: "grok-4.20-0309-non-reasoning", input_modalities: ["text"], output_modalities: ["text"] };
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const url = String(input instanceof Request ? input.url : input);
		// The model lists answer, the completion call fails with an error that echoes the key and its header.
		if (/\/image-generation-models$/.test(url)) return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } });
		if (/\/(models|language-models)$/.test(url)) return new Response(JSON.stringify({ data: [model] }), { status: 200, headers: { "content-type": "application/json" } });
		throw new Error(`401 Incorrect API key provided: ${KEY}. Authorization: Bearer ${KEY}`);
	}) as typeof fetch;
	const env = { VERCEL: "1", VERCEL_ENV: "preview", XAI_API_KEY: KEY, BUILDY_RUNTIME_BASIC_AUTH_USER: USER, BUILDY_RUNTIME_BASIC_AUTH_PASSWORD: PASS };
	const bodies: string[] = [];
	try {
		const auth = basicAuthorizationHeader(USER, PASS);
		const requests: Request[] = [
			new Request("https://x.vercel.app/runtime/v1/status", { headers: { Authorization: auth } }),
			new Request("https://x.vercel.app/runtime/v1/status"),
			new Request("https://x.vercel.app/runtime/v1/status", { headers: { Authorization: basicAuthorizationHeader(USER, "wrong") } }),
			new Request("https://x.vercel.app/runtime/v1/run", { method: "POST", headers: { Authorization: auth, "content-type": "application/json" }, body: "{not json" }),
			new Request("https://x.vercel.app/runtime/v1/run", {
				method: "POST",
				headers: { Authorization: auth, "content-type": "application/json" },
				body: JSON.stringify({ modelId: "grok-4.20-0309-non-reasoning", contract: contractFingerprint(), brief: "Create a dashboard" })
			})
		];
		for (const request of requests) bodies.push(await (await handleRuntimeFetch(request, env, { surface: "vercel" })).text());
	} finally {
		console.log = realLog; console.error = realError; console.warn = realWarn; console.info = realInfo;
		process.stdout.write = realWrite.out; process.stderr.write = realWrite.err;
		globalThis.fetch = realFetch;
	}
	const everything = [...out, ...bodies].join("\n");
	if (process.env.LOGS_DEBUG) console.log(JSON.stringify({ out, bodies: bodies.map((b) => b.slice(0, 300)) }, null, 1));
	for (const secret of SECRETS) assert.ok(!everything.includes(secret), `a secret reached a log or a response: ${secret.slice(0, 8)}...`);
	assert.ok(bodies.length === 5 && bodies.every((b) => b.length > 0), "every request got an answer");
});

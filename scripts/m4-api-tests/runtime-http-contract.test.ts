/**
 * The runtime HTTP contract (ADR 0065): every case of contract/runtime-http/cases/*.json runs against this repo's runtime
 * (handleRuntimeFetch) on the node and the vercel surface, with the provider and the image hosts stubbed from the case. The
 * desktop host (buildytech/buildychat-desktop) runs the same files with its own runner; a case names the surfaces it binds.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { handleRuntimeFetch } from "../../apps/xai-runtime/src/http.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = join(ROOT, "contract/runtime-http");
const SURFACES = ["node", "vercel", "desktop"] as const;
type Surface = (typeof SURFACES)[number];

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Bytes = { hex?: string; size?: number; fill?: number; picture?: string };
type Reply = { status?: number; headers?: Record<string, string>; json?: Json; text?: Json; bytes?: Bytes; throw?: string };
type Upstream = { match: { method: string; url: string; auth?: "bearer" | "none"; json?: Json }; reply: Reply };
type Case = {
	name: string;
	surfaces?: Surface[];
	env: { key: boolean };
	request: { method: string; path: string; query?: string; headers?: Record<string, string>; json?: Json; text?: Json; bytes?: Bytes; noAuth?: boolean };
	upstream?: Upstream[];
	expect: { status: number; json?: Json; headers?: Record<string, string>; bytes?: Bytes; notContains?: string[] };
};

const KEY = "contract-test-key-not-real";
const BASE = "https://xai.test/v1";
const constants = JSON.parse(readFileSync(join(DIR, "constants.json"), "utf8")) as { contract: string; candidateChatModel: string; images: { model: string } };
const files = readdirSync(join(DIR, "cases")).filter((name) => name.endsWith(".json")).sort();
const cases: Array<Case & { file: string }> = files.flatMap((file) => (JSON.parse(readFileSync(join(DIR, "cases", file), "utf8")) as { cases: Case[] }).cases.map((c) => ({ ...c, file })));

const MACROS: Record<string, string> = { $KEY: KEY, $CONTRACT: constants.contract, $CANDIDATE: constants.candidateChatModel, $IMAGE_MODEL: constants.images.model };

/** Expands the value macros of a case: `$KEY`, `$CONTRACT`, `$CANDIDATE`, `$IMAGE_MODEL` and `{ "$repeat": [text, count] }`. */
function expand(value: Json): Json {
	if (typeof value === "string") return MACROS[value] ?? value;
	if (Array.isArray(value)) return value.map(expand);
	if (value && typeof value === "object") {
		const repeat = value.$repeat;
		if (Array.isArray(repeat) && typeof repeat[0] === "string" && typeof repeat[1] === "number") return repeat[0].repeat(repeat[1]);
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expand(v)]));
	}
	return value;
}

function bytesOf(spec: Bytes): Uint8Array<ArrayBuffer> {
	if (spec.picture) return new Uint8Array(readFileSync(join(DIR, "pictures", spec.picture)));
	if (spec.hex !== undefined) return new Uint8Array(Buffer.from(spec.hex, "hex"));
	return new Uint8Array(spec.size ?? 0).fill(spec.fill ?? 0);
}

/** Subset match: objects by the expected keys, arrays by length and element, `$absent`, `$boolean`, `$prefix:<text>`. */
function matches(actual: unknown, expected: Json, path: string, problems: string[]): void {
	if (typeof expected === "string" && expected === "$boolean") {
		if (typeof actual !== "boolean") problems.push(`${path}: expected a boolean, got ${JSON.stringify(actual)}`);
		return;
	}
	if (typeof expected === "string" && expected.startsWith("$prefix:")) {
		if (typeof actual !== "string" || !actual.startsWith(expected.slice(8))) problems.push(`${path}: expected ${expected}, got ${JSON.stringify(actual)}`);
		return;
	}
	if (Array.isArray(expected)) {
		if (!Array.isArray(actual) || actual.length !== expected.length) {
			problems.push(`${path}: expected ${expected.length} items, got ${JSON.stringify(actual)}`);
			return;
		}
		expected.forEach((item, i) => matches(actual[i], item, `${path}/${i}`, problems));
		return;
	}
	if (expected && typeof expected === "object") {
		if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
			problems.push(`${path}: expected an object, got ${JSON.stringify(actual)}`);
			return;
		}
		const record = actual as Record<string, unknown>;
		for (const [key, value] of Object.entries(expected)) {
			if (value === "$absent") {
				if (key in record) problems.push(`${path}/${key}: expected absent`);
			} else matches(record[key], value, `${path}/${key}`, problems);
		}
		return;
	}
	if (actual !== expected) problems.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function envOf(surface: Surface, key: boolean): Record<string, string> {
	const env: Record<string, string> = { XAI_BASE_URL: BASE };
	if (key) env.XAI_API_KEY = KEY;
	if (surface === "vercel") Object.assign(env, { VERCEL: "1", VERCEL_ENV: "preview", BUILDY_RUNTIME_BASIC_AUTH_USER: "contract", BUILDY_RUNTIME_BASIC_AUTH_PASSWORD: "contract-pass" });
	return env;
}

function replyOf(reply: Reply): Response {
	if (reply.throw) throw new TypeError(`stubbed ${reply.throw} failure`);
	const headers = new Headers(reply.headers ?? {});
	if (reply.json !== undefined) {
		if (!headers.has("content-type")) headers.set("content-type", "application/json");
		return new Response(JSON.stringify(expand(reply.json)), { status: reply.status ?? 200, headers });
	}
	if (reply.bytes) return new Response(bytesOf(reply.bytes), { status: reply.status ?? 200, headers });
	const text = reply.text === undefined ? "" : expand(reply.text);
	return new Response(typeof text === "string" ? text : "", { status: reply.status ?? 200, headers });
}

async function runCase(c: Case, surface: Surface): Promise<string[]> {
	const problems: string[] = [];
	const pending = (c.upstream ?? []).map((u) => ({ ...u, used: false }));
	const original = globalThis.fetch;
	const quiet = { log: console.log, error: console.error };
	globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url = String(input instanceof Request ? input.url : input);
		const method = (init?.method ?? "GET").toUpperCase();
		const entry = pending.find((u) => !u.used && u.match.method === method && (u.match.url.startsWith("/") ? `${BASE}${u.match.url}` : u.match.url) === url);
		if (!entry) {
			problems.push(`unexpected upstream ${method} ${url}`);
			throw new TypeError("unexpected upstream call");
		}
		entry.used = true;
		const auth = new Headers(init?.headers).get("authorization");
		if (entry.match.auth === "bearer" && auth !== `Bearer ${KEY}`) problems.push(`${url}: expected the bearer key`);
		if (entry.match.auth === "none" && auth !== null) problems.push(`${url}: expected no authorization`);
		if (entry.match.json !== undefined) matches(JSON.parse(String(init?.body ?? "null")), expand(entry.match.json), `upstream ${entry.match.url}`, problems);
		return replyOf(entry.reply);
	};
	console.log = () => {};
	console.error = () => {};
	try {
		const r = c.request;
		const headers = new Headers(r.headers ?? {});
		let body: BodyInit | undefined;
		if (r.json !== undefined) {
			body = JSON.stringify(expand(r.json));
			if (!headers.has("content-type")) headers.set("content-type", "application/json");
		} else if (r.text !== undefined) body = String(expand(r.text));
		else if (r.bytes) body = bytesOf(r.bytes);
		if (surface === "vercel" && !r.noAuth) headers.set("authorization", `Basic ${btoa("contract:contract-pass")}`);
		const url = `http://127.0.0.1:18100${r.path}${r.query ? `?${r.query}` : ""}`;
		const res = await handleRuntimeFetch(new Request(url, { method: r.method, headers, body }), envOf(surface, c.env.key), { surface: surface === "vercel" ? "vercel" : "node" });
		const raw = new Uint8Array(await res.arrayBuffer());
		const text = Buffer.from(raw).toString("utf8");
		if (res.status !== c.expect.status) problems.push(`status: expected ${c.expect.status}, got ${res.status} ${text.slice(0, 200)}`);
		for (const [name, value] of Object.entries(c.expect.headers ?? {})) if (res.headers.get(name) !== value) problems.push(`header ${name}: expected ${value}, got ${res.headers.get(name)}`);
		if (c.expect.json !== undefined) {
			let parsed: unknown;
			try {
				parsed = JSON.parse(text);
			} catch {
				problems.push(`body is not JSON: ${text.slice(0, 120)}`);
			}
			if (parsed !== undefined) matches(parsed, expand(c.expect.json), "", problems);
		}
		if (c.expect.bytes && Buffer.compare(Buffer.from(raw), Buffer.from(bytesOf(c.expect.bytes))) !== 0) problems.push("body bytes differ");
		if (c.expect.status === 204 && raw.length) problems.push("204 with a body");
		for (const word of [KEY, ...(c.expect.notContains ?? []).map((w) => MACROS[w] ?? w)]) if (text.includes(word)) problems.push(`the answer contains ${word === KEY ? "the key" : word}`);
		for (const u of pending) if (!u.used) problems.push(`upstream ${u.match.method} ${u.match.url} was not called`);
	} finally {
		globalThis.fetch = original;
		console.log = quiet.log;
		console.error = quiet.error;
	}
	return problems;
}

test("contract files: at least 25 cases, unique names, known surfaces, generated files current", () => {
	assert.ok(cases.length >= 25, `${cases.length} cases`);
	const names = cases.map((c) => c.name);
	assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), [], "unique case names");
	for (const c of cases) for (const s of c.surfaces ?? SURFACES) assert.ok(SURFACES.includes(s), `${c.name}: surface ${s}`);
	const gen = spawnSync(process.execPath, ["--experimental-strip-types", "--import", "./packages/builder-core/src/catalog/props-gate.ts", "scripts/runtime-contract.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
	assert.equal(gen.status, 0, gen.stderr);
});

for (const c of cases) {
	for (const surface of (c.surfaces ?? SURFACES).filter((s) => s !== "desktop")) {
		test(`[${surface}] ${c.file}: ${c.name}`, async () => {
			assert.deepEqual(await runCase(c, surface), []);
		});
	}
}

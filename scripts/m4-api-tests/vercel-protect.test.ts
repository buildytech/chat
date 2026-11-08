import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
	authorizeBasic,
	basicAuthorizationHeader,
	clampRunBudgetMs,
	isSharedPublicSurface,
	stripRuntimePrefix,
	VERCEL_HOBBY_SAFE_MAX_DURATION_SEC
} from "../../packages/builder-core/src/index.ts";
import { handleRuntimeFetch } from "../../apps/xai-runtime/src/http.ts";
import middleware, { config as middlewareConfig } from "../../middleware.ts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../..");

const AUTH_USER = "staging-user";
const AUTH_PASS = "staging-pass";
const AUTH = basicAuthorizationHeader(AUTH_USER, AUTH_PASS);

const PROTECTED_PATHS = [
	"https://example.vercel.app/",
	"https://example.vercel.app/200.html",
	"https://example.vercel.app/_app/immutable/entry.js",
	"https://example.vercel.app/runtime/v1/status",
	"https://example.vercel.app/runtime/v1/run",
	"https://example.vercel.app/api/runtime/v1/status",
	"https://example.vercel.app/api/runtime/v1/run",
	"https://example.vercel.app/favicon.ico",
	"https://example.vercel.app/healthz"
];

function vercelEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
	return {
		VERCEL: "1",
		VERCEL_ENV: "preview",
		BUILDY_RUNTIME_BASIC_AUTH_USER: extra.BUILDY_RUNTIME_BASIC_AUTH_USER,
		BUILDY_RUNTIME_BASIC_AUTH_PASSWORD: extra.BUILDY_RUNTIME_BASIC_AUTH_PASSWORD,
		XAI_API_KEY: extra.XAI_API_KEY,
		BUILDY_RUNTIME_BIND: extra.BUILDY_RUNTIME_BIND
	};
}

function withAuth(env: NodeJS.ProcessEnv = vercelEnv()): NodeJS.ProcessEnv {
	return {
		...env,
		BUILDY_RUNTIME_BASIC_AUTH_USER: AUTH_USER,
		BUILDY_RUNTIME_BASIC_AUTH_PASSWORD: AUTH_PASS
	};
}

async function asJson(res: Response): Promise<Record<string, unknown>> {
	return (await res.json()) as Record<string, unknown>;
}

test("vercel.json is Other + static SPA output + hobby-safe Node function, no matcher hole", () => {
	const cfg = JSON.parse(readFileSync(join(REPO, "vercel.json"), "utf8")) as {
		framework: null;
		outputDirectory: string;
		buildCommand: string;
		functions: Record<string, { maxDuration?: number }>;
		rewrites: Array<{ source: string; destination: string }>;
		proxy?: { matcher?: unknown };
	};
	assert.equal(cfg.framework, null);
	assert.equal(cfg.outputDirectory, "apps/chat-web/build");
	assert.match(cfg.buildCommand, /chat-web/);
	assert.equal(cfg.functions["api/runtime/[...path].ts"]?.maxDuration, VERCEL_HOBBY_SAFE_MAX_DURATION_SEC);
	assert.ok(cfg.rewrites.some((row) => row.source.startsWith("/runtime") && row.destination.includes("/api/runtime")));
	assert.equal(cfg.proxy?.matcher, undefined);
	assert.ok(
		!JSON.stringify(cfg).includes("_next/static"),
		"must not copy Next.js matcher that skips static files"
	);
});

test("Routing Middleware uses Node runtime and has no static-file matcher", () => {
	assert.equal(middlewareConfig.runtime, "nodejs");
	assert.equal("matcher" in middlewareConfig, false);
});

test("Vercel is a shared public surface even when BIND looks like loopback", () => {
	assert.equal(isSharedPublicSurface({ VERCEL: "1", BUILDY_RUNTIME_BIND: "127.0.0.1" }), true);
	assert.equal(isSharedPublicSurface({ VERCEL_ENV: "preview" }), true);
	assert.equal(isSharedPublicSurface({ BUILDY_RUNTIME_BIND: "127.0.0.1" }), false);
	assert.equal(clampRunBudgetMs(90_000, { VERCEL: "1" }), 60_000);
	assert.equal(clampRunBudgetMs(90_000, { BUILDY_RUNTIME_BIND: "127.0.0.1" }), 90_000);
});

test("missing Basic Auth config denies shared surfaces (does not expose)", () => {
	const env = vercelEnv();
	const denied = authorizeBasic("Basic dXNlcjpwYXNz", env);
	assert.equal(denied.ok, false);
	if (denied.ok) throw new Error("expected deny");
	assert.equal(denied.code, "basic_auth_required_before_shared_bind");
	assert.equal(authorizeBasic(undefined, env, { allowLoopbackUnauthenticated: true }).ok, false);
});

test("unauthenticated requests are 401 on page, assets, runtime, and api paths", async () => {
	const env = withAuth();
	for (const url of PROTECTED_PATHS) {
		const mid = middleware(new Request(url));
		assert.ok(mid, url);
		assert.equal(mid?.status, 401, url);
		const handled = await handleRuntimeFetch(new Request(url), env, { surface: "vercel" });
		assert.equal(handled.status, 401, `handler ${url}`);
		assert.equal(handled.headers.get("www-authenticate")?.includes("Basic"), true, url);
	}
});

test("wrong Basic Auth is 401; valid Basic Auth passes the gate", async () => {
	const env = withAuth();
	const wrong = basicAuthorizationHeader("nope", "nope");
	const denied = await handleRuntimeFetch(
		new Request("https://example.vercel.app/runtime/v1/status", { headers: { Authorization: wrong } }),
		env,
		{ surface: "vercel" }
	);
	assert.equal(denied.status, 401);
	const allowed = authorizeBasic(AUTH, env);
	assert.equal(allowed.ok, true);
});

test("path variants map onto the runtime routes", () => {
	assert.equal(stripRuntimePrefix("/runtime/v1/status"), "/v1/status");
	assert.equal(stripRuntimePrefix("/api/runtime/v1/run"), "/v1/run");
	assert.equal(stripRuntimePrefix("/api/runtime/healthz"), "/healthz");
	assert.equal(stripRuntimePrefix("/v1/status"), "/v1/status");
});

test("XAI_API_KEY absent returns 503 and does not call the provider", async () => {
	const env = withAuth();
	const calls: string[] = [];
	const original = globalThis.fetch;
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		calls.push(String(input));
		throw new Error("provider fetch must not run");
	}) as typeof fetch;
	try {
		const status = await handleRuntimeFetch(
			new Request("https://example.vercel.app/runtime/v1/status", { headers: { Authorization: AUTH } }),
			env,
			{ surface: "vercel" }
		);
		assert.equal(status.status, 503);
		const statusBody = await asJson(status);
		assert.equal(statusBody.code, "xai_api_key_missing");
		assert.equal((statusBody.key as { present?: boolean } | undefined)?.present, false);

		const run = await handleRuntimeFetch(
			new Request("https://example.vercel.app/api/runtime/v1/run", {
				method: "POST",
				headers: { Authorization: AUTH, "content-type": "application/json" },
				body: JSON.stringify({
					modelId: "grok-4.20-0309-non-reasoning",
					brief: "Create a dashboard"
				})
			}),
			env,
			{ surface: "vercel" }
		);
		assert.equal(run.status, 503);
		const runBody = await asJson(run);
		const err = runBody.error as { code?: string } | undefined;
		assert.equal(err?.code, "xai_api_key_missing");
		assert.equal(calls.length, 0);
	} finally {
		globalThis.fetch = original;
	}
});

test("valid auth on an unknown runtime path is 404, not an open page", async () => {
	const env = withAuth();
	const res = await handleRuntimeFetch(
		new Request("https://example.vercel.app/runtime/secret", { headers: { Authorization: AUTH } }),
		env,
		{ surface: "vercel" }
	);
	assert.equal(res.status, 404);
});

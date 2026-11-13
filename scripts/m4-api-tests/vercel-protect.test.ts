import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	authorizeBasic,
	basicAuthorizationHeader,
	clampRunBudgetMs,
	isSharedPublicSurface,
	stripRuntimePrefix,
	timingSafeEqualString,
	VERCEL_HOBBY_SAFE_MAX_DURATION_SEC,
	VERCEL_RUN_MAX_DURATION_SEC
} from "../../packages/builder-core/src/index.ts";
import { handleRuntimeFetch } from "../../apps/xai-runtime/src/http.ts";
import { contractFingerprint } from "../../packages/builder-core/src/index.ts";
import middleware, { config as middlewareConfig } from "../../middleware.js";

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

function withProcessEnv<T>(patch: NodeJS.ProcessEnv, fn: () => T): T {
	const keys = Object.keys(patch);
	const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
	for (const key of keys) {
		const value = patch[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	try {
		return fn();
	} finally {
		for (const key of keys) {
			if (previous[key] === undefined) delete process.env[key];
			else process.env[key] = previous[key];
		}
	}
}

test("root tsconfig typechecks Vercel entry files only", () => {
	const cfg = JSON.parse(readFileSync(join(REPO, "tsconfig.json"), "utf8")) as { include: string[] };
	assert.ok(cfg.include.includes("api/**/*.ts"));
	assert.ok(cfg.include.includes("api/**/*.d.ts"));
});

test("vercel.json is Other + static SPA output + hobby-safe Node function, no matcher hole", () => {
	const cfg = JSON.parse(readFileSync(join(REPO, "vercel.json"), "utf8")) as {
		framework: null;
		outputDirectory: string;
		buildCommand: string;
		functions: Record<string, { maxDuration?: number; runtime?: string }>;
		rewrites: Array<{ source: string; destination: string }>;
		proxy?: { matcher?: unknown };
	};
	assert.equal(cfg.framework, null);
	assert.equal(cfg.outputDirectory, "apps/chat-web/build");
	assert.match(cfg.buildCommand, /bundle-vercel-runtime/);
	assert.match(cfg.buildCommand, /chat-web/);
	assert.equal(cfg.functions["api/runtime/[...path].ts"], undefined);
	assert.equal(cfg.functions["api/runtime/v1/status.js"], undefined);
	assert.equal(cfg.functions["api/runtime/v1/run.js"], undefined);
	assert.equal(cfg.functions["api/runtime/v1/status.ts"]?.maxDuration, VERCEL_HOBBY_SAFE_MAX_DURATION_SEC);
	assert.equal(cfg.functions["api/runtime/v1/run.ts"]?.maxDuration, VERCEL_RUN_MAX_DURATION_SEC);
	assert.ok(VERCEL_RUN_MAX_DURATION_SEC <= 300, "Hobby + fluid compute max is 300 s");
	assert.equal(cfg.functions["api/runtime/v1/status.ts"]?.runtime, undefined);
	assert.equal(cfg.functions["api/runtime/v1/run.ts"]?.runtime, undefined);
	for (const fn of Object.values(cfg.functions)) {
		assert.equal(
			fn.runtime,
			undefined,
			"functions.runtime is a custom runtime (name@version), not Node; pin Node with package.json engines.node"
		);
	}
	assert.ok(
		cfg.rewrites.some((row) => row.source === "/runtime/v1/status" && row.destination === "/api/runtime/v1/status")
	);
	assert.ok(cfg.rewrites.some((row) => row.source === "/runtime/v1/run" && row.destination === "/api/runtime/v1/run"));
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
	assert.equal(clampRunBudgetMs(90_000, { VERCEL: "1" }), 90_000);
	assert.equal(clampRunBudgetMs(999_999, { VERCEL: "1" }), (VERCEL_RUN_MAX_DURATION_SEC - 15) * 1000);
	assert.equal(clampRunBudgetMs(undefined, { VERCEL: "1" }), (VERCEL_RUN_MAX_DURATION_SEC - 15) * 1000);
	assert.equal(clampRunBudgetMs(90_000, { BUILDY_RUNTIME_BIND: "127.0.0.1" }), 90_000);
	assert.equal(clampRunBudgetMs(999_999, { BUILDY_RUNTIME_BIND: "127.0.0.1" }), 240_000);
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
		assert.equal(statusBody.ready, false);
		assert.equal(statusBody.liveModel, false);
		assert.equal((statusBody.key as { present?: boolean } | undefined)?.present, false);

		const run = await handleRuntimeFetch(
			new Request("https://example.vercel.app/api/runtime/v1/run", {
				method: "POST",
				headers: { Authorization: AUTH, "content-type": "application/json" },
				body: JSON.stringify({
					modelId: "grok-4.20-0309-non-reasoning",
					contract: contractFingerprint(),
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

		// A tab built from another deploy (other or missing contract) is told to reload; no model call.
		for (const contract of [undefined, "cf1-stale"]) {
			const stale = await handleRuntimeFetch(
				new Request("https://example.vercel.app/api/runtime/v1/run", {
					method: "POST",
					headers: { Authorization: AUTH, "content-type": "application/json" },
					body: JSON.stringify({ modelId: "grok-4.20-0309-non-reasoning", contract, brief: "Create a dashboard" })
				}),
				env,
				{ surface: "vercel" }
			);
			assert.equal(stale.status, 409);
			const staleBody = await asJson(stale);
			assert.equal(staleBody.code, "client_outdated");
			assert.equal(staleBody.ok, false);
		}
		assert.equal(calls.length, 0);
	} finally {
		globalThis.fetch = original;
	}
});

test("root package.json is ESM so Vercel middleware.js is a module", () => {
	const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")) as {
		type?: string;
		engines?: { node?: string };
	};
	assert.equal(pkg.type, "module");
	assert.equal(pkg.engines?.node, "22.x");
	const runtimePkg = JSON.parse(readFileSync(join(REPO, "apps/xai-runtime/package.json"), "utf8")) as {
		engines?: { node?: string };
	};
	assert.equal(runtimePkg.engines?.node, "22.x");
	const webPkg = JSON.parse(readFileSync(join(REPO, "apps/chat-web/package.json"), "utf8")) as {
		engines?: { node?: string };
	};
	assert.equal(webPkg.engines?.node, "22.x");
});

test("middleware source has no runtime imports (Vercel Other does not bundle it)", () => {
	const src = readFileSync(join(REPO, "middleware.js"), "utf8");
	assert.doesNotMatch(src, /^\s*import\s/m);
	assert.doesNotMatch(src, /from\s+['"][^'"]+\.ts['"]/);
	assert.doesNotMatch(src, /:\s*(Request|Response|string|boolean)\b/);
	assert.match(src, /BUILDY_RUNTIME_BASIC_AUTH_PASSWORD/);
	assert.match(src, /timingSafeEqualString/);
	assert.equal(existsSync(join(REPO, "middleware.ts")), false);
});

test("Vercel functions are bundled JS artifacts, not workspace TypeScript exports", async () => {
	assert.equal(existsSync(join(REPO, "api/runtime/[...path].ts")), false);
	const source = readFileSync(join(REPO, "apps/xai-runtime/src/vercel-fetch.ts"), "utf8");
	assert.match(source, /from "\.\/http\.ts"/);
	assert.match(source, /export default \{/);
	const bundled = spawnSync(process.execPath, [join(REPO, "scripts/bundle-vercel-runtime.mjs")], {
		encoding: "utf8",
		cwd: REPO
	});
	assert.equal(bundled.status, 0, bundled.stderr || bundled.stdout);
	const statusFile = join(REPO, "api/runtime/v1/status.ts");
	const runFile = join(REPO, "api/runtime/v1/run.ts");
	const statusSrc = readFileSync(statusFile, "utf8");
	const runSrc = readFileSync(runFile, "utf8");
	assert.equal(statusSrc, runSrc);
	for (const name of ["status.ts", "run.ts"]) {
		const file = join(REPO, "api/runtime/v1", name);
		assert.equal(existsSync(file), true, name);
		const js = readFileSync(file, "utf8");
		assert.doesNotMatch(js, /from ["']@buildytech\//);
		assert.doesNotMatch(js, /from ["']\.\/http\.ts["']/);
		assert.doesNotMatch(js, /node_modules\/@buildytech\/xai-runtime\/src\/http\.ts/);
		assert.match(js, /xai-grok/);
		assert.match(js, /codegen-x/);
		assert.match(js, /apps\/xai-runtime\/src\/http\.ts/);
		assert.match(js, /catalog\/snapshot\.json/);
		assert.equal([...js.matchAll(/^export /gm)].length, 2, "only footer export const config + export default");
		assert.doesNotMatch(js, /\nexport (async )?function /);
		const mod = (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)) as {
			default: { fetch: (request: Request) => Promise<Response> };
			config: { maxDuration: number };
		};
		assert.equal(typeof mod.default.fetch, "function");
		assert.equal(mod.config.maxDuration, VERCEL_RUN_MAX_DURATION_SEC);
		const res = await withProcessEnv(withAuth(), () =>
			mod.default.fetch(
				new Request("https://example.vercel.app/runtime/v1/status", { headers: { Authorization: AUTH } })
			)
		);
		assert.equal(res.status, 503);
		const body = (await res.json()) as { code?: string; runtime?: string };
		assert.equal(body.code, "xai_api_key_missing");
		assert.equal(body.runtime, "xai-grok");
	}
});

test("Vercel API typecheck has AI SDK shims and does not silently assemble Grok turns", () => {
	assert.equal(existsSync(join(REPO, "api/ai-shims.d.ts")), true);
	const shims = readFileSync(join(REPO, "api/ai-shims.d.ts"), "utf8");
	assert.match(shims, /declare module "@ai-sdk\/openai"/);
	assert.match(shims, /declare module "ai"/);
	assert.match(shims, /declare module "zod"/);
	assert.doesNotMatch(shims, /^\s*export function enum\b/m);
	assert.match(shims, /\benum:\s*\(/);
	const tools = readFileSync(join(REPO, "apps/xai-runtime/src/chat-tools.ts"), "utf8");
	assert.doesNotMatch(tools, /runConstructorTools\(ctx\)/);
	assert.match(tools, /write_stuck/, "the loop stops after two identical error lists instead of looping or assembling a page itself");
	assert.doesNotMatch(tools, /assembleLayout|proposeLayout/);
});

test("timingSafeEqualString is length-aware and rejects mismatches", () => {
	assert.equal(timingSafeEqualString("abc", "abc"), true);
	assert.equal(timingSafeEqualString("", ""), true);
	assert.equal(timingSafeEqualString("abc", "abd"), false);
	assert.equal(timingSafeEqualString("abc", "ab"), false);
	assert.equal(timingSafeEqualString("ab", "abc"), false);
});

test("middleware.js loads as ESM without .ts imports and 401s without secrets", async () => {
	const middlewareJs = readFileSync(join(REPO, "middleware.js"), "utf8");
	assert.doesNotMatch(middlewareJs, /from\s+['"][^'"]+\.ts['"]/);
	assert.doesNotMatch(middlewareJs, /^\s*import\s/m);
	assert.match(middlewareJs, /export\s+(default|const)/);
	const dest = join(REPO, "tmp", "vercel-middleware-esm");
	rmSync(dest, { recursive: true, force: true });
	mkdirSync(dest, { recursive: true });
	const file = join(dest, "middleware.mjs");
	writeFileSync(file, middlewareJs);
	const mod = (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)) as {
		default: (request: Request) => Response | undefined;
		config: { runtime: string };
	};
	assert.equal(mod.config.runtime, "nodejs");
	const denied = withProcessEnv(
		{
			VERCEL: "1",
			VERCEL_ENV: "preview",
			BUILDY_RUNTIME_BASIC_AUTH_USER: undefined,
			BUILDY_RUNTIME_BASIC_AUTH_PASSWORD: undefined
		},
		() => mod.default(new Request("https://byc-staging-7q4.vercel.app/"))
	);
	assert.ok(denied);
	assert.equal(denied?.status, 401);
	assert.equal(denied?.headers.get("www-authenticate")?.includes("Basic"), true);
	const body = (await denied.json()) as { error?: { code?: string } };
	assert.equal(body.error?.code, "basic_auth_required_before_shared_bind");

	const apiSrc = readFileSync(join(REPO, "apps/xai-runtime/src/vercel-fetch.ts"), "utf8");
	assert.match(apiSrc, /from "\.\/http\.ts"/);
});

test("valid Basic Auth passes middleware; wrong credentials stay 401", () => {
	withProcessEnv(withAuth(), () => {
		const allowed = middleware(
			new Request("https://example.vercel.app/200.html", { headers: { Authorization: AUTH } })
		);
		assert.equal(allowed, undefined);
		const denied = middleware(
			new Request("https://example.vercel.app/", {
				headers: { Authorization: basicAuthorizationHeader("nope", "nope") }
			})
		);
		assert.equal(denied?.status, 401);
	});
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

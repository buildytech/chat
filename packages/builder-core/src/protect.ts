/**
 * Fail-closed Basic Auth for any shared/public surface (Vercel, non-loopback bind).
 * Missing user/password is a deny, never an open site. Loopback Node is the only
 * unauthenticated exception, and Vercel is never treated as loopback.
 */
import { readEnv, type EnvMap } from "./env-map.ts";

export type { EnvMap };

/** Hobby-safe Function duration from Vercel docs examples (seconds). Not Pro 300/800. */
export const VERCEL_HOBBY_SAFE_MAX_DURATION_SEC = 60;

export function isLoopbackBind(bind: string | undefined): boolean {
	const value = (bind ?? "127.0.0.1").trim();
	return value === "127.0.0.1" || value === "::1" || value === "localhost";
}

export function isSharedPublicSurface(env?: EnvMap): boolean {
	env = readEnv(env);
	const vercel = env.VERCEL?.trim();
	if (vercel === "1" || vercel === "true") return true;
	const vercelEnv = env.VERCEL_ENV?.trim();
	if (vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "development") return true;
	return !isLoopbackBind(env.BUILDY_RUNTIME_BIND);
}

export function readBasicAuthConfig(env?: EnvMap): {
	user: string;
	pass: string;
	configured: boolean;
} {
	env = readEnv(env);
	const user = env.BUILDY_RUNTIME_BASIC_AUTH_USER?.trim() ?? "";
	const pass = env.BUILDY_RUNTIME_BASIC_AUTH_PASSWORD?.trim() ?? "";
	return { user, pass, configured: Boolean(user && pass) };
}

function decodeBasic(authorization: string): { user: string; pass: string } | null {
	if (!authorization.startsWith("Basic ")) return null;
	const encoded = authorization.slice(6).trim();
	if (!encoded) return null;
	try {
		const decoded = atob(encoded);
		const idx = decoded.indexOf(":");
		if (idx < 0) return null;
		return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
	} catch {
		return null;
	}
}

export function authorizeBasic(
	authorization: string | null | undefined,
	env?: EnvMap,
	opts: { allowLoopbackUnauthenticated?: boolean } = {}
): { ok: true } | { ok: false; code: "unauthorized" | "basic_auth_required_before_shared_bind" } {
	env = readEnv(env);
	const shared = isSharedPublicSurface(env);
	const { user, pass, configured } = readBasicAuthConfig(env);
	if (!configured) {
		const loopbackOk =
			Boolean(opts.allowLoopbackUnauthenticated) && !shared && isLoopbackBind(env.BUILDY_RUNTIME_BIND);
		if (loopbackOk) return { ok: true };
		return { ok: false, code: "basic_auth_required_before_shared_bind" };
	}
	const parsed = decodeBasic(authorization ?? "");
	if (!parsed || parsed.user !== user || parsed.pass !== pass) {
		return { ok: false, code: "unauthorized" };
	}
	return { ok: true };
}

export function unauthorizedResponse(
	code: "unauthorized" | "basic_auth_required_before_shared_bind" = "unauthorized"
): Response {
	const message =
		code === "basic_auth_required_before_shared_bind"
			? "Basic authentication is not configured. Public access is denied."
			: "Basic authentication required.";
	return new Response(JSON.stringify({ error: { code, message } }), {
		status: 401,
		headers: {
			"WWW-Authenticate": 'Basic realm="buildy-constructor"',
			"content-type": "application/json",
			"cache-control": "no-store"
		}
	});
}

export function gateRequest(
	request: Request,
	env?: EnvMap,
	opts: { allowLoopbackUnauthenticated?: boolean } = {}
): Response | null {
	const result = authorizeBasic(request.headers.get("authorization"), readEnv(env), opts);
	if (result.ok) return null;
	return unauthorizedResponse(result.code);
}

export function basicAuthorizationHeader(user: string, pass: string): string {
	return `Basic ${btoa(`${user}:${pass}`)}`;
}

export function clampRunBudgetMs(requested: unknown, env?: EnvMap): number {
	const asked = Number(requested);
	const fallback = 90_000;
	const raw = Number.isFinite(asked) && asked > 0 ? asked : fallback;
	const cap = isSharedPublicSurface(readEnv(env)) ? VERCEL_HOBBY_SAFE_MAX_DURATION_SEC * 1000 : fallback;
	return Math.min(raw, cap, fallback);
}

export function stripRuntimePrefix(pathname: string): string {
	let path = pathname || "/";
	for (const prefix of ["/api/runtime", "/runtime", "/api"]) {
		if (path === prefix) return "/";
		if (path.startsWith(`${prefix}/`)) {
			path = path.slice(prefix.length);
			break;
		}
	}
	if (!path.startsWith("/")) path = `/${path}`;
	return path;
}

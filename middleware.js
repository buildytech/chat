/**
 * Vercel Routing Middleware (file convention). Other / framework-null copies
 * this file to /var/task/middleware.js WITHOUT bundling. Root package.json
 * must be "type": "module". No imports (especially no .ts specifiers).
 * Keep the gate aligned with packages/builder-core/src/protect.ts.
 * https://vercel.com/docs/routing-middleware/getting-started
 */

export const config = {
	runtime: "nodejs"
};

function envOf() {
	return process.env;
}

/** Web-safe constant-time compare. Do not import node:crypto here. */
function timingSafeEqualString(left, right) {
	const encoder = new TextEncoder();
	const a = encoder.encode(left);
	const b = encoder.encode(right);
	const len = Math.max(a.length, b.length, 1);
	let diff = a.length ^ b.length;
	for (let i = 0; i < len; i++) {
		diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	}
	return diff === 0;
}

function decodeBasic(authorization) {
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

function unauthorizedResponse(code) {
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

export default function middleware(request) {
	const env = envOf();
	const user = env.BUILDY_RUNTIME_BASIC_AUTH_USER?.trim() ?? "";
	const pass = env.BUILDY_RUNTIME_BASIC_AUTH_PASSWORD?.trim() ?? "";
	if (!user || !pass) {
		return unauthorizedResponse("basic_auth_required_before_shared_bind");
	}
	const parsed = decodeBasic(request.headers.get("authorization") ?? "") ?? { user: "", pass: "" };
	const userOk = timingSafeEqualString(parsed.user, user);
	const passOk = timingSafeEqualString(parsed.pass, pass);
	if (!userOk || !passOk) return unauthorizedResponse("unauthorized");
}

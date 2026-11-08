/**
 * Vercel Routing Middleware (file convention). Runs on every request, including
 * static SPA assets and /api functions. Missing Basic Auth config denies.
 * https://vercel.com/docs/routing-middleware/getting-started
 */
import { gateRequest } from "./packages/builder-core/src/protect.ts";

export const config = {
	runtime: "nodejs" as const
};

export default function middleware(request: Request): Response | undefined {
	const blocked = gateRequest(request, process.env, { allowLoopbackUnauthenticated: false });
	if (blocked) return blocked;
}

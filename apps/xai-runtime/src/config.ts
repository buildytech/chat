/**
 * The one typed config of xai-runtime (12-factor, plan item 6, audit F-01) and the only place the app reads `process.env`.
 * Entry points call `runtimeEnv()` and pass the bag down (`handleRuntimeFetch(request, env)`); the helpers below turn it
 * into typed values. Names: BUILDY_RUNTIME_BIND, BUILDY_RUNTIME_PORT (local server only), plus the secrets and Basic Auth names
 * the chat-agent package reads from the same bag (XAI_API_KEY, BUILDY_RUNTIME_BASIC_AUTH_*). `.env.example` documents all of them.
 */
import type { EnvMap } from "@buildytech/chat-agent";

/** The process environment, read once at the entry point. */
export const runtimeEnv = (): EnvMap => process.env;

export type ServerConfig = { bind: string; port: number };

/** Where the local Node server listens; loopback unless BUILDY_RUNTIME_BIND says otherwise (then Basic Auth is required). */
export function readServerConfig(env: EnvMap): ServerConfig {
	const port = Number(env.BUILDY_RUNTIME_PORT || 18100);
	return { bind: env.BUILDY_RUNTIME_BIND?.trim() || "127.0.0.1", port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 18100 };
}

/**
 * Vercel Node Function entry (Web fetch). scripts/bundle-vercel-runtime.mjs
 * inlines this file and its workspace graph into api/runtime/v1/status.ts
 * and run.ts so /var/task does not import @buildytech/xai-runtime/src/http.ts.
 * https://vercel.com/docs/functions/runtimes/node-js
 */
import { runtimeEnv } from "./config.ts";
import { handleRuntimeFetch } from "./http.ts";

// Upper bound for the bundled run entry (Hobby + fluid compute max). vercel.json keeps
// status at 60 s and run at 300 s per function.
export const config = {
	maxDuration: 300
};

export default {
	async fetch(request: Request): Promise<Response> {
		return handleRuntimeFetch(request, runtimeEnv(), { surface: "vercel" });
	}
};

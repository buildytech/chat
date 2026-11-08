/**
 * Vercel Node Function entry (Web fetch). scripts/bundle-vercel-runtime.mjs
 * inlines this file and its workspace graph into api/runtime/v1/status.ts
 * and run.ts so /var/task does not import @buildytech/xai-runtime/src/http.ts.
 * https://vercel.com/docs/functions/runtimes/node-js
 */
import { handleRuntimeFetch } from "./http.ts";

export const config = {
	maxDuration: 60
};

export default {
	async fetch(request: Request): Promise<Response> {
		return handleRuntimeFetch(request, process.env, { surface: "vercel" });
	}
};

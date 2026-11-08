/**
 * Vercel Node.js Function (Web fetch handler).
 * https://vercel.com/docs/functions/runtimes/node-js
 * Hobby-safe maxDuration 60s from documented examples. Not Pro 300/800.
 */
import { handleRuntimeFetch } from "../../apps/xai-runtime/src/http.ts";

export const config = {
	maxDuration: 60
};

export default {
	async fetch(request: Request): Promise<Response> {
		return handleRuntimeFetch(request, process.env, { surface: "vercel" });
	}
};

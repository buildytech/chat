/// <reference path="../../ai-shims.d.ts" />
/**
 * Concrete Other-framework Function for POST /api/runtime/v1/run.
 * framework:null does not map Next.js `[...path]` catch-alls; those 404 at the platform.
 * https://vercel.com/docs/functions/quickstart
 */
import { handleRuntimeFetch } from "@buildytech/xai-runtime/http";

export const config = {
	maxDuration: 60
};

export default {
	async fetch(request: Request): Promise<Response> {
		return handleRuntimeFetch(request, process.env, { surface: "vercel" });
	}
};

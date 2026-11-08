import {
	clampRunBudgetMs,
	gateRequest,
	isSharedPublicSurface,
	mapChatRunRequest,
	readXaiKeyState,
	safeErrorMessage,
	stripRuntimePrefix
} from "@buildytech/builder-core";
import { runXaiCatalogTurn, revalidateProposal } from "./chat-tools.ts";
import { runtimeStatus } from "./status.ts";

export { VERCEL_HOBBY_SAFE_MAX_DURATION_SEC } from "@buildytech/builder-core";

const MAX_BODY = 256_000;

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
			"cache-control": "no-store"
		}
	});
}

function combinedAbort(request: Request, ms: number): AbortSignal {
	const timeout = AbortSignal.timeout(ms);
	if (typeof AbortSignal.any === "function") {
		return AbortSignal.any([request.signal, timeout]);
	}
	return timeout;
}

export async function handleRuntimeFetch(
	request: Request,
	env: NodeJS.ProcessEnv = process.env,
	opts: { surface: "vercel" | "node" } = { surface: "node" }
): Promise<Response> {
	const allowLoopback = opts.surface === "node" && !isSharedPublicSurface(env);
	const blocked = gateRequest(request, env, { allowLoopbackUnauthenticated: allowLoopback });
	if (blocked) return blocked;

	const url = new URL(request.url);
	const path = stripRuntimePrefix(url.pathname);
	const method = (request.method || "GET").toUpperCase();

	if (method === "OPTIONS") {
		return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
	}

	try {
		if (method === "GET" && (path === "/healthz" || path === "/health")) {
			return jsonResponse(200, { ok: true, runtime: "xai-grok" });
		}
		if (method === "GET" && (path === "/v1/status" || path === "/v1/runtime")) {
			const status = await runtimeStatus(env);
			return jsonResponse(status.key.present ? 200 : 503, status);
		}
		if (method === "POST" && path === "/v1/run") {
			const status = await runtimeStatus(env);
			const raw = await request.text();
			if (raw.length > MAX_BODY) {
				return jsonResponse(413, { error: { code: "too_large", message: "payload too large" }, liveModel: false });
			}
			let body: Record<string, unknown> = {};
			if (raw.trim()) {
				try {
					body = JSON.parse(raw) as Record<string, unknown>;
				} catch {
					return jsonResponse(400, { error: { code: "invalid_json", message: "invalid json" }, liveModel: false });
				}
			}
			const mapped = mapChatRunRequest(body, {
				discoveredChatIds: status.models.listed ? status.models.chatIds : undefined,
				allowUnlistedTrial: !status.ready
			});
			if (!mapped.ok) {
				return jsonResponse(422, {
					ok: false,
					code: mapped.code,
					message: mapped.message,
					requestedId: mapped.requestedId,
					liveModel: false
				});
			}
			const key = readXaiKeyState(env);
			if (!key.present) {
				return jsonResponse(503, {
					error: {
						code: "xai_api_key_missing",
						message: "XAI_API_KEY is not provisioned here. No provider call was made."
					},
					liveModel: false,
					modelId: mapped.request.modelId
				});
			}
			if (!status.ready) {
				return jsonResponse(503, {
					error: {
						code: status.code,
						message: "xAI runtime is not ready. This is not a live Grok reply. No provider call was made."
					},
					modelId: mapped.request.modelId,
					status,
					liveModel: false
				});
			}
			const ms = clampRunBudgetMs(body.abortMs, env);
			const signal = combinedAbort(request, ms);
			try {
				const { proposal, meta } = await runXaiCatalogTurn(
					env.XAI_API_KEY!.trim(),
					mapped.request.modelId,
					{
						brief: mapped.request.brief,
						scenarioId: mapped.request.scenarioId,
						screenId: mapped.request.screenId,
						expectedRevision: mapped.request.expectedRevision,
						pageId: mapped.request.pageId
					},
					signal
				);
				const checked = revalidateProposal(proposal);
				return jsonResponse(checked.ok ? 200 : 422, {
					...checked,
					liveModel: false,
					liveXai: checked.ok && meta.toolCallingWorked,
					toolCallingProven: meta.toolCallingWorked,
					runtime: "xai-grok",
					modelId: meta.modelId,
					requestedModelId: mapped.request.modelId,
					path: meta.path,
					usage: meta.usage
				});
			} catch (err) {
				const safe = safeErrorMessage(err);
				const aborted =
					signal.aborted || safe.code === "AbortError" || safe.message.toLowerCase().includes("abort");
				return jsonResponse(aborted ? 499 : 500, {
					ok: false,
					code: aborted ? "aborted" : safe.code,
					message: aborted
						? "The run was cancelled. Usage is unknown, not zero."
						: "The xAI chat request could not be completed. No automatic retry was sent.",
					liveModel: false
				});
			}
		}
		return jsonResponse(404, { error: { code: "not_found", message: "Unknown runtime path." } });
	} catch (err) {
		const safe = safeErrorMessage(err);
		return jsonResponse(500, { error: safe, liveModel: false });
	}
}

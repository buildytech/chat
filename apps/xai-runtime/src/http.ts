import {
	clampRunBudgetMs,
	contractFingerprint,
	isAgentTextReply,
	gateRequest,
	isSharedPublicSurface,
	mapChatRunRequest,
	readEnv,
	readXaiKeyState,
	safeErrorMessage,
	stripRuntimePrefix,
	type EnvMap
} from "@buildytech/builder-core";
import { runXaiCatalogTurn, revalidateProposal } from "./chat-tools.ts";
import { runtimeStatus } from "./status.ts";

export { VERCEL_HOBBY_SAFE_MAX_DURATION_SEC } from "@buildytech/builder-core";

const MAX_BODY = 256_000;

function toolCounts(names: string[]): Array<{ name: string; count: number }> {
	const map = new Map<string, number>();
	for (const name of names) map.set(name, (map.get(name) ?? 0) + 1);
	return [...map.entries()].map(([name, count]) => ({ name, count }));
}

/** One JSON line. No brief, page, headers, secrets, or raw provider payloads. */
function logSanitizedRun(event: Record<string, unknown>): void {
	console.log(JSON.stringify({ runtime: "xai-grok", ...event }));
}

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
	env: EnvMap = readEnv(),
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
			return jsonResponse(status.key.present ? 200 : 503, { ...status, contract: contractFingerprint() });
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
			// Version skew: a tab built from another deploy validates with another contract and would
			// reject proposals it cannot render. Refuse before spending a model call.
			if (body.contract !== contractFingerprint()) {
				const modelId = typeof body.modelId === "string" ? body.modelId : "";
				return jsonResponse(409, {
					ok: false,
					code: "client_outdated",
					message: "This tab runs an older version of the app. Reload the page to continue.",
					modelId,
					requestedModelId: modelId,
					liveModel: false
				});
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
				const turn = await runXaiCatalogTurn(
					env.XAI_API_KEY!.trim(),
					mapped.request.modelId,
					{
						brief: mapped.request.brief,
						scenarioId: mapped.request.scenarioId,
						screenId: mapped.request.screenId,
						expectedRevision: mapped.request.expectedRevision,
						pageId: mapped.request.pageId,
						currentPage: mapped.request.currentPage,
						currentProvenance: mapped.request.currentProvenance,
						sessionDemoData: mapped.request.sessionDemoData,
						authorBrief: mapped.request.brief,
						liveTurn: true,
						mode: mapped.request.mode,
						collection: mapped.request.collection,
						scopeBlockIds: mapped.request.scopeBlockIds,
 conversation: mapped.request.conversation,
 manualEdits: mapped.request.manualEdits
					},
					signal
				);
				const { meta } = turn;
				// Our own run budget fired (not a client cancel): a clean timeout code, never platform text.
				const proposal =
					!turn.proposal.ok && turn.proposal.code === "aborted" && !request.signal.aborted
						? {
								ok: false as const,
								code: "runtime_timeout",
								message: `The model did not finish within ${Math.round(ms / 1000)} s. Try again or pick a faster model. No other model was substituted.`
							}
						: turn.proposal;
				// A text answer (every Ask turn, a Build turn where the model only talked) has no page to revalidate.
				const checked = isAgentTextReply(proposal) ? proposal : revalidateProposal(proposal);
				const live = Boolean(checked.ok && (meta.toolCallingWorked || isAgentTextReply(checked)));
				logSanitizedRun({
					event: "xai_run",
					surface: opts.surface,
					runId: meta.runId,
					ok: checked.ok,
					code: checked.ok ? "ok" : checked.code,
					mode: mapped.request.mode,
					reply: isAgentTextReply(checked) ? "text" : checked.ok ? "proposal" : "error",
					path: meta.path,
					modelId: meta.modelId,
					liveModel: live,
					liveXai: live,
					toolCallingProven: meta.toolCallingWorked,
					steps: meta.steps,
					...(meta.providerStatus ? { providerStatus: meta.providerStatus, providerMs: meta.providerMs ?? null } : {}),
					tools: toolCounts(meta.toolsCalled),
					usage: {
						reportedBy: meta.usage.reportedBy,
						aggregation: meta.usage.aggregation ?? null,
						status: meta.usage.status,
						steps: meta.usage.steps,
						promptTokens: meta.usage.promptTokens,
						completionTokens: meta.usage.completionTokens,
						totalTokens: meta.usage.totalTokens,
						cachedTokens: meta.usage.cachedTokens ?? null,
						lastPromptTokens: meta.usage.lastStep?.promptTokens ?? null,
						lastCompletionTokens: meta.usage.lastStep?.completionTokens ?? null
					}
				});
				return jsonResponse(checked.ok ? 200 : 422, {
					...checked,
					liveModel: live,
					liveXai: live,
					toolCallingProven: meta.toolCallingWorked,
					assembler: checked.ok && !isAgentTextReply(checked) ? checked.provenance.assembler : "local-catalog-assembler",
					mode: mapped.request.mode,
					runtime: "xai-grok",
					modelId: meta.modelId,
					requestedModelId: mapped.request.modelId,
					path: meta.path,
					runId: meta.runId,
					toolsUsed: meta.toolsCalled,
					usage: meta.usage,
					...(meta.modelFields ? { modelFields: meta.modelFields } : {})
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

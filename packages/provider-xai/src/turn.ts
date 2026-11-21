/**
 * One xAI catalog turn: resolve the scenario, run the shared agent loop over `providerStep`, redact failures (ADR 0065).
 * The web runtime (apps/xai-runtime) and the desktop webview (apps/chat-web local-turn) run this same function; only the
 * transport differs: the runtime passes its key and the xAI base URL, the desktop webview passes HOST_HELD_KEY and the
 * same-origin forward of its host, which puts the key on the request. No log sink here: the host passes `log`.
 */
import { DEFAULT_XAI_BASE_URL, isAgentReply, resolveScenario, runAgentLoop, turnMeta, safeErrorMessage, notSentUsage, unknownUsage, type AgentReply, type AgentFailure, type LiveTurnMeta, type TurnContext, type mapChatRunRequest } from "@buildytech/chat-agent";
import { emptyPage, setRenderEmptyPolicy } from "@buildytech/builder-core";
import { providerStep } from "./provider.ts";

/** The key value a webview sends: its host replaces the Authorization header with the key it holds. */
export const HOST_HELD_KEY = "host-held";

type TurnResult = AgentReply | AgentFailure;
type TurnLog = (event: Record<string, unknown>) => void;
export type CatalogTurnOptions = {
	/** The sanitized exception line (the runtime writes it to its error log). */
	log?: TurnLog;
	/**
	 * Judge the turn's own writes with the agent host's render policy (a block that shows nothing fails) while the page
	 * keeps its own policy between provider calls (the browser's Inspector allows a sample block that is still empty).
	 */
	strictRenderWrites?: boolean;
};

function newRunId(): string {
	return `xai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function logException(log: TurnLog | undefined, err: unknown, apiKey: string, modelId: string, signal: AbortSignal): void {
	const safe = safeErrorMessage(err, [apiKey]);
	if (!signal.aborted) log?.({ runtime: "xai-grok", event: "xai_run_exception", modelId, name: err instanceof Error ? err.name : typeof err, code: safe.code, message: safe.message });
}

export async function runCatalogTurn(apiKey: string, modelId: string, ctx: TurnContext, signal: AbortSignal, baseUrl: string = DEFAULT_XAI_BASE_URL, deadline?: number, options: CatalogTurnOptions = {}): Promise<{ result: TurnResult; meta: LiveTurnMeta }> {
	const previous = options.strictRenderWrites ? setRenderEmptyPolicy("reject") : null;
	const step: Parameters<typeof runAgentLoop>[3] = previous
		? async (input) => {
				setRenderEmptyPolicy(previous);
				try {
					return await providerStep({ ...input, apiKey, baseUrl });
				} finally {
					setRenderEmptyPolicy("reject");
				}
			}
		: (input) => providerStep({ ...input, apiKey, baseUrl });
	try {
		const compiled = resolveScenario(ctx.mode, modelId, ctx.scenario);
		if (!compiled.ok || compiled.scenario.profile.provider !== "xai") return { result: { ok: false, code: "invalid_scenario", message: "The scenario could not be resolved.", issues: (compiled.ok ? [{ path: "/provider", code: "adapter_mismatch" }] : compiled.issues).map((issue) => ({ ...issue, expected: "registered compatible scenario" })) }, meta: turnMeta("chat-completions", modelId, false, 0, [], notSentUsage(), newRunId()) };
		const turn = await runAgentLoop(modelId, ctx, signal, step, newRunId(), { scenario: compiled.scenario, deadline, cacheKey: ctx.cacheKey, onProviderError: (error) => logException(options.log, error, apiKey, modelId, signal) });
		if (!turn.result.ok && turn.result.code === "provider_failed") return { ...turn, result: { ...turn.result, code: "xai_chat_failed", message: "The xAI chat request could not be completed." } };
		return turn;
	} catch (err) {
		const safe = safeErrorMessage(err, [apiKey]);
		const aborted = safe.code === "AbortError" || safe.message.toLowerCase().includes("abort") || signal.aborted;
		// The caller only sees a generic failure; the host log must name the exception (redacted, 280 chars).
		if (!aborted) logException(options.log, err, apiKey, modelId, signal);
		return {
			result: {
				ok: false,
				code: aborted ? "aborted" : "xai_chat_failed",
				message: aborted ? "The run was cancelled. Usage is unknown, not zero." : "The xAI chat request could not be completed."
			},
			meta: turnMeta("chat-completions", modelId, false, 0, [], unknownUsage(aborted ? "cancelled" : "error", 0), newRunId())
		};
	} finally {
		if (previous) setRenderEmptyPolicy(previous);
	}
}

type MappedRequest = Extract<ReturnType<typeof mapChatRunRequest>, { ok: true }>["request"];

/** What the model turn needs from the mapped request (an empty page when none came). */
export function turnInput(req: MappedRequest): TurnContext {
	return {
		brief: req.brief,
		scenario: req.scenario,
		mode: req.mode,
		conversation: req.conversation,
		page: req.currentPage ?? emptyPage({ title: "New page" }),
		shownPage: req.shownPage ?? null,
		expectedRevision: req.expectedRevision,
		scopeBlockIds: req.scopeBlockIds,
		cacheKey: req.cacheKey
	};
}

/**
 * The answer of one finished turn, the body of POST /v1/run: the result (our own run budget firing, not a client cancel,
 * becomes runtime_timeout) with what the run proved and used. `status` is the HTTP status the runtime sends.
 */
export function turnAnswer(req: MappedRequest, turn: { result: TurnResult; meta: LiveTurnMeta }, budgetMs: number, clientAborted: boolean) {
	const { meta } = turn;
	const checked =
		!turn.result.ok && (turn.result.code === "aborted" || turn.result.code === "runtime_timeout") && !clientAborted
			? { ok: false as const, code: "runtime_timeout", message: `The model did not finish within ${Math.round(budgetMs / 1000)} s. Try again or pick a faster model. No other model was substituted.` }
			: turn.result;
	const live = Boolean(checked.ok && (meta.toolCallingWorked || isAgentReply(checked)));
	return {
		status: checked.ok ? 200 : 422,
		checked,
		live,
		body: {
			...checked,
			liveModel: live,
			liveXai: live,
			toolCallingProven: meta.toolCallingWorked,
			mode: req.mode,
			runtime: "xai-grok" as const,
			modelId: meta.modelId,
			requestedModelId: req.modelId,
			path: meta.path,
			runId: meta.runId,
			toolsUsed: meta.toolsCalled,
			scenario: meta.scenario,
			providerRetries: meta.providerRetries,
			runTrace: meta.runTrace,
			usage: meta.usage
		}
	};
}

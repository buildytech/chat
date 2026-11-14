import type { AgentFailure, AgentMode, AgentReply, RunUsage } from "@buildytech/chat-agent";
import type { PageV2 } from "@buildytech/page-contract";
import { contractFingerprint } from "@buildytech/chat-agent";

export type XaiClientStatus = {
	runtime: string;
	ready: boolean;
	liveModel: boolean;
	code: string;
	key?: { present: boolean };
	models?: {
		candidate: string | null;
		chatIds?: string[];
		imageIds?: string[];
		listed?: boolean;
		toolCallingProven?: boolean;
		parentVerifiedChat?: readonly string[];
	};
	error?: { code: string; message: string };
};

export type XaiRunResponse = (AgentReply | AgentFailure) & {
	modelId?: string;
	requestedModelId?: string;
	usage?: RunUsage;
	toolCallingProven?: boolean;
	liveXai?: boolean;
	liveModel?: boolean;
	path?: string;
	runId?: string;
	toolsUsed?: string[];
};

/** One agent turn (ADR 0034): the page document the agent edits, what the author sees, the selection, the dialogue. */
export type TurnRequest = {
	modelId: string;
	brief: string;
	mode: AgentMode;
	screenId?: string | null;
	expectedRevision: number;
	currentPage: PageV2;
	shownPage?: PageV2 | null;
	scopeBlockIds?: string[];
	conversation?: Array<{ role: "user" | "assistant"; text: string }>;
	collectionRequest?: unknown;
};

function runtimeBase(): string {
	return "/runtime";
}

export async function fetchXaiStatus(signal?: AbortSignal): Promise<XaiClientStatus> {
	try {
		const res = await fetch(`${runtimeBase()}/v1/status`, {
			signal,
			credentials: "same-origin",
			cache: "no-store",
			headers: { Accept: "application/json" }
		});
		const body = (await res.json()) as XaiClientStatus;
		const code =
			body.code ||
			(res.ok ? "ok" : res.status === 404 ? "xai_runtime_unreachable" : "xai_status_error");
		return {
			...body,
			liveModel: Boolean(body.liveModel ?? body.ready),
			ready: Boolean(body.ready),
			code
		};
	} catch {
		return {
			runtime: "xai-grok",
			ready: false,
			liveModel: false,
			code: "xai_runtime_unreachable"
		};
	}
}

/** Error codes this app's runtime emits itself (http.ts). Anything else is platform text. */
const OWN_RUNTIME_CODES = new Set([
	"model_too_slow",
	"client_outdated",
	"xai_api_key_missing",
	"xai_runtime_not_ready",
	"invalid_json",
	"too_large",
	"not_found",
	"basic_auth_required",
	"basic_auth_required_before_shared_bind",
	"unauthorized"
]);

type RuntimeBody = (XaiRunResponse | { error?: { code?: string; message?: string }; ok?: boolean }) | null;

async function readRuntimeBody(res: Response): Promise<RuntimeBody> {
	const text = await res.text().catch(() => "");
	if (!text) return null;
	try {
		const parsed = JSON.parse(text) as unknown;
		return parsed && typeof parsed === "object" ? (parsed as RuntimeBody) : null;
	} catch {
		return null;
	}
}

/** Map a non-runtime failure to a stable code. 504 / FUNCTION_INVOCATION_TIMEOUT means the host timed out. */
export function platformCode(status: number, code?: string): string {
	if (status === 504 || /TIMEOUT/i.test(code ?? "")) return "runtime_timeout";
	if (status === 404) return "xai_runtime_unreachable";
	return "runtime_platform_error";
}

export async function runXaiTurn(ctx: TurnRequest, signal?: AbortSignal): Promise<XaiRunResponse> {
	try {
		const res = await fetch(`${runtimeBase()}/v1/run`, {
			method: "POST",
			credentials: "same-origin",
			cache: "no-store",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify({
				modelId: ctx.modelId,
				contract: contractFingerprint(),
				brief: ctx.brief,
				screenId: ctx.screenId ?? null,
				expectedRevision: ctx.expectedRevision,
				currentPage: ctx.currentPage,
				shownPage: ctx.shownPage ?? null,
				scopeBlockIds: ctx.scopeBlockIds?.length ? ctx.scopeBlockIds : undefined,
				conversation: ctx.conversation ?? [],
				mode: ctx.mode,
				...(ctx.collectionRequest ? { collection: ctx.collectionRequest } : {})
			}),
			signal
		});
		const body = await readRuntimeBody(res);
		if (body && "ok" in body && typeof body.ok === "boolean") return body as XaiRunResponse;
		const runtimeError = body && "error" in body ? body.error : undefined;
		// Only this app's runtime codes pass through. Platform errors (Vercel timeouts,
		// "An error occurred with your deployment") become a stable code, never raw text.
		const own = runtimeError?.code && OWN_RUNTIME_CODES.has(runtimeError.code);
		return {
			ok: false,
			code: own ? runtimeError!.code! : platformCode(res.status, runtimeError?.code),
			message: own ? runtimeError?.message || "The xAI run could not be completed." : "The app host returned an error.",
			modelId: ctx.modelId,
			requestedModelId: ctx.modelId
		};
	} catch (err) {
		if ((err as Error).name === "AbortError") {
			return {
				ok: false,
				code: "aborted",
				message: "The run was cancelled. Usage is unknown, not zero.",
				modelId: ctx.modelId,
				requestedModelId: ctx.modelId
			};
		}
		return {
			ok: false,
			code: "xai_runtime_unreachable",
			message: "Protected xAI runtime is not reachable from this app.",
			modelId: ctx.modelId,
			requestedModelId: ctx.modelId
		};
	}
}

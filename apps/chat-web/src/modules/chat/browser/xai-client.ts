import type { AgentFailure, AgentMode, AgentReply, RunUsage } from "@buildytech/chat-agent";
import type { PageV2 } from "@buildytech/page-contract";
import { contractFingerprint } from "@buildytech/chat-agent";
import { noteRuntimeFiles } from "../../../lib/runtime-files.ts";
import { noteRuntimeHost } from "../../../lib/runtime-host.ts";
import { noteRuntimeSave } from "./runtime-save.ts";

type XaiClientStatus = {
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
	};
	error?: { code: string; message: string };
	/** What the host runs (ADR 0065); web hosts send none (the runtime runs the loop). */
	capabilities?: { loop: "server" | "client"; files: boolean; saveFile: boolean };
	/** The desktop host's name, version and platform (contract/runtime-http/host.schema.json); web hosts send none. */
	host?: { kind: "desktop"; version: string; os: string; arch: string };
};

/** The last status read: a host that runs no loop (`capabilities.loop: "client"`) gets its turns run here (local-turn). */
let lastStatus: XaiClientStatus | null = null;

export type XaiRunResponse = (AgentReply | AgentFailure) & {
	modelId?: string;
	requestedModelId?: string;
	usage?: RunUsage;
	toolCallingProven?: boolean;
	liveXai?: boolean;
	liveModel?: boolean;
	path?: string;
	runId?: string;
	runTrace?: import("@buildytech/chat-agent").RunTrace;
	toolsUsed?: string[];
};

/** One agent turn (ADR 0034): the page document the agent edits, what the author sees, the selection, the dialogue. */
export type TurnRequest = {
	scenario?: import("@buildytech/chat-agent").ScenarioRef;
	modelId: string;
	brief: string;
	mode: AgentMode;
	screenId?: string | null;
	expectedRevision: number;
	currentPage: PageV2;
	shownPage?: PageV2 | null;
	scopeBlockIds?: string[];
	conversation?: Array<{ role: "user" | "assistant"; text: string }>;
	/** Prompt-cache routing key of the chat (hash of its session id): every turn of the chat goes to one xAI server. */
	cacheKey?: string;
	/** The author's date and time zone from this browser (ADR 0066). */
	today?: { date: string; timeZone: string };
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
		lastStatus = {
			...body,
			liveModel: Boolean(body.liveModel ?? body.ready),
			ready: Boolean(body.ready),
			code
		};
		noteRuntimeFiles(body.capabilities?.files === true);
		noteRuntimeSave(body.capabilities?.saveFile === true);
		noteRuntimeHost(body.host);
		return lastStatus;
	} catch {
		lastStatus = null;
		noteRuntimeSave(false);
		noteRuntimeFiles(false);
		noteRuntimeHost(null);
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
function platformCode(status: number, code?: string): string {
	if (status === 504 || /TIMEOUT/i.test(code ?? "")) return "runtime_timeout";
	if (status === 404) return "xai_runtime_unreachable";
	return "runtime_platform_error";
}

/** The body of POST /v1/run; the desktop host's local turn reads the same object. */
export function runBody(ctx: TurnRequest): Record<string, unknown> {
	return {
		...(ctx.scenario ? { scenario: ctx.scenario } : {}),
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
		...(ctx.cacheKey ? { cacheKey: ctx.cacheKey } : {}),
		...(ctx.today ? { today: ctx.today } : {})
	};
}

async function sendRun(ctx: TurnRequest, signal?: AbortSignal): Promise<Response> {
	const status = lastStatus;
	if (status?.capabilities?.loop === "client") {
		const { runLocalTurn } = await import("./local-turn.ts");
		// the wire body (undefined fields dropped, a copy): what the runtime would read
		return runLocalTurn(JSON.parse(JSON.stringify(runBody(ctx))), status, signal);
	}
	return fetch(`${runtimeBase()}/v1/run`, {
		method: "POST",
		credentials: "same-origin",
		cache: "no-store",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify(runBody(ctx)),
		signal
	});
}

export async function runXaiTurn(ctx: TurnRequest, signal?: AbortSignal): Promise<XaiRunResponse> {
	try {
		const res = await sendRun(ctx, signal);
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

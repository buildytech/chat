import type {
	LayoutProposal,
	LayoutProposalError,
	ProposalContext,
	RunUsage
} from "@buildytech/builder-core";

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

export type XaiRunResponse = (LayoutProposal | LayoutProposalError) & {
	modelId?: string;
	requestedModelId?: string;
	usage?: RunUsage;
	toolCallingProven?: boolean;
	liveXai?: boolean;
	liveModel?: boolean;
	path?: string;
	runId?: string;
	toolsUsed?: string[];
	assembler?: string;
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

export async function runXaiProposal(
	ctx: ProposalContext & { modelId: string },
	signal?: AbortSignal
): Promise<XaiRunResponse> {
	try {
		const res = await fetch(`${runtimeBase()}/v1/run`, {
			method: "POST",
			credentials: "same-origin",
			cache: "no-store",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify({
				modelId: ctx.modelId,
				brief: ctx.brief,
				scenarioId: ctx.scenarioId,
				screenId: ctx.screenId,
				expectedRevision: ctx.expectedRevision,
				pageId: ctx.pageId ?? ctx.currentPage?.id,
				currentPage: ctx.currentPage ?? null,
				currentProvenance: ctx.currentProvenance ?? null
			}),
			signal
		});
		const body = (await res.json()) as XaiRunResponse | { error?: { code?: string; message?: string }; ok?: boolean };
		if (body && "ok" in body) return body as XaiRunResponse;
		return {
			ok: false,
			code: (body as { error?: { code?: string } }).error?.code || "xai_run_failed",
			message: (body as { error?: { message?: string } }).error?.message || "The xAI run could not be completed.",
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

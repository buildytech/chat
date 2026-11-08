import type {
	LayoutProposal,
	LayoutProposalError,
	ProposalContext,
	RunUsage
} from "@buildytech/builder-core";

export type XaiClientStatus = {
	runtime: string;
	ready: boolean;
	liveModel: false;
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
	path?: string;
};

function runtimeBase(): string {
	return "/runtime";
}

export async function fetchXaiStatus(signal?: AbortSignal): Promise<XaiClientStatus> {
	try {
		const res = await fetch(`${runtimeBase()}/v1/status`, { signal, headers: { Accept: "application/json" } });
		const body = (await res.json()) as XaiClientStatus;
		return {
			...body,
			liveModel: false,
			ready: Boolean(body.ready),
			code: body.code || (res.ok ? "ok" : "xai_status_error")
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
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify({
				modelId: ctx.modelId,
				brief: ctx.brief,
				scenarioId: ctx.scenarioId,
				screenId: ctx.screenId,
				expectedRevision: ctx.expectedRevision,
				pageId: ctx.pageId
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

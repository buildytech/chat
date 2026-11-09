import { parsePage, type Page } from "@buildytech/page-contract";
import { PARENT_VERIFIED_CHAT_IDS, PARENT_VERIFIED_IMAGE_IDS, CANDIDATE_CHAT_MODEL } from "./xai-env.ts";
import { inferScenarioId } from "./brief.ts";

/**
 * Readable labels for the five parent-verified TEXT models.
 * intendedRole is an owner suggestion for later manuals — not a routing rule
 * and not proof that the model has that capability.
 */
export const GROK_CHAT_MODELS = [
	{
		id: "grok-4.20-0309-non-reasoning",
		label: "Grok 4.20 Non-reasoning",
		intendedRole: "block-selection",
		intendedRoleNote: "Owner suggestion for later: block selection. Not a technical capability claim. Not used for routing."
	},
	{
		id: "grok-4.20-0309-reasoning",
		label: "Grok 4.20 Reasoning",
		intendedRole: "block-selection",
		intendedRoleNote: "Owner suggestion for later: block selection. Not a technical capability claim. Not used for routing."
	},
	{
		id: "grok-4.20-multi-agent-0309",
		label: "Grok 4.20 Multi-agent",
		intendedRole: "task-distribution",
		intendedRoleNote: "Owner suggestion for later: task distribution. Not a technical capability claim. Not used for routing."
	},
	{
		id: "grok-4.7",
		label: "Grok 4.7",
		intendedRole: "consulting",
		intendedRoleNote: "Owner suggestion for later: consulting. Not a technical capability claim. Not used for routing."
	},
	{
		id: "grok-build-0.1",
		label: "Grok Build 0.1",
		intendedRole: "assembly",
		intendedRoleNote: "Owner suggestion for later: assembly. Not a technical capability claim. Not used for routing."
	}
] as const;

export type GrokChatModelId = (typeof GROK_CHAT_MODELS)[number]["id"];
export type GrokChatModel = (typeof GROK_CHAT_MODELS)[number];

export const DEFAULT_CHAT_MODEL_ID: GrokChatModelId = CANDIDATE_CHAT_MODEL;

export type ModelResolveOk = {
	ok: true;
	modelId: GrokChatModelId;
	label: string;
	live: boolean;
};

export type ModelResolveError = {
	ok: false;
	code:
		| "missing_model_id"
		| "image_model_not_for_chat"
		| "unknown_chat_model"
		| "model_not_enabled_on_account"
		| "silent_fallback_forbidden";
	message: string;
	requestedId: string;
};

export function getChatModel(id: string): GrokChatModel | null {
	return GROK_CHAT_MODELS.find((m) => m.id === id) ?? null;
}

export function formatChatModelChoice(model: GrokChatModel): string {
	return `${model.label} (${model.id})`;
}

/**
 * Map a UI selection to the backend model id.
 * Never substitutes another model. Image IDs are rejected for chat.
 * When the account list is known, the id must be in that list.
 */
export function resolveChatModelRequest(input: {
	requestedId: string | null | undefined;
	discoveredChatIds?: string[] | null;
	allowUnlistedTrial?: boolean;
}): ModelResolveOk | ModelResolveError {
	const requestedId = String(input.requestedId ?? "").trim();
	if (!requestedId) {
		return {
			ok: false,
			code: "missing_model_id",
			message: "Select a Grok chat model before sending.",
			requestedId
		};
	}
	if ((PARENT_VERIFIED_IMAGE_IDS as readonly string[]).includes(requestedId) || /imagine|image/i.test(requestedId)) {
		return {
			ok: false,
			code: "image_model_not_for_chat",
			message: `${requestedId} is an image model and is not a chat choice.`,
			requestedId
		};
	}
	const catalog = getChatModel(requestedId);
	if (!catalog) {
		return {
			ok: false,
			code: "unknown_chat_model",
			message: `${requestedId} is not one of the five verified Grok chat models.`,
			requestedId
		};
	}
	const discovered = input.discoveredChatIds;
	if (Array.isArray(discovered)) {
		if (!discovered.includes(requestedId)) {
			return {
				ok: false,
				code: "model_not_enabled_on_account",
				message: `${catalog.label} (${requestedId}) is not enabled on this account. No other model was substituted.`,
				requestedId
			};
		}
		return { ok: true, modelId: catalog.id, label: catalog.label, live: true };
	}
	if (input.allowUnlistedTrial) {
		return { ok: true, modelId: catalog.id, label: catalog.label, live: false };
	}
	return {
		ok: false,
		code: "model_not_enabled_on_account",
		message: `${catalog.label} (${requestedId}) cannot be used until the account model list includes it. No fallback was selected.`,
		requestedId
	};
}

export function assertNoFallback(requestedId: string, executedId: string): ModelResolveError | null {
	if (requestedId === executedId) return null;
	return {
		ok: false,
		code: "silent_fallback_forbidden",
		message: `Requested ${requestedId} but the run used ${executedId}. Silent model switch is not allowed.`,
		requestedId
	};
}

export type ChatRunRequest = {
	modelId: GrokChatModelId;
	label: string;
	live: boolean;
	brief: string;
	scenarioId: "dashboard" | "landing" | "website" | null;
	screenId: string | null;
	expectedRevision: number;
	pageId?: string;
	currentPage?: Page;
	currentProvenance?: {
		screenId: string | null;
		scenarioId: "dashboard" | "landing" | "website" | null;
		missing: string[];
	};
};

function parseCurrentProvenance(raw: unknown): ChatRunRequest["currentProvenance"] {
	if (!raw || typeof raw !== "object") return undefined;
	const rec = raw as Record<string, unknown>;
	const scenarioId =
		rec.scenarioId === "dashboard" || rec.scenarioId === "landing" || rec.scenarioId === "website"
			? rec.scenarioId
			: null;
	const screenId = typeof rec.screenId === "string" ? rec.screenId : null;
	return {
		screenId: screenId && screenId !== "null" ? screenId : null,
		scenarioId,
		missing: Array.isArray(rec.missing) ? rec.missing.filter((row): row is string => typeof row === "string") : []
	};
}

/**
 * Map a POST /v1/run body onto the exact requested chat model.
 * The discovered list never replaces a missing or unavailable id.
 */
export function mapChatRunRequest(
	body: {
		modelId?: unknown;
		brief?: unknown;
		scenarioId?: unknown;
		screenId?: unknown;
		expectedRevision?: unknown;
		pageId?: unknown;
		currentPage?: unknown;
		currentProvenance?: unknown;
	},
	opts: { discoveredChatIds?: string[] | null; allowUnlistedTrial?: boolean } = {}
): { ok: true; request: ChatRunRequest } | ModelResolveError {
	const resolved = resolveChatModelRequest({
		requestedId: typeof body.modelId === "string" ? body.modelId : "",
		discoveredChatIds: opts.discoveredChatIds,
		allowUnlistedTrial: opts.allowUnlistedTrial
	});
	if (!resolved.ok) return resolved;
	const brief = String(body.brief ?? "");
	const scenarioId =
		body.scenarioId === "dashboard" || body.scenarioId === "landing" || body.scenarioId === "website"
			? body.scenarioId
			: inferScenarioId(brief);
	let currentPage: Page | undefined;
	if (body.currentPage != null) {
		try {
			currentPage = parsePage(body.currentPage);
		} catch {
			currentPage = undefined;
		}
	}
	return {
		ok: true,
		request: {
			modelId: resolved.modelId,
			label: resolved.label,
			live: resolved.live,
			brief,
			scenarioId,
			screenId: typeof body.screenId === "string" ? body.screenId : null,
			expectedRevision: typeof body.expectedRevision === "number" ? body.expectedRevision : 0,
			pageId: typeof body.pageId === "string" ? body.pageId : currentPage?.id,
			currentPage,
			currentProvenance: parseCurrentProvenance(body.currentProvenance)
		}
	};
}

void PARENT_VERIFIED_CHAT_IDS;

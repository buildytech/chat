import { parsePageV2, type PageV2 } from "@buildytech/page-contract";
import { CANDIDATE_CHAT_MODEL } from "./xai-env.ts";
import { isAgentMode, type AgentMode } from "./agent/agent-tools.ts";

import { parseScenarioRef, type ScenarioRef } from "./scenarios/compile.ts";
import { XAI_MODELS, manifestModelStatus } from "@buildytech/agent-manifests";
export const GROK_CHAT_MODELS = XAI_MODELS;

export type GrokChatModelId = (typeof GROK_CHAT_MODELS)[number]["id"];
export type GrokChatModel = (typeof GROK_CHAT_MODELS)[number];

/** False when the model cannot run this app's client-side tool loop (shown disabled in the selector). */
export function modelRunsToolLoop(model: GrokChatModel | null | undefined): boolean {
	if (!model) return false;
	return manifestModelStatus("xai", model.id).status === "enabled";
}

function modelUnavailableCode(model: GrokChatModel | null | undefined): string | null {
	if (!model || modelRunsToolLoop(model)) return null;
	return manifestModelStatus("xai", model.id).code;
}

/**
 * Whether the selector offers a model: first the manifest (the tool loop runs on it), then the key's own model list
 * when the runtime has listed it (`status.models.chatIds`). `model_not_enabled_on_account` is the key's answer, not
 * the manifest's: the model is fine here but this xAI key does not list it (grok-build-0.1 on the box key, 2026-11-20).
 */
export function modelChoice(model: GrokChatModel | null | undefined, accountChatIds?: readonly string[] | null): { enabled: true } | { enabled: false; code: string } {
	if (!model) return { enabled: false, code: "unknown_chat_model" };
	if (!modelRunsToolLoop(model)) return { enabled: false, code: modelUnavailableCode(model) ?? "model_tools_unavailable" };
	if (Array.isArray(accountChatIds) && !accountChatIds.includes(model.id)) return { enabled: false, code: "model_not_enabled_on_account" };
	return { enabled: true };
}

export const DEFAULT_CHAT_MODEL_ID: GrokChatModelId = CANDIDATE_CHAT_MODEL;

type ModelResolveOk = {
	ok: true;
	modelId: GrokChatModelId;
	label: string;
	live: boolean;
};

type ModelResolveError = {
	ok: false;
	code:
		| "invalid_scenario"
		| "missing_model_id"
		| "image_model_not_for_chat"
		| "unknown_chat_model"
		| "model_not_enabled_on_account"
		| "model_tools_unavailable"
		| "model_too_slow"
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
	if (/imagine|image/i.test(requestedId)) {
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
	if (!modelRunsToolLoop(catalog) && modelUnavailableCode(catalog) === "model_too_slow") {
		return {
			ok: false,
			code: "model_too_slow",
			message: `${catalog.label} (${requestedId}) is disabled here: in live runs it took 1-4 minutes per page and often timed out or skipped the page tool. Pick another model. No other model was substituted.`,
			requestedId
		};
	}
	if (!modelRunsToolLoop(catalog)) {
		return {
			ok: false,
			code: "model_tools_unavailable",
			message: `${catalog.label} (${requestedId}) cannot run this app's catalog tools: xAI rejects client-side tools for multi-agent models (chat completions not allowed; the Responses API needs beta access). Pick another model. No other model was substituted.`,
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

/** A POST /v1/run body mapped onto one exact chat model and a trusted turn context (ADR 0034). */
type ChatRunRequest = {
	scenario?: ScenarioRef;
	modelId: GrokChatModelId;
	label: string;
	live: boolean;
	brief: string;
	/** Chat mode the author picked in the composer (Ask never applies). Missing or unknown means build. */
	mode: AgentMode;
	/** The page document the agent starts from (applied page, pending proposal, or empty / draft page). */
	currentPage?: PageV2;
	/** The page the author sees when `currentPage` is a host draft. */
	shownPage?: PageV2;
	expectedRevision: number;
	/** Selected blocks: the agent edits only those. */
	scopeBlockIds?: string[];
	conversation: Array<{ role: "user" | "assistant"; text: string }>;
};

function parsePageDoc(raw: unknown): PageV2 | undefined {
	if (raw == null) return undefined;
	try {
		return parsePageV2(raw);
	} catch {
		return undefined;
	}
}

/**
 * Map a POST /v1/run body onto the exact requested chat model.
 * The discovered list never replaces a missing or unavailable id.
 */
export function mapChatRunRequest(
	body: {
		modelId?: unknown;
		scenario?: unknown;
		brief?: unknown;
		expectedRevision?: unknown;
		currentPage?: unknown;
		shownPage?: unknown;
		mode?: unknown;
		scopeBlockIds?: unknown;
		conversation?: unknown;
	},
	opts: { discoveredChatIds?: string[] | null; allowUnlistedTrial?: boolean } = {}
): { ok: true; request: ChatRunRequest } | ModelResolveError {
	const resolved = resolveChatModelRequest({
		requestedId: typeof body.modelId === "string" ? body.modelId : "",
		discoveredChatIds: opts.discoveredChatIds,
		allowUnlistedTrial: opts.allowUnlistedTrial
	});
	if (!resolved.ok) return resolved;
	const scenario = body.scenario === undefined ? undefined : parseScenarioRef(body.scenario);
	if (scenario === null) return { ok: false, code: "invalid_scenario", message: "Expected a registered scenario reference (id and version only).", requestedId: resolved.modelId };
	return {
		ok: true,
		request: {
			modelId: resolved.modelId,
			scenario,
			label: resolved.label,
			live: resolved.live,
			brief: String(body.brief ?? ""),
			mode: isAgentMode(body.mode) ? body.mode : "build",
			currentPage: parsePageDoc(body.currentPage),
			shownPage: parsePageDoc(body.shownPage),
			expectedRevision: typeof body.expectedRevision === "number" ? body.expectedRevision : 0,
			scopeBlockIds: Array.isArray(body.scopeBlockIds) ? [...new Set(body.scopeBlockIds.filter((id): id is string => typeof id === "string"))].slice(0, 100) : undefined,
			conversation: Array.isArray(body.conversation)
				? body.conversation.slice(-8).flatMap((row) => (row && typeof row === "object" && (row.role === "user" || row.role === "assistant") && typeof row.text === "string" ? [{ role: row.role as "user" | "assistant", text: row.text.slice(0, 2000) }] : []))
				: []
		}
	};
}

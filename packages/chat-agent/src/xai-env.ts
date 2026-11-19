/**
 * xAI Grok (official). Server-only. Never VITE_/PUBLIC_.
 * Distinct from Cursor SDK keys. Do not rename CURSOR_API_KEY to this.
 */
import { XAI_MANIFEST } from "@buildytech/agent-manifests";
import { readEnv, type EnvMap } from "./env-map.ts";

export const XAI_SECRET_ENV = ["XAI_API_KEY"] as const;
export const RUNTIME_AUTH_ENV = ["BUILDY_RUNTIME_BASIC_AUTH_USER", "BUILDY_RUNTIME_BASIC_AUTH_PASSWORD"] as const;

/** The xAI REST endpoint; `XAI_BASE_URL` in the environment overrides it (a proxy, a gateway, a test double). */
export const DEFAULT_XAI_BASE_URL = "https://api.x.ai/v1";

export function xaiBaseUrl(env?: EnvMap): string {
	return readEnv(env).XAI_BASE_URL?.trim().replace(/\/+$/, "") || DEFAULT_XAI_BASE_URL;
}

/** The model a fresh runtime proposes when discovery lists it (the first listed chat model otherwise). Never a promise that the key may use it. */
export const CANDIDATE_CHAT_MODEL = XAI_MANIFEST.defaultModelId;

export const XAI_RUNTIME_NOTES = {
	provider: "Official xAI REST at https://api.x.ai/v1 with Bearer XAI_API_KEY.",
	discover: "GET /v1/models (data[]), GET /v1/language-models (models[]), GET /v1/image-generation-models (models[]). Key-scoped.",
	chat: "POST /v1/chat/completions, stream false. The provider-xai adapter implements the neutral page-agent protocol.",
	responses: "Responses is not implemented by this adapter. A future adapter must declare its storage policy explicitly.",
	images: "POST /v1/images/generations is separate. Do not run image models without an explicit later action.",
	tools: "Application-executed tools only: get_page, list_blocks, get_block, write_page. Never mix hosted web_search / code_execution.",
	privacy: "Server-side XAI_API_KEY. Browser BYOK stays UI-only. No request/body/header/raw SDK logs. One sanitized run counter (runId, steps, tool names/counts, provider usage) is allowed. Only page-loop@2 permits one transient HTTP retry within the request/deadline ceilings. Transport exceptions are not retried.",
	toolCalling: "Each live turn proves the tool protocol itself: the run reports toolCallingProven when the model called a tool (get_page, list_blocks, get_block, write_page) and the host accepted or rejected the call.",
} as const;

type XaiKeyState =
	| { present: false; source: null; code: "xai_api_key_missing" }
	| { present: true; source: "XAI_API_KEY"; code: "xai_api_key_present" };

export function readXaiKeyState(env?: EnvMap): XaiKeyState {
	const bag = readEnv(env);
	if (bag.XAI_API_KEY?.trim()) {
		return { present: true, source: "XAI_API_KEY", code: "xai_api_key_present" };
	}
	return { present: false, source: null, code: "xai_api_key_missing" };
}

export function hasPublicSecretLeak(env?: EnvMap): string[] {
	const bag = readEnv(env);
	const leaks: string[] = [];
	for (const key of Object.keys(bag)) {
		if (/^(VITE_|PUBLIC_|NEXT_PUBLIC_)/.test(key) && /KEY|SECRET|TOKEN|PASSWORD/i.test(key) && bag[key]?.trim()) {
			leaks.push(key);
		}
	}
	return leaks;
}

export function classifyDiscoveredModels(ids: string[]): {
	chatIds: string[];
	imageIds: string[];
	otherIds: string[];
	candidate: string | null;
} {
	const unique = [...new Set(ids.filter(Boolean))];
	const imageIds = unique.filter((id) => /imagine|image/i.test(id));
	const chatIds = unique.filter((id) => !imageIds.includes(id));
	const otherIds: string[] = [];
	const candidate = chatIds.includes(CANDIDATE_CHAT_MODEL)
		? CANDIDATE_CHAT_MODEL
		: (chatIds[0] ?? null);
	return { chatIds, imageIds, otherIds, candidate };
}


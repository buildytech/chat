/**
 * xAI Grok (official). Server-only. Never VITE_/PUBLIC_.
 * Distinct from Cursor SDK keys. Do not rename CURSOR_API_KEY to this.
 */
import { readEnv, type EnvMap } from "./env-map.ts";

export const XAI_SECRET_ENV = ["XAI_API_KEY"] as const;
export const RUNTIME_AUTH_ENV = ["BUILDY_RUNTIME_BASIC_AUTH_USER", "BUILDY_RUNTIME_BASIC_AUTH_PASSWORD"] as const;

export const XAI_BASE_URL = "https://api.x.ai/v1";

/** Parent-box evidence 2026-11-08. Runtime still re-lists the account. Not a live claim without a key. */
export const PARENT_VERIFIED_MODEL_IDS = [
	"grok-4.20-0309-non-reasoning",
	"grok-4.20-0309-reasoning",
	"grok-4.20-multi-agent-0309",
	"grok-4.7",
	"grok-build-0.1",
	"grok-imagine-image",
	"grok-imagine-image-2.0"
] as const;

export const PARENT_VERIFIED_CHAT_IDS = [
	"grok-4.20-0309-non-reasoning",
	"grok-4.20-0309-reasoning",
	"grok-4.20-multi-agent-0309",
	"grok-4.7",
	"grok-build-0.1"
] as const;

export const PARENT_VERIFIED_IMAGE_IDS = ["grok-imagine-image", "grok-imagine-image-2.0"] as const;

/** Chat Completions ping succeeded. Parent later proved tool protocol on a synthetic fixture; Stock assembly is not proven. */
export const CANDIDATE_CHAT_MODEL = "grok-4.20-0309-non-reasoning";

export const XAI_RUNTIME_NOTES = {
	provider: "Official xAI REST at https://api.x.ai/v1 with Bearer XAI_API_KEY.",
	discover: "GET /v1/models (data[]), GET /v1/language-models (models[]), GET /v1/image-generation-models (models[]). Key-scoped.",
	chat: "POST /v1/chat/completions, stream true. Conservative app tools use createOpenAI({ name: 'xai', baseURL, apiKey }).chat(actualModelId) + streamText.",
	responses: "AI SDK 7 xai(modelId) defaults to Responses. This app does not use that default for catalog tools. If Responses is ever chosen, store:false. No zero-retention promise.",
	images: "POST /v1/images/generations is separate. Do not run image models without an explicit later action.",
	tools: "Application-executed tools only: search_catalog, get_block_details, propose_layout, get_skill. Never mix hosted web_search / code_execution.",
	privacy: "Server-side XAI_API_KEY. Browser BYOK stays UI-only. No request/body/header/raw SDK logs. One sanitized run counter (runId, steps, tool names/counts, provider usage) is allowed. maxRetries 0.",
	toolCalling: "Parent 2026-11-08: bounded Chat Completions tool-protocol test on grok-4.20-0309-non-reasoning succeeded (2 steps, HTTP 200, tool calls, no retries, usage 393+434=827). That test used synthetic TEST blocks and artificial search_blocks(section)/propose_page tools, not this app's Stock catalog or search_catalog/get_block_details/propose_layout. Protocol support is proven. Page assembly is not proven. Do not treat the fixture miss (section=hero vs job=hero, empty blocks) as a production catalog bug."
} as const;

export type XaiKeyState =
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

/** Status-page default only. Never substitute this for a selected chat run. */
export function pickChatModel(discoveredChatIds: string[]): string | null {
	if (discoveredChatIds.includes(CANDIDATE_CHAT_MODEL)) return CANDIDATE_CHAT_MODEL;
	return discoveredChatIds[0] ?? null;
}

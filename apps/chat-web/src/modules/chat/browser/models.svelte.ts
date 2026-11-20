import { DEFAULT_CHAT_MODEL_ID, GROK_CHAT_MODELS, getChatModel, modelChoice, modelRunsToolLoop, type GrokChatModel, type GrokChatModelId } from "@buildytech/chat-agent";
import { readKey, writeKey } from "../../../lib/browser/storage-v1.ts";
import { fetchXaiStatus } from "./xai-client.ts";

/** The chat's own key in the buildy:v1 space (a session file carries it as settings.selectedModelId). */
const STORE_KEY = "buildy:v1:selectedModelId";

function readStored(): GrokChatModelId {
	try {
		const raw = readKey(STORE_KEY);
		const model = getChatModel(raw ?? "");
		// A stored pick that cannot run the tool loop falls back to the default, visibly.
		return model && modelRunsToolLoop(model) ? model.id : DEFAULT_CHAT_MODEL_ID;
	} catch {
		return DEFAULT_CHAT_MODEL_ID;
	}
}

let selectedModelId = $state<GrokChatModelId>(readStored());
/** The chat models the runtime listed for its xAI key (`status.models.chatIds`); null until a status listed them. */
let accountChatIds = $state<readonly string[] | null>(null);

export function listChatModels() {
	return GROK_CHAT_MODELS;
}

/** Whether the selector offers the model, and why not (manifest first, then the key's model list). */
export function chatModelChoice(model: GrokChatModel) {
	return modelChoice(model, accountChatIds);
}

/** A runtime status narrows the selector to the models its key lists (a status that did not list them changes nothing). */
export function noteAccountModels(status: { models?: { listed?: boolean; chatIds?: string[] } }): void {
	if (status.models?.listed && Array.isArray(status.models.chatIds)) accountChatIds = [...status.models.chatIds];
}

/** Read the runtime status once (the model list of its key, no model call) so the selector shows what this key can run. */
export async function refreshAccountModels(signal?: AbortSignal): Promise<void> {
	noteAccountModels(await fetchXaiStatus(signal));
}

export function getSelectedModelId(): GrokChatModelId {
	return selectedModelId;
}

export function setSelectedModelId(id: string): boolean {
	const model = getChatModel(id);
	if (!model || !modelChoice(model, accountChatIds).enabled) return false;
	selectedModelId = model.id;
	writeKey(STORE_KEY, model.id);
	return true;
}

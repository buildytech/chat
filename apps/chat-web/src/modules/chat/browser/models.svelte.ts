import { DEFAULT_CHAT_MODEL_ID, GROK_CHAT_MODELS, getChatModel, modelRunsToolLoop, type GrokChatModelId } from "@buildytech/chat-agent";
import { readKey, writeKey } from "../../../lib/browser/storage-v1.ts";

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

export function listChatModels() {
	return GROK_CHAT_MODELS;
}

/** Selector state per model: disabled models stay visible with an honest reason. */
export function isChatModelAvailable(id: string): boolean {
	return modelRunsToolLoop(getChatModel(id));
}

export function getSelectedModelId(): GrokChatModelId {
	return selectedModelId;
}

export function setSelectedModelId(id: string): boolean {
	const model = getChatModel(id);
	if (!model || !modelRunsToolLoop(model)) return false;
	selectedModelId = model.id;
	writeKey(STORE_KEY, model.id);
	return true;
}

import {
	DEFAULT_CHAT_MODEL_ID,
	GROK_CHAT_MODELS,
	getChatModel,
	modelRunsToolLoop,
	type GrokChatModelId
} from "@buildytech/builder-core";

const STORE_KEY = "buildy.chat.selectedModelId";

function readStored(): GrokChatModelId {
	if (typeof localStorage === "undefined") return DEFAULT_CHAT_MODEL_ID;
	try {
		const raw = localStorage.getItem(STORE_KEY);
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
	if (typeof localStorage === "undefined") return true;
	try {
		localStorage.setItem(STORE_KEY, model.id);
	} catch {
		/* nonsecret preference only */
	}
	return true;
}

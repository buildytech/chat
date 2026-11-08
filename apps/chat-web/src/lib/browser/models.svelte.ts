import {
	DEFAULT_CHAT_MODEL_ID,
	GROK_CHAT_MODELS,
	getChatModel,
	type GrokChatModelId
} from "@buildytech/builder-core";

const STORE_KEY = "buildy.chat.selectedModelId";

function readStored(): GrokChatModelId {
	if (typeof localStorage === "undefined") return DEFAULT_CHAT_MODEL_ID;
	try {
		const raw = localStorage.getItem(STORE_KEY);
		return getChatModel(raw ?? "")?.id ?? DEFAULT_CHAT_MODEL_ID;
	} catch {
		return DEFAULT_CHAT_MODEL_ID;
	}
}

let selectedModelId = $state<GrokChatModelId>(readStored());

export function listChatModels() {
	return GROK_CHAT_MODELS;
}

export function getSelectedModelId(): GrokChatModelId {
	return selectedModelId;
}

export function setSelectedModelId(id: string): boolean {
	const model = getChatModel(id);
	if (!model) return false;
	selectedModelId = model.id;
	if (typeof localStorage === "undefined") return true;
	try {
		localStorage.setItem(STORE_KEY, model.id);
	} catch {
		/* nonsecret preference only */
	}
	return true;
}

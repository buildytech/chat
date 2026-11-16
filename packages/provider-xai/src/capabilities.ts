import { getChatModel, modelRunsToolLoop, modelUnavailableCode } from "@buildytech/chat-agent";

/** Adapter implementation and pinned application policy, not account discovery or guessed vendor limits. */
export function xaiCapabilities(modelId: string) {
	const model = getChatModel(modelId);
	return {
		provider: "xai",
		protocol: "chat-completions",
		streaming: false,
		toolChoices: ["auto", "none", "required", "named-with-required-fallback"],
		completionTokenParameter: "max_tokens",
		fixedTemperature: 0,
		modelId,
		toolLoop: model ? modelRunsToolLoop(model) ? "enabled" : "disabled" : "unknown",
		unavailableCode: model ? modelUnavailableCode(model) : "unknown_chat_model"
	} as const;
}

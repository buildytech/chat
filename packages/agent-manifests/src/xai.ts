/**
 * Readable labels for the five parent-verified TEXT models.
 * intendedRole is an owner suggestion for later manuals — not a routing rule
 * and not proof that the model has that capability.
 */
export const XAI_MODELS = [
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
		intendedRoleNote: "Owner suggestion for later: task distribution. Not a technical capability claim. Not used for routing.",
		/**
		 * Live probe 2026-11-09: chat completions answers 400 "Multi Agent requests are not allowed
		 * on chat completions"; the Responses API answers 400 "Client-side tools for multi-agent
		 * models require beta access". The catalog tool loop cannot run on it.
		 */
		toolLoop: "unavailable",
		unavailableCode: "multi_agent_tools_unavailable"
	},
	{
		id: "grok-4.7",
		label: "Grok 4.7",
		intendedRole: "consulting",
		intendedRoleNote: "Owner suggestion for later: consulting. Not a technical capability claim. Not used for routing.",
		/**
		 * Live runs 2026-11-09 (dashboard prompt, tool_choice "required", 285 s budget): 4 of 7 finished,
		 * in 54-227 s; the rest failed after 169-240 s (provider error, no propose_layout, timeout).
		 * Answers in prose on tool_choice "auto". Too slow and unreliable for the catalog tool loop.
		 */
		toolLoop: "unavailable",
		unavailableCode: "model_too_slow"
	},
	{
		id: "grok-build-0.1",
		label: "Grok Build 0.1",
		intendedRole: "assembly",
		intendedRoleNote: "Owner suggestion for later: assembly. Not a technical capability claim. Not used for routing."
	}
] as const;


export const XAI_MANIFEST_V1 = {
	id: "xai", version: 1, defaultModelId: "grok-4.20-0309-non-reasoning",
	protocol: "chat-completions", streaming: false,
	toolChoices: ["auto", "none", "required", "named-with-required-fallback"],
	completionTokenParameter: "max_tokens", fixedTemperature: 0, models: XAI_MODELS
} as const;

export const XAI_MANIFEST = { ...XAI_MANIFEST_V1, version: 2, completionTokenParameter: "max_completion_tokens" } as const;

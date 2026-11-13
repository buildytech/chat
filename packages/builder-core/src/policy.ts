export const POLICY_VERSION = "page-agent/4";
/** Non-secret catalog of the five verified text models. Bump when the selector set changes. */
export const MODEL_CATALOG_VERSION = "grok-text-5/2026-11-08";
export const TRIAL_POLICY_VERSION = `${POLICY_VERSION}+${MODEL_CATALOG_VERSION}`;

/** Every tool of agent-tools.v1.json (a test keeps both equal). Which ones a turn offers depends on its mode. */
export const ALLOWED_TOOLS = ["search_catalog", "get_block", "get_page", "write_page"] as const;

export type AllowedTool = (typeof ALLOWED_TOOLS)[number];

export const RUN_BUDGET = {
	maxToolCalls: 8,
	maxMs: 90_000,
	shortlist: 12,
	toolPageSize: 4,
	reserveProposeSteps: 1
} as const;

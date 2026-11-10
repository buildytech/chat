export const POLICY_VERSION = "browser-constructor/3";
/** Non-secret catalog of the five verified text models. Bump when the selector set changes. */
export const MODEL_CATALOG_VERSION = "grok-text-5/2026-11-08";
export const TRIAL_POLICY_VERSION = `${POLICY_VERSION}+${MODEL_CATALOG_VERSION}`;

export const ENABLED_SKILLS = [
	{
		id: "ui8kit-strict-catalog",
		version: "1",
		purpose: "Use the host scenario seed or one search_catalog shortlist, then call propose_layout. On a current page, edit with edit_page (page-patch/v1 ops) and keep everything else. get_block_details is optional for a single unknown id. Never spend the last tool step on search or details.",
		triggers: ["catalog", "screen", "block", "layout"],
		requiredTools: ["search_catalog", "propose_layout"]
	},
	{
		id: "human-apply-gate",
		version: "1",
		purpose: "Never apply or publish. The author must confirm Apply on a schema-valid proposal.",
		triggers: ["apply", "publish"],
		requiredTools: ["propose_layout"]
	}
] as const;

/** Every tool of agent-tools.v1.json (a test keeps both equal). Which ones a turn offers depends on its mode. */
export const ALLOWED_TOOLS = [
	"search_catalog",
	"get_block",
	"propose_plan",
	"get_block_details",
	"propose_layout",
	"edit_page",
	"get_skill"
] as const;

export type AllowedTool = (typeof ALLOWED_TOOLS)[number];

export function getSkill(id: string):
	| { ok: true; skill: (typeof ENABLED_SKILLS)[number] }
	| { ok: false; code: "unknown_skill" | "disabled_skill" | "path_rejected"; id: string } {
	const raw = String(id ?? "");
	if (!raw || raw.includes("..") || raw.includes("/") || raw.includes("\\") || raw.includes("://")) {
		return { ok: false, code: "path_rejected", id: raw };
	}
	const skill = ENABLED_SKILLS.find((s) => s.id === raw);
	if (!skill) return { ok: false, code: "unknown_skill", id: raw };
	return { ok: true, skill };
}

export const RUN_BUDGET = {
	maxToolCalls: 8,
	maxMs: 90_000,
	shortlist: 12,
	toolPageSize: 4,
	reserveProposeSteps: 1
} as const;

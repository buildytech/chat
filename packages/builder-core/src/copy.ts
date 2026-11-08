/** Owner-fixed US English starter briefs and composer placeholders. Not system-role text. */

export const SCENARIO_IDS = ["dashboard", "landing", "website"] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export const PLACEHOLDER_MODES = ["default", "dashboard", "landing", "website"] as const;
export type PlaceholderMode = (typeof PLACEHOLDER_MODES)[number];

export const SCENARIO_PROMPTS: Record<
	ScenarioId,
	{ id: ScenarioId; version: string; label: string; text: string }
> = {
	dashboard: {
		id: "dashboard",
		version: "1",
		label: "Dashboard",
		text: "Create a responsive dashboard using UI8Kit rules and contracts. Use only blocks and variants that are actually available and compatible with the current catalog. Start with a clear navigation structure, a concise overview, useful metrics, and an appropriate data section. Ask me about the audience, data, and primary tasks when needed. Inspect block details before proposing a layout, and wait for me to apply the proposal."
	},
	landing: {
		id: "landing",
		version: "1",
		label: "Landing",
		text: "Create a responsive landing page using UI8Kit rules and contracts. Use only blocks and variants that are actually available and compatible with the current catalog. Organize the page around a clear value proposition, relevant benefits, trustworthy evidence, and one primary call to action. Ask me for the offer, audience, and real business facts instead of inventing claims. Inspect block details before proposing a layout, and wait for me to apply the proposal."
	},
	website: {
		id: "website",
		version: "1",
		label: "Website",
		text: "Create a responsive website using UI8Kit rules and contracts. Use only blocks and variants that are actually available and compatible with the current catalog. Begin with a coherent home page, useful navigation, and sections that explain the business and guide visitors to the next step. Ask me which additional pages and verified content are needed; do not invent working services or integrations. Inspect block details before proposing a layout, and wait for me to apply the proposal."
	}
};

export const PLACEHOLDERS: Record<PlaceholderMode, readonly string[]> = {
	default: [
		"Ask BuildY to create an app using UI8Kit rules and contracts.",
		"Ask BuildY to create a website using UI8Kit rules and contracts.",
		"Ask BuildY to create a dashboard using UI8Kit rules and contracts.",
		"Ask BuildY to create a CRM interface using UI8Kit rules and contracts.",
		"Ask BuildY to create an e-commerce storefront using UI8Kit rules and contracts."
	],
	dashboard: [
		"Ask BuildY to create a personal dashboard using UI8Kit rules and contracts.",
		"Ask BuildY to create a CMS admin dashboard using UI8Kit rules and contracts.",
		"Ask BuildY to create an analytics dashboard using UI8Kit rules and contracts.",
		"Ask BuildY to create a sales dashboard using UI8Kit rules and contracts.",
		"Ask BuildY to create a project management dashboard using UI8Kit rules and contracts."
	],
	landing: [
		"Ask BuildY to create a SaaS landing page using UI8Kit rules and contracts.",
		"Ask BuildY to create a product launch landing page using UI8Kit rules and contracts.",
		"Ask BuildY to create a service landing page using UI8Kit rules and contracts.",
		"Ask BuildY to create an event landing page using UI8Kit rules and contracts.",
		"Ask BuildY to create a newsletter signup landing page using UI8Kit rules and contracts."
	],
	website: [
		"Ask BuildY to create a small business website using UI8Kit rules and contracts.",
		"Ask BuildY to create a portfolio website using UI8Kit rules and contracts.",
		"Ask BuildY to create a restaurant website using UI8Kit rules and contracts.",
		"Ask BuildY to create an agency website using UI8Kit rules and contracts.",
		"Ask BuildY to create an educational website using UI8Kit rules and contracts."
	]
};

export const PLACEHOLDER_ROTATION_MS = 6000;

export const OWNER_FILTERS = {
	blank: { type: "screen" as const },
	dashboard: { type: "screen" as const, section: "dashboard" },
	landing: { type: "screen" as const, section: "marketing" },
	website: { type: "screen" as const, job: "hero" }
} as const;

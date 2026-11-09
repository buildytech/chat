import {
	PAGE_LAYOUT_VERSION,
	parsePageSpec,
	type Page,
	type PageBlock,
	type PageBlockKind
} from "@buildytech/page-contract";
import { SCENARIO_PROMPTS, type ScenarioId } from "./copy.ts";
import { displayTitleFromBrief, occasionFromBrief, titleFromSavedEdit } from "./brief.ts";
import type { LayoutCopyEdit } from "./edits.ts";
import { catalogProvenance, catalogSnapshot } from "./catalog/snapshot.ts";
import { blockLabelVocabulary } from "./catalog/text-search.ts";
import { compareScreenSupport, compatibilityFor, rendererKindForLabel, screenSupport } from "./catalog/compatibility.ts";
import { getBlockDetails } from "./catalog/details.ts";
import { filterScreens, getScreenById, searchCatalog } from "./catalog/search.ts";
import { OWNER_FILTERS } from "./copy.ts";
import type { CatalogScreen } from "./catalog/types.ts";
import { MODEL_CATALOG_VERSION, POLICY_VERSION, TRIAL_POLICY_VERSION } from "./policy.ts";
import { familyLabelForKind, validateCatalogProvenance, type CatalogRefs } from "./catalog/provenance.ts";
import {
	DATA_KINDS,
	defaultDemoLabel,
	demoLabelForLocale,
	isShellDefaultTitle,
	mergeModelContent,
	resolvePageLocale,
	shellTitle,
	type ModelPageContent
} from "./content.ts";
import { stripInventedFooterYears } from "./intents.ts";

export type ProposalContext = {
	brief: string;
	scenarioId: ScenarioId | null;
	screenId: string | null;
	expectedRevision: number;
	pageId?: string;
	now?: string;
	/** Trusted host page for follow-up edits. Not accepted from tool JSON layouts. */
	currentPage?: Page;
	/**
	 * True when this assemble ran because a live xAI tool call asked for it.
	 * Assembly stays the deterministic local catalog assembler either way.
	 */
	liveTurn?: boolean;
	/** Structured copy patches from propose_layout.edits. Never the raw author prompt. */
	edits?: LayoutCopyEdit[];
	/**
	 * The author's own message (trusted host input). Demo-data and locale detection read
	 * this, never the model's paraphrased brief.
	 */
	authorBrief?: string;
	/** Model copy per Stock block kind from propose_layout. Parsed and bounded; never a layout. */
	content?: ModelPageContent;
	/**
	 * Host flag: the author asked for demo data earlier in this chat (sticky until they opt out).
	 * Computed by the client from the author's own messages, never from model text.
	 */
	sessionDemoData?: boolean;
	/** Stock screen the model picked on a follow-up turn (sibling switch, e.g. home to layouts). */
	targetScreenId?: string | null;
	/** Saved page metadata for content-only edits. Not accepted from tool JSON layouts. */
	currentProvenance?: {
		screenId: string | null;
		scenarioId: ScenarioId | null;
		missing: string[];
	};
};

export type LayoutProposal = {
	ok: true;
	status: "proposal";
	applied: false;
	source: "local-catalog-assembler" | "xai-runtime";
	liveModel: boolean;
	page: Page;
	baseRevision: number;
	warnings: string[];
	inspected: string[];
	missing: string[];
	/** Block kinds added, kept, and removed versus the base page (all added on a fresh page). */
	diff: { added: string[]; removed: string[]; changed: string[]; kept: string[] };
	/** True when the author explicitly asked for demo data and the model supplied rows. */
	demoData: boolean;
	/** Program-generated from the pinned catalog after validation. Never model text. */
	catalogRefs: CatalogRefs;
	provenance: {
		policyVersion: string;
		modelCatalogVersion: string;
		trialPolicyVersion: string;
		catalog: ReturnType<typeof catalogProvenance>;
		scenarioId: ScenarioId | null;
		screenId: string | null;
		assembler: string;
		/** Typed intent the model set on propose_layout (the host does not parse author words). */
		intent?: ProposalIntent;
	};
};

export type ProposalIntent = {
	locale: string;
	localeSource: "model" | "page" | "default";
	/** demoData as the model set it (undefined = not mentioned), and where the final flag came from. */
	demoData?: boolean;
	demoDataSource: "model" | "session" | "page" | "none";
	requireBlocks: string[];
	unknownBlocks: string[];
	remove: string[];
	newPage: boolean;
};

export type LayoutProposalError = {
	ok: false;
	code: string;
	message: string;
	path?: string;
	usage?: import("./usage.ts").RunUsage;
	modelId?: string;
	suggestedScreenIds?: string[];
};

const INSPECTED = new Set<string>();

function iso(now?: string): string {
	return now ?? new Date().toISOString();
}

function slugify(text: string): string {
	const slug = text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
	return slug || "page";
}

function inspectKind(kind: PageBlockKind, catalogLabel?: string): PageBlockKind {
	const id = catalogLabel ?? kind;
	const details = getBlockDetails({ id });
	if ("ok" in details && details.ok === false) {
		throw Object.assign(new Error(`block details missing for ${id}`), { code: details.code });
	}
	if (!("rendererCompatible" in details) || !details.rendererCompatible || !details.rendererKind) {
		throw Object.assign(new Error(`incompatible block ${id}`), { code: "incompatible_block" });
	}
	INSPECTED.add(details.id);
	return details.rendererKind;
}

function block(
	id: string,
	kind: PageBlockKind,
	title: string,
	summary: string,
	copy?: PageBlock["copy"],
	children?: PageBlock[]
): PageBlock {
	inspectKind(kind);
	const node: PageBlock = { id, kind, title, summary };
	if (copy) node.copy = copy;
	if (children) node.children = children;
	return node;
}

function pageSlot(kind: PageBlockKind, jobRank: Map<PageBlockKind, number>): number {
	if (kind === "sidenav") return -10;
	if (kind === "nav") return 0;
	if (kind === "pagehead") return 5;
	if (kind === "hero") return 10;
	if (kind === "overview") return 15;
	if (kind === "metrics") return 20;
	if (kind === "chart") return 25;
	if (kind === "activity") return 30;
	if (kind === "cta") return 90;
	if (kind === "footer") return 100;
	if (kind === "bottomnav") return 110;
	if (kind === "nav-link" || kind === "feature" || kind === "dish" || kind === "metric") return 200;
	const job = jobRank.get(kind);
	if (job != null) return 20 + job;
	if (kind === "features") return 20;
	if (kind === "menu") return 30;
	if (kind === "hours") return 40;
	return 50;
}

function uniqueKindsFromScreen(screen: CatalogScreen): PageBlockKind[] {
	const seen = new Set<PageBlockKind>();
	const kinds: PageBlockKind[] = [];
	for (const label of screen.labels.blocks) {
		const kind = rendererKindForLabel(label);
		if (!kind || seen.has(kind)) continue;
		inspectKind(kind, label);
		seen.add(kind);
		kinds.push(kind);
	}
	const jobRank = new Map<PageBlockKind, number>();
	for (const [index, job] of screen.labels.job.entries()) {
		const kind = rendererKindForLabel(job);
		if (kind && !jobRank.has(kind)) jobRank.set(kind, index);
	}
	kinds.sort((a, b) => pageSlot(a, jobRank) - pageSlot(b, jobRank));
	return kinds;
}

export function isClearPageCommand(brief: string): boolean {
	const text = brief.trim().toLowerCase();
	return /^(?:please\s+)?(?:create\s+(?:an?\s+)?)?(?:clear|empty|blank)(?:\s+the)?\s+(?:page|layout|canvas)\.?$/.test(
		text
	);
}

function briefMentionsGrill(brief: string): boolean {
	return /\b(menu|grill|restaurant|food|barbecue|bbq|dish)\b/i.test(brief);
}

function briefMentionsDelivery(brief: string): boolean {
	return /\bdeliver(?:y|ies|ed)?\b/i.test(brief);
}

function briefMentionsOrders(brief: string): boolean {
	return /\borders?\b/i.test(brief);
}

function titleWho(brief: string, screen: CatalogScreen | null): string {
	const named = displayTitleFromBrief(brief);
	if (named && named !== "Draft page") return named;
	if (screen?.title?.trim()) return screen.title.trim();
	return "Draft page";
}

function navLinks(scenario: ScenarioId | null, brief: string): PageBlock[] {
	const byScenario: Record<ScenarioId, Array<[string, string, string]>> = {
		dashboard: briefMentionsOrders(brief)
			? [
					["overview", "Overview", "Jump to the operational overview."],
					["orders", "Orders", "Orders stay empty until the author supplies them."],
					["activity", "Activity", "Activity stays empty until the author supplies it."]
				]
			: [
					["overview", "Overview", "Jump to the operational overview."],
					["metrics", "Metrics", "Metric tiles for this dashboard."],
					["activity", "Activity", "Activity stays empty until the author supplies it."]
				],
		landing: [
			["offer", "Offer", "The value proposition section."],
			["proof", "Proof", "Evidence the author still needs to confirm."],
			["start", "Start", "Primary call to action."]
		],
		website: [
			["home", "Home", "This page."],
			["about", "About", "Who the business is. Facts still needed."],
			["contact", "Contact", "How to reach the author."]
		]
	};
	const grill = briefMentionsGrill(brief);
	const delivery = briefMentionsDelivery(brief);
	const rows =
		scenario === "dashboard"
			? byScenario.dashboard
			: grill
				? [
						["home", "Home", "This page."],
						["menu", "Menu", "Ask the author for the real grill menu."],
						[
							delivery ? "delivery" : "hours",
							delivery ? "Delivery" : "Hours",
							delivery ? "Delivery area waits for the author." : "Hours wait for the author."
						],
						["contact", "Contact", "How to reach the author."]
					]
				: scenario
					? byScenario[scenario]
					: [
							["home", "Home", "This page."],
							["about", "About", "Who the business is. Facts still needed."],
							["contact", "Contact", "How to reach the author."]
						];
	return rows.map(([id, title, summary]) => block(`block-nav-${id}`, "nav-link", title, summary));
}

function featuresFor(
	scenario: ScenarioId | null,
	screen: CatalogScreen | null,
	title: string,
	brief: string
): PageBlock[] {
	const who = title && title !== "Draft page" ? title : "this page";
	const occasion = occasionFromBrief(brief);
	const grill = briefMentionsGrill(brief);
	const delivery = briefMentionsDelivery(brief);
	if (grill) {
		return [
			block(
				"block-feature-place",
				"feature",
				occasion ? `${occasion} at ${who}` : who,
				"Place and occasion from the brief. No invented reviews."
			),
			block("block-feature-menu", "feature", `${who} grill menu`, "Ask the author for the real dishes. No prices."),
			block(
				"block-feature-order",
				"feature",
				delivery ? "Grill delivery" : "How to order",
				delivery ? "Delivery area and timing wait for the author." : "Ordering facts wait for the author."
			)
		];
	}
	if (scenario === "dashboard") {
		const orders = /\borders?\b/i.test(brief);
		return [
			block(
				"block-feature-overview",
				"feature",
				orders ? `${who} orders` : `${who} overview`,
				orders ? "Order list structure. Counts stay empty until the author supplies them." : "A short status strip. No invented KPIs."
			),
			block("block-feature-metrics", "feature", "Metrics", "Figures stay empty until the author supplies real data."),
			block(
				"block-feature-work",
				"feature",
				orders ? "Order queue" : "Work queue",
				"Tasks the audience actually performs. No invented volumes."
			)
		];
	}
	if (scenario === "landing") {
		return [
			block("block-feature-offer", "feature", `${who} offer`, "State the product in the author's words, not invented claims."),
			block("block-feature-proof", "feature", "Evidence", "Testimonials and logos wait for verified facts."),
			block("block-feature-action", "feature", "One action", "A single next step. No checkout in this draft.")
		];
	}
	if (scenario === "website") {
		return [
			block("block-feature-nav", "feature", "Find the way", "Home, about, and the next useful page."),
			block("block-feature-story", "feature", `What ${who} does`, "Business facts come from the author."),
			block("block-feature-contact", "feature", "Talk to us", "Contact details wait for the author.")
		];
	}
	const labels = screen?.labels.blocks.filter((l) => rendererKindForLabel(l) === "features") ?? [];
	if (labels.length) {
		return labels.slice(0, 3).map((label, i) =>
			block(`block-feature-${i + 1}`, "feature", label, "Mapped from the selected catalog screen. No extra claims.")
		);
	}
	return [
		block("block-feature-one", "feature", `What ${who} is`, "Describe the page in the author's words."),
		block("block-feature-two", "feature", occasion ?? "Next step", "Ask the author before inventing facts."),
		block("block-feature-three", "feature", "Contact", "Contact details wait for the author.")
	];
}

function copyFor(
	kind: PageBlockKind,
	scenario: ScenarioId | null,
	screen: CatalogScreen | null,
	brief: string,
	title: string
): PageBlock["copy"] | undefined {
	const prompt = scenario ? SCENARIO_PROMPTS[scenario] : null;
	const occasion = occasionFromBrief(brief);
	const who = title && title !== "Draft page" ? title : screen?.title?.trim() || "Draft page";
	const grill = briefMentionsGrill(brief);
	const delivery = briefMentionsDelivery(brief);
	const orders = briefMentionsOrders(brief);
	if (kind === "nav") {
		return { brand: who.slice(0, 32) };
	}
	if (kind === "pagehead") {
		return {
			headline: who,
			lede: "Audience, data, and tasks wait for the author. No invented KPIs."
		};
	}
	if (kind === "overview") {
		return {
			lede: orders
				? "No orders in this draft. Counts stay empty until the author supplies them."
				: "Operational status for this dashboard. Counts stay empty until the author supplies them."
		};
	}
	if (kind === "metrics") {
		return { lede: "No figures in this draft. Metric tiles stay empty until the author supplies them." };
	}
	if (kind === "chart") {
		return { lede: "No figures in this draft. The chart stays empty until the author supplies data." };
	}
	if (kind === "activity") {
		return {
			lede: orders
				? "No orders in this draft. The list stays empty until the author supplies them."
				: "No activity in this draft. The list stays empty until the author supplies them."
		};
	}
	if (kind === "hero") {
		const occasionBit = occasion ? ` ${occasion}` : "";
		const lede = grill
			? delivery
				? `${who}${occasionBit} grill food delivery. Ask the author for the real menu, hours, and delivery area. No invented reviews, prices, or discounts.`
				: `${who}${occasionBit} grill. Ask the author for the real menu and hours. No invented reviews, prices, or discounts.`
			: scenario === "dashboard"
				? `${who} dashboard. Confirm audience, data, and tasks with the author. No invented KPIs.`
				: scenario === "website"
					? `${who} website. Confirm business facts and contact details with the author.`
					: `${who}${occasionBit}. Confirm the real offer with the author. No invented reviews or discounts.`;
		return {
			eyebrow: occasion ?? prompt?.label ?? who,
			headline: title && title !== "Draft page" ? title : displayTitleFromBrief(brief, prompt?.label ?? who),
			lede,
			action: grill ? (delivery ? "Order grill delivery" : "See the grill menu") : scenario === "dashboard" ? "Review metrics" : scenario === "website" ? "Contact" : "See the offer"
		};
	}
	if (kind === "cta") {
		return {
			lede: grill
				? delivery
					? `${who} grill delivery. Ask the author for hours and the delivery area. Not published.`
					: `${who} grill. Ask the author for hours. Not published.`
				: `${who} next step. Not published. Ask the author for the real call to action.`,
			action: grill ? (delivery ? "Ask about delivery" : "Ask for hours") : scenario === "dashboard" ? "Review metrics" : "Contact",
			note: screen ? `Stock screen ${screen.screenId}` : "No screen attached."
		};
	}
	if (kind === "footer") {
		return {
			contact: "Contact details are not invented.",
			legal: "Draft in this browser. Not a live site."
		};
	}
	if (kind === "hours") {
		return { days: "Hours are not invented.", address: "Address is not invented." };
	}
	if (kind === "menu") {
		return undefined;
	}
	return undefined;
}

function titleFor(kind: PageBlockKind, screen: CatalogScreen | null, brief = ""): string {
	if (kind === "nav") return "Header";
	if (kind === "hero") return "Hero";
	if (kind === "pagehead") return "Page heading";
	if (kind === "overview") return "Overview";
	if (kind === "metrics") return "Metrics";
	if (kind === "chart") return "Chart";
	if (kind === "activity") return briefMentionsOrders(brief) ? "Orders" : "Activity";
	if (kind === "features") return screen?.labels.section.includes("dashboard") ? "Overview" : "Why this page";
	if (kind === "menu") return "Menu";
	if (kind === "cta") return "Next step";
	if (kind === "footer") return "Footer";
	if (kind === "hours") return "Hours";
	return kind;
}

function summaryFor(kind: PageBlockKind, brief = ""): string {
	if (kind === "nav") return "Brand and section links assembled from compatible catalog labels.";
	if (kind === "hero") return "Opening section. Claims wait for the author's facts.";
	if (kind === "pagehead") return "Dashboard heading from the Stock screen or named team. No invented business.";
	if (kind === "overview") return "Operational empty state. Counts are not invented.";
	if (kind === "metrics") return "Metric tiles with no figures until the author supplies them.";
	if (kind === "chart") return "Chart panel with no figures until the author supplies data.";
	if (kind === "activity") {
		return briefMentionsOrders(brief)
			? "Empty orders list. Rows stay empty until the author supplies them."
			: "Empty activity list. Rows stay empty until the author supplies them.";
	}
	if (kind === "features") return "Compatible feature or metric slots. No fabricated numbers.";
	if (kind === "menu") return "Menu structure from the restaurant catalog labels. Dishes are placeholders.";
	if (kind === "cta") return "Primary action. No payment or publish.";
	if (kind === "footer") return "Closing band. Contact facts are not invented.";
	if (kind === "hours") return "Hours stay empty until the author supplies them.";
	return "Compatible catalog section.";
}

function suggestedFrom(screens: CatalogScreen[]): string[] {
	return screens.slice(0, 3).map((screen) => screen.screenId);
}

function poolFor(ctx: ProposalContext): CatalogScreen[] {
	if (ctx.scenarioId) {
		return filterScreens(OWNER_FILTERS[ctx.scenarioId]).slice().sort(compareScreenSupport);
	}
	return [];
}

function screenInPool(screen: CatalogScreen, pool: CatalogScreen[]): boolean {
	return pool.some((item) => item.screenId === screen.screenId);
}

function pickSupportedScreen(
	pool: CatalogScreen[],
	required: PageBlockKind[],
	scenarioId: ScenarioId | null
): CatalogScreen | null {
	if (!pool.length) return null;
	if (required.length) {
		const covering = pool
			.filter((screen) => screenSupport(screen).supported && uncoveredKinds(screen, required).length === 0)
			.sort(compareScreenSupport);
		if (covering[0]) return covering[0];
	}
	const wantsMenu = required.includes("menu");
	if (wantsMenu && scenarioId === "website") {
		const menuPool = pool
			.filter((screen) => screenSupport(screen).mappedKinds.includes("menu"))
			.sort(compareScreenSupport);
		const namedMenu = menuPool.find((screen) => screen.variant === "menu" || /\/menu$/.test(screen.screenId));
		if (namedMenu) return namedMenu;
		if (menuPool[0]) return menuPool[0];
	}
	const supported = pool.filter((screen) => screenSupport(screen).supported).sort(compareScreenSupport);
	const prefer =
		scenarioId === "dashboard" ? "overview" : scenarioId === "landing" || scenarioId === "website" ? "hero" : null;
	const preferred = prefer
		? supported.filter((screen) => screenSupport(screen).mappedKinds.includes(prefer))
		: [];
	if (preferred[0]) return preferred[0];
	if (supported[0]) return supported[0];
	if (scenarioId === "dashboard") return pool[0] ?? null;
	return null;
}

/**
 * Stock blocks of the selected screen only. Sections the author asked for that the screen
 * does not contain are reported as unavailable, never invented (catalog provenance gate).
 */
function kindsForPage(
	screen: CatalogScreen,
	scenarioId: ScenarioId | null,
	ctx: ProposalContext
): { kinds: PageBlockKind[]; unavailable: string[]; notes: string[] } {
	let kinds = uniqueKindsFromScreen(screen);
	const unavailable: string[] = [];
	const notes: string[] = [];
	const required = requiredKinds(ctx);
	const removed = removedKinds(ctx);
	if (scenarioId === "dashboard") {
		const shaped = dashboardShell(screen, kinds, required, removed);
		kinds = shaped.kinds;
		notes.push(...shaped.notes);
	}
	for (const kind of required) {
		if (kinds.includes(kind)) continue;
		const found = familyLabelForKind(screen, kind);
		if (!found) {
			unavailable.push(kind);
			continue;
		}
		inspectKind(kind, found.label);
		kinds.push(kind);
		notes.push(`Requested ${kind} from Stock screen ${found.screenId}.`);
	}
	if (removed.length) kinds = kinds.filter((kind) => !removed.includes(kind));
	return { kinds: sortKinds(kinds), unavailable, notes };
}

function sortKinds(kinds: PageBlockKind[]): PageBlockKind[] {
	const rank = new Map<PageBlockKind, number>();
	return kinds.slice().sort((a, b) => pageSlot(a, rank) - pageSlot(b, rank));
}

/**
 * Dashboard app shell from the Stock family: sidenav (+ mobile bottomnav) when the
 * spec family has them, and no marketing sitemap footer unless the author asked for one.
 * Optional blocks may be omitted; nothing outside the catalog family is added.
 */
function dashboardShell(
	screen: CatalogScreen,
	kinds: PageBlockKind[],
	required: PageBlockKind[],
	removed: PageBlockKind[]
): { kinds: PageBlockKind[]; notes: string[] } {
	const notes: string[] = [];
	let next = kinds.slice();
	if (next.includes("footer") && !required.includes("footer")) {
		next = next.filter((kind) => kind !== "footer");
		notes.push("Optional sitemap footer omitted on this Dashboard. Ask for a footer to add it.");
	}
	for (const kind of ["sidenav", "bottomnav"] as const) {
		if (next.includes(kind) || removed.includes(kind)) continue;
		if (kind === "bottomnav" && removed.includes("sidenav")) continue;
		// Only from a Stock screen of this family that actually contains the block.
		const found = familyLabelForKind(screen, kind);
		if (!found) continue;
		inspectKind(kind, found.label);
		next.push(kind);
		notes.push(`App shell: ${kind} from Stock screen ${found.screenId}.`);
	}
	return { kinds: sortKinds(next), notes };
}

function requiredBlocksPick(ctx: ProposalContext): CatalogScreen | null {
	const required = requiredKinds(ctx);
	if (!required.length) return null;
	const ranked = catalogSnapshot.screens
		.filter((screen) => screenSupport(screen).supported)
		.map((screen) => ({ screen, covered: required.length - uncoveredKinds(screen, required).length }))
		.filter((entry) => entry.covered > 0)
		.sort((a, b) => b.covered - a.covered || compareScreenSupport(a.screen, b.screen));
	return ranked[0]?.screen ?? null;
}

function resolveCatalogScreen(ctx: ProposalContext): CatalogScreen | LayoutProposalError | null {
	const pool = poolFor(ctx);
	if (ctx.screenId) {
		const screen = getScreenById(ctx.screenId);
		if (!screen) {
			return {
				ok: false,
				code: "unknown_screen",
				message: `Unknown screen ${ctx.screenId}`,
				suggestedScreenIds: suggestedFrom(pool)
			};
		}
		const best = pickSupportedScreen(pool.length ? pool : [screen], requiredKinds(ctx), ctx.scenarioId);
		if (ctx.scenarioId && pool.length && !screenInPool(screen, pool)) {
			return {
				ok: false,
				code: "scenario_screen_mismatch",
				message: `${screen.screenId} is not a ${ctx.scenarioId} Stock screen. Use a scenario-compatible screen${best ? ` such as ${best.screenId}` : ""}. Do not retry the same screenId.`,
				suggestedScreenIds: suggestedFrom(best ? [best, ...pool] : pool)
			};
		}
		const compat = compatibilityFor(screen);
		if (!compat.compatible && !compat.partial) {
			return {
				ok: false,
				code: "incompatible_screen",
				message: "This screen has no renderer-compatible blocks in the current Browser snapshot.",
				suggestedScreenIds: suggestedFrom(pool)
			};
		}
		const current = screenSupport(screen);
		if (!current.supported && ctx.scenarioId !== "dashboard") {
			return {
				ok: false,
				code: "screen_not_renderable",
				message: `${screen.screenId} is not renderer-supported (drops ${current.missing.join(", ") || "required sections"}). Use a supported screen${best ? ` such as ${best.screenId}` : ""}. Do not retry the same screenId.`,
				suggestedScreenIds: suggestedFrom(best ? [best, ...pool] : pool)
			};
		}
		return withRequiredBlocks(screen, pool, ctx);
	}
	// No scenario and no screen: the host does not guess from words. Typed requireBlocks still
	// pick the renderable screen whose Stock family covers the most of them.
	if (!ctx.scenarioId) return requiredBlocksPick(ctx);
	if (!pool.length) {
		return {
			ok: false,
			code: "catalog_no_fit",
			message:
				"No Stock screens match that scenario filter. Re-search with a bounded section or job, or pick another scenario."
		};
	}
	const picked = pickSupportedScreen(pool, requiredKinds(ctx), ctx.scenarioId);
	if (!picked) {
		return {
			ok: false,
			code: "catalog_no_fit",
			message: "Matching Stock screens have no renderer-compatible blocks. Attach a different screen or scenario."
		};
	}
	return picked;
}

/** Notes from screen resolution (switches made for required blocks), read by proposeLayout. */
let SCREEN_NOTES: string[] = [];

/**
 * The author required blocks this screen's Stock family does not contain: switch to a renderable
 * screen of the same scenario pool that has them (honest note), else keep the screen; the missing
 * kinds are reported, never invented.
 */
function withRequiredBlocks(screen: CatalogScreen, pool: CatalogScreen[], ctx: ProposalContext): CatalogScreen {
	const required = requiredKinds(ctx);
	if (!required.length || uncoveredKinds(screen, required).length === 0) return screen;
	const candidates = (pool.length ? pool : catalogSnapshot.screens.filter((item) => item.spec === screen.spec))
		.filter((item) => screenSupport(item).supported && uncoveredKinds(item, required).length === 0)
		.sort(compareScreenSupport);
	const better = candidates.find((item) => item.spec === screen.spec) ?? candidates[0];
	if (!better) return screen;
	SCREEN_NOTES.push(
		`Switched from Stock screen ${screen.screenId} to ${better.screenId}: it contains ${required.join(", ")}, which ${screen.screenId} and its family do not.`
	);
	return better;
}

/** Scenario: attached by the author or set by the model; else the first scenario whose Stock filter holds the screen. */
function resolvedScenario(ctx: ProposalContext): ScenarioId | null {
	if (ctx.scenarioId) return ctx.scenarioId;
	const screen = ctx.screenId ? getScreenById(ctx.screenId) : null;
	if (!screen) return null;
	for (const id of ["dashboard", "landing", "website"] as const) {
		if (filterScreens(OWNER_FILTERS[id]).some((item) => item.screenId === screen.screenId)) return id;
	}
	return null;
}

function requiredKinds(ctx: ProposalContext): PageBlockKind[] {
	return ctx.content?.requireBlocks ?? [];
}

function removedKinds(ctx: ProposalContext): PageBlockKind[] {
	const required = requiredKinds(ctx);
	return (ctx.content?.remove ?? []).filter((kind) => !required.includes(kind));
}

/** Required kinds this screen's Stock family cannot provide (never invented). */
function uncoveredKinds(screen: CatalogScreen, kinds: PageBlockKind[]): PageBlockKind[] {
	return kinds.filter((kind) => !familyLabelForKind(screen, kind));
}

function applyCopyEdits(blocks: PageBlock[], edits: LayoutCopyEdit[]): { blocks: PageBlock[]; changed: string[] } {
	const changed: string[] = [];
	const next = blocks.map((node) => {
		const patches = edits.filter((edit) => edit.kind === node.kind);
		if (!patches.length) return node;
		const copy = { ...node.copy };
		for (const patch of patches) {
			copy[patch.field] = patch.value;
			changed.push(`${node.kind}.${patch.field}`);
		}
		return { ...node, copy };
	});
	return { blocks: next, changed };
}

const STOCK_NOTE = /^Stock screen (screen\.[A-Za-z0-9._/-]+)$/;

/** Reject literal "null" / empty strings so UI never stores a fake screen id. */
export function recordedScreenId(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
	return trimmed;
}

/** Infer a Stock screen id from CTA copy on old pages that never stored provenance. */
export function screenIdFromPage(page: Page | null | undefined): string | null {
	if (!page) return null;
	for (const node of walk(page.layout.blocks)) {
		const note = node.copy?.note;
		if (typeof note !== "string") continue;
		const hit = note.match(STOCK_NOTE);
		if (hit?.[1]) return hit[1];
	}
	return null;
}

export function inheritedScreenId(ctx: Pick<ProposalContext, "screenId" | "currentPage" | "currentProvenance">): string | null {
	return (
		recordedScreenId(ctx.currentProvenance?.screenId) ??
		screenIdFromPage(ctx.currentPage) ??
		recordedScreenId(ctx.screenId)
	);
}

function sameFamily(a: CatalogScreen | null, b: CatalogScreen | null): boolean {
	return Boolean(a && b && a.spec === b.spec);
}

/**
 * Follow-up turn on an existing page: minimal diff from the base page.
 * Existing blocks keep their copy and rows; the author's adds/removes and the model's
 * flagged edits are applied; demo data and locale stay sticky for the session.
 */
function editExistingPage(ctx: ProposalContext, brief: string): LayoutProposal | LayoutProposalError {
	const current = ctx.currentPage;
	if (!current) {
		return { ok: false, code: "missing_page", message: "No saved page is attached to this chat." };
	}
	const title = titleFromSavedEdit(brief, current.title);
	const stamp = iso(ctx.now);
	const inherited = inheritedScreenId(ctx);
	const baseScreen = inherited ? getScreenById(inherited) : null;
	const requested = recordedScreenId(ctx.targetScreenId);
	const target = requested ? getScreenById(requested) : null;
	const screen = target && (sameFamily(target, baseScreen) || !baseScreen) ? target : baseScreen;
	const screenId = screen?.screenId ?? inherited;
	const scenarioId = ctx.currentProvenance?.scenarioId ?? resolvedScenario({ ...ctx, screenId });
	const missing = ctx.currentProvenance?.missing ?? [];
	const edits = ctx.edits ?? [];
	const working: ProposalContext = { ...ctx, pageId: current.id, scenarioId, screenId };
	const author = authorText(working);
	// Follow-ups keep the page language (continuity); the model's locale is recorded in intent only.
	const resolvedLocale = { locale: current.locale, source: "page" as const };
	const locale = resolvedLocale.locale;
	const warnings: string[] = [];
	const baseKinds = current.layout.blocks.map((node) => node.kind);
	const required = requiredKinds(working);

	// Removals: the model's typed remove list (it reads the author's words); never a required kind.
	const remove = new Set<PageBlockKind>(removedKinds(working));
	if (remove.has("sidenav")) remove.add("bottomnav");

	// Additions: required kinds, sibling-screen kinds, and kinds the model wrote content for.
	const add: PageBlockKind[] = [];
	const wantsFooter = required.includes("footer");
	const consider = (kind: PageBlockKind) => {
		if (remove.has(kind) || baseKinds.includes(kind) || add.includes(kind)) return;
		if (kind === "nav-link" || kind === "feature" || kind === "dish" || kind === "metric" || kind === "activity-item") return;
		if (kind === "footer" && scenarioId === "dashboard" && !wantsFooter) return;
		if (!screen || !familyLabelForKind(screen, kind)) return;
		add.push(kind);
	};
	for (const kind of required) consider(kind);
	if (required.includes("sidenav") && !remove.has("bottomnav")) consider("bottomnav");
	const unavailable = required.filter((kind) => !baseKinds.includes(kind) && !add.includes(kind) && !remove.has(kind));
	if (unavailable.length) {
		warnings.push(
			`Requested ${unavailable.join(", ")} but Stock screen ${screen?.screenId ?? "(none)"} and its family have no such block. Not invented.`
		);
	}
	warnings.push(...unknownBlockNotes(working));
	if (target && baseScreen && target.screenId !== baseScreen.screenId && sameFamily(target, baseScreen)) {
		for (const kind of uniqueKindsFromScreen(target)) consider(kind);
	}
	for (const entry of working.content?.blocks ?? []) {
		if (entry.edit || !baseKinds.includes(entry.kind)) consider(entry.kind);
	}
	if (add.includes("sidenav") && !add.includes("bottomnav") && !baseKinds.includes("bottomnav") && !remove.has("bottomnav")) {
		consider("bottomnav");
	}
	if (requested && !target) warnings.push(`Unknown Stock screen ${requested}; kept ${inherited ?? "the current screen"}.`);
	if (target && baseScreen && !sameFamily(target, baseScreen)) {
		warnings.push(`Stock screen ${target.screenId} is not in the ${baseScreen.spec} family; kept ${baseScreen.screenId}. Ask for a new page to switch themes.`);
	}

	const pageTitle = current.title;
	const kept = current.layout.blocks.filter((node) => !remove.has(node.kind));
	const removed = current.layout.blocks.filter((node) => remove.has(node.kind)).map((node) => node.kind);
	const fresh = add.map((kind) => buildStockBlock(kind, working, screen, brief, pageTitle));
	const rank = new Map<PageBlockKind, number>();
	const combined = [...kept, ...fresh].sort((a, b) => pageSlot(a.kind, rank) - pageSlot(b.kind, rank));

	// Demo data is sticky for the session unless the author opts out.
	// Demo data: the model's typed flag (false = the author declined it), else sticky for the session.
	const optOut = working.content?.demoData === false;
	const demoSource: ProposalIntent["demoDataSource"] =
		working.content?.demoData === true
			? "model"
			: optOut
				? "none"
				: ctx.sessionDemoData
					? "session"
					: hasDemoBadge(current.layout.blocks)
						? "page"
						: "none";
	const sticky = demoSource !== "none";
	const flagged = new Set<PageBlockKind>((working.content?.blocks ?? []).filter((entry) => entry.edit).map((entry) => entry.kind));
	const onlyKinds = new Set<PageBlockKind>([...add, ...flagged]);
	// Demo on and a data block is still empty: fill it from the model rows (nothing is lost).
	if (sticky) {
		for (const entry of working.content?.blocks ?? []) {
			const existing = combined.find((node) => node.kind === entry.kind);
			if (existing && DATA_KINDS.has(entry.kind) && !existing.children?.length && entry.items.length) onlyKinds.add(entry.kind);
		}
	}
	const overlay = overlayModelContent(working, optOut ? stripDemo(combined) : combined, locale, warnings, {
		demo: sticky,
		onlyKinds
	});
	const shell = arrangeShell(localizeEmptyLedes(overlay.blocks, locale), locale);
	const years = stripInventedFooterYears(shell.blocks, author);
	if (years.stripped.length) warnings.push(`Removed invented years from ${years.stripped.join(", ")}. Add a year in the request to keep one.`);
	let blocks = years.blocks;
	const changed = [...shell.changed];
	if (edits.length) {
		const patched = applyCopyEdits(blocks, edits);
		blocks = patched.blocks;
		changed.push(...patched.changed);
	}
	if (optOut) warnings.push("Demo data removed at the author's request.");
	const keptKinds = kept.map((node) => node.kind);
	// Kept blocks whose copy or rows the model rewrote are reported as edited, not as kept as-is.
	const rewritten = overlay.changedKinds.filter((kind) => keptKinds.includes(kind) && !add.includes(kind));
	for (const kind of rewritten) changed.push(`${kind} copy`);
	const untouched = keptKinds.filter((kind) => !rewritten.includes(kind));
	const summary = [
		add.length ? `Added ${add.join(", ")}.` : "",
		`Kept ${untouched.length} block${untouched.length === 1 ? "" : "s"}${untouched.length ? ` (${untouched.join(", ")})` : ""} with their copy${sticky ? " and demo data" : ""}.`,
		removed.length ? `Removed ${removed.join(", ")}.` : "",
		changed.length ? `Edited ${[...new Set(changed)].join(", ")}.` : ""
	]
		.filter(Boolean)
		.join(" ");
	const demoData = sticky && hasDemoBadge(blocks);
	return finishProposal(working, brief, screen, blocks, [summary, ...warnings], missing, {
		title: flagged.size || !current.title ? (working.content?.title ?? title) : title,
		id: current.id,
		createdAt: current.createdAt,
		stamp,
		status: current.status,
		slug: current.slug,
		locale,
		demoData,
		demoLabel: overlay.demoLabel,
		diff: { added: add, removed, kept: keptKinds, changed: [...new Set(changed)] },
		intent: intentRecord(working, resolvedLocale, demoSource)
	});
}

/** Remove demo rows and badges (author opted out of demo data). */
function stripDemo(blocks: PageBlock[]): PageBlock[] {
	return blocks.map((node) => {
		if (!node.copy?.badge && !(DATA_KINDS.has(node.kind) && node.children?.length)) return node;
		const next: PageBlock = { ...node };
		if (next.copy) {
			const copy = { ...next.copy };
			delete copy.badge;
			if (Object.keys(copy).length) next.copy = copy;
			else delete next.copy;
		}
		if (DATA_KINDS.has(node.kind)) delete next.children;
		return next;
	});
}

/**
 * App shell wiring: section links live in the sidenav (top navbar keeps brand only);
 * the mobile bottomnav mirrors the first sidenav links. Labels come from the page itself.
 */
export function arrangeShell(blocks: PageBlock[], locale: string): { blocks: PageBlock[]; changed: string[] } {
	const changed: string[] = [];
	const side = blocks.find((node) => node.kind === "sidenav");
	if (!side) return { blocks, changed };
	const nav = blocks.find((node) => node.kind === "nav");
	const foreign = locale.split("-")[0] !== "en";
	const sectionLinks = (prefix: string): PageBlock[] =>
		blocks
			.filter((node) => DATA_KINDS.has(node.kind) || node.kind === "pagehead")
			.slice(0, 6)
			.map((node, index) => ({
				id: `${prefix}-${index + 1}`,
				kind: "nav-link" as const,
				title: node.kind === "pagehead" ? (node.copy?.headline ?? node.title) : node.title,
				summary: node.title
			}));
	const next = blocks.map((node) => {
		if (node.kind === "sidenav") {
			const updated: PageBlock = { ...node };
			if (!updated.children?.length) {
				const fromNav = (nav?.children ?? []).map((link, index) => ({ ...link, id: `${node.id}-link-${index + 1}` }));
				updated.children = fromNav.length ? fromNav : sectionLinks(`${node.id}-link`);
				changed.push(fromNav.length ? "nav.items moved to sidenav" : "sidenav.items");
			}
			if (foreign && isShellDefaultTitle(updated.title)) updated.title = shellTitle("sidenav", locale);
			if (!updated.copy?.brand) {
				const brand = nav?.copy?.brand ?? nav?.title;
				if (brand) updated.copy = { ...updated.copy, brand };
			}
			return updated;
		}
		if (node.kind === "nav" && node.children?.length) {
			const updated = { ...node };
			delete updated.children;
			return updated;
		}
		return node;
	});
	const sideLinks = next.find((node) => node.kind === "sidenav")?.children ?? [];
	const final = next.map((node) => {
		if (node.kind !== "bottomnav") return node;
		const updated: PageBlock = { ...node };
		if (!updated.children?.length && sideLinks.length) {
			updated.children = sideLinks.slice(0, 4).map((link, index) => {
				const copy = link.copy ? { ...link.copy } : undefined;
				if (copy) delete copy.eyebrow;
				const row: PageBlock = { id: `${node.id}-link-${index + 1}`, kind: "nav-link", title: link.title, summary: link.summary };
				if (copy && Object.keys(copy).length) row.copy = copy;
				return row;
			});
			changed.push("bottomnav.items");
		}
		if (foreign && isShellDefaultTitle(updated.title)) updated.title = shellTitle("bottomnav", locale);
		return updated;
	});
	return { blocks: final, changed };
}

function hasDemoBadge(blocks: PageBlock[]): boolean {
	return walk(blocks).some((node) => typeof node.copy?.badge === "string" && node.copy.badge.length > 0);
}

export function proposeLayout(ctx: ProposalContext): LayoutProposal | LayoutProposalError {
	INSPECTED.clear();
	const brief = ctx.brief.trim();
	if (!brief) {
		return { ok: false, code: "empty_brief", message: "Write a task or attach a scenario before sending." };
	}

	const clearPage = isClearPageCommand(brief);
	if (clearPage) {
		return finishProposal(ctx, brief, null, [], [], []);
	}

	const scenarioId = resolvedScenario(ctx);
	let working: ProposalContext = { ...ctx, scenarioId };

	if (ctx.currentPage && ctx.content?.newPage !== true) {
		return editExistingPage(working, brief);
	}

	SCREEN_NOTES = [];
	const resolved = resolveCatalogScreen(working);
	if (resolved !== null && "ok" in resolved) return resolved;
	const screen = resolved;
	if (!screen) {
		return {
			ok: false,
			code: "needs_clarification",
			message:
				"No screen to assemble. Pass screenId from a search_catalog item (or scenarioId dashboard, landing or website). Unsolicited empty or invented layouts are rejected.",
			suggestedScreenIds: suggestedFrom(catalogSnapshot.screens.filter((item) => screenSupport(item).supported).sort(compareScreenSupport))
		};
	}
	if (!working.scenarioId || working.screenId !== screen.screenId) {
		working = { ...working, scenarioId: working.scenarioId ?? resolvedScenario({ ...working, scenarioId: null, screenId: screen.screenId }) };
	}

	const { kinds, unavailable, notes } = kindsForPage(screen, working.scenarioId, working);
	const warnings: string[] = [...SCREEN_NOTES, ...notes];
	warnings.push(...unknownBlockNotes(working));
	const missing: string[] = [];
	const catalogLabels = new Set(blockLabelVocabulary());
	missing.push(...(working.content?.unknownBlocks ?? []).filter((label) => catalogLabels.has(label)));
	if (unavailable.length) {
		missing.push(...unavailable);
		warnings.push(
			`Requested ${unavailable.join(", ")} but Stock screen ${screen.screenId} has no such block. Not invented; pick a Stock screen that has it.`
		);
	}
	const support = screenSupport(screen);
	const renderedKinds = kinds.filter((kind) => !CHILD_ONLY_KINDS.has(kind));
	warnings.push(
		`Stock screen ${screen.screenId}. Browser renders ${renderedKinds.join(", ") || "no sections"}.`
	);
	if (support.missing.length) {
		missing.push(...support.missing);
		warnings.push(
			`Not rendered (no Browser contract renderer): ${support.missing.join(", ")}. Pick a supported screen if you need those sections.`
		);
	}

	const pageTitle = titleWho(brief, screen);
	const blocks: PageBlock[] = [];
	for (const kind of kinds) {
		if (CHILD_ONLY_KINDS.has(kind)) continue;
		blocks.push(buildStockBlock(kind, working, screen, brief, pageTitle));
	}

	if (blocks.length === 0 && !clearPage) {
		return {
			ok: false,
			code: "empty_unsolicited_proposal",
			message:
				"Empty layout proposals are rejected unless you explicitly ask to clear the page. Search the catalog again with a bounded facet or attach a compatible screen."
		};
	}

	const resolvedLocale = resolvePageLocale({ modelLocale: working.content?.locale });
	const locale = resolvedLocale.locale;
	if (resolvedLocale.source === "default") warnings.push("No locale was set on propose_layout; the page uses en.");
	const demoRequested = working.content?.demoData === true;
	const overlay = overlayModelContent(working, blocks, locale, warnings, { demo: demoRequested });
	const shell = arrangeShell(localizeEmptyLedes(overlay.blocks, locale), locale);
	const years = stripInventedFooterYears(shell.blocks, authorText(working));
	if (years.stripped.length) {
		warnings.push(`Removed invented years from ${years.stripped.join(", ")}. Add a year in the request to keep one.`);
	}
	let assembled = years.blocks;
	const edits = working.edits ?? [];
	if (edits.length) {
		const patched = applyCopyEdits(assembled, edits);
		if (patched.changed.length) {
			warnings.push(`Applied copy edits: ${patched.changed.join(", ")}.`);
		}
		assembled = patched.blocks;
	}

	return finishProposal(working, brief, screen, assembled, warnings, missing, {
		locale,
		title: working.content?.title,
		demoData: overlay.demo,
		demoLabel: overlay.demoLabel,
		intent: intentRecord(working, resolvedLocale, demoRequested ? "model" : "none")
	});
}

/** One Stock block with catalog fallback copy (model copy is overlaid later). */
function buildStockBlock(
	kind: PageBlockKind,
	working: ProposalContext,
	screen: CatalogScreen | null,
	brief: string,
	pageTitle: string
): PageBlock {
	if (kind === "nav") {
		return block("block-nav", "nav", titleFor("nav", screen), summaryFor("nav"), copyFor("nav", working.scenarioId, screen, brief, pageTitle), navLinks(working.scenarioId, brief));
	}
	if (kind === "sidenav") {
		// Links and brand are wired by arrangeShell from the page's own navbar and sections.
		return block(
			"block-sidenav",
			"sidenav",
			"Navigation",
			"Sidebar navigation from the Stock app shell."
		);
	}
	if (kind === "bottomnav") {
		return block("block-bottomnav", "bottomnav", "Sections", "Mobile tab bar from the Stock app shell. Hidden on wide screens.");
	}
	if (kind === "features") {
		return block("block-features", "features", titleFor("features", screen), summaryFor("features"), undefined, featuresFor(working.scenarioId, screen, pageTitle, brief));
	}
	if (kind === "menu") {
		const occasion = occasionFromBrief(brief);
		return block("block-menu", "menu", titleFor("menu", screen), summaryFor("menu"), undefined, [
			block("block-dish-one", "dish", `${pageTitle} grill plate`, "Placeholder dish. Ask the author for the real grill menu. No price is invented."),
			block(
				"block-dish-two",
				"dish",
				occasion ? `${occasion} platter` : `${pageTitle} delivery plate`,
				"Placeholder dish. Ask the author for the real menu. No invented specials or prices."
			)
		]);
	}
	if (kind === "hours") {
		return block(
			"block-hours",
			"hours",
			/\bcontact\b/i.test(brief) ? "Contact" : titleFor("hours", screen),
			summaryFor("hours"),
			copyFor("hours", working.scenarioId, screen, brief, pageTitle)
		);
	}
	return block(`block-${kind}`, kind, titleFor(kind, screen, brief), summaryFor(kind, brief), copyFor(kind, working.scenarioId, screen, brief, pageTitle));
}

const CHILD_ONLY_KINDS: ReadonlySet<PageBlockKind> = new Set<PageBlockKind>(["nav-link", "feature", "dish", "metric", "activity-item"]);

const STOCK_EMPTY_LEDE = /in this draft\.\s.*until the author supplies (?:them|data)\.$/;
// ru: "No data in this draft yet. The block stays empty until you add data."
const EMPTY_LEDE_BY_LOCALE: Readonly<Record<string, string>> = {
	ru: "\u0412 \u044d\u0442\u043e\u043c \u0447\u0435\u0440\u043d\u043e\u0432\u0438\u043a\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445. \u0411\u043b\u043e\u043a \u043e\u0441\u0442\u0430\u043d\u0435\u0442\u0441\u044f \u043f\u0443\u0441\u0442\u044b\u043c, \u043f\u043e\u043a\u0430 \u0432\u044b \u043d\u0435 \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u0435 \u0434\u0430\u043d\u043d\u044b\u0435."
};

/** Stock empty-state ledes are English; never leak them onto a page in another language. */
export function localizeEmptyLedes(blocks: PageBlock[], locale: string): PageBlock[] {
	const lang = locale.toLowerCase().split("-")[0];
	if (lang === "en") return blocks;
	return blocks.map((node) => {
		const lede = node.copy?.lede;
		if (typeof lede !== "string" || !STOCK_EMPTY_LEDE.test(lede)) return node;
		const copy = { ...node.copy };
		const localized = EMPTY_LEDE_BY_LOCALE[lang];
		if (localized) copy.lede = localized;
		else delete copy.lede;
		return { ...node, copy };
	});
}

/** requireBlocks the renderer cannot place: catalog labels without a renderer, or not catalog labels at all. */
function unknownBlockNotes(ctx: ProposalContext): string[] {
	const unknown = ctx.content?.unknownBlocks ?? [];
	if (!unknown.length) return [];
	const labels = new Set(blockLabelVocabulary());
	const noRenderer = unknown.filter((label) => labels.has(label));
	const notCatalog = unknown.filter((label) => !labels.has(label));
	const notes: string[] = [];
	if (noRenderer.length) notes.push(`Stock block ${noRenderer.join(", ")} exists in the catalog but has no Browser renderer yet; not rendered.`);
	if (notCatalog.length) notes.push(`Not Stock block labels, ignored: ${notCatalog.join(", ")}.`);
	return notes;
}

function intentRecord(
	ctx: ProposalContext,
	locale: { locale: string; source: ProposalIntent["localeSource"] },
	demoSource: ProposalIntent["demoDataSource"]
): ProposalIntent {
	return {
		locale: locale.locale,
		localeSource: locale.source,
		...(typeof ctx.content?.demoData === "boolean" ? { demoData: ctx.content.demoData } : {}),
		demoDataSource: demoSource,
		requireBlocks: ctx.content?.requireBlocks ?? [],
		unknownBlocks: ctx.content?.unknownBlocks ?? [],
		remove: ctx.content?.remove ?? [],
		newPage: ctx.content?.newPage === true
	};
}

function authorText(ctx: ProposalContext): string {
	return (ctx.authorBrief ?? ctx.brief).trim();
}

/** Model copy over Stock blocks; demo rows only on an explicit author request. */
function overlayModelContent(
	ctx: ProposalContext,
	blocks: PageBlock[],
	locale: string,
	warnings: string[],
	opts: { demo?: boolean; onlyKinds?: ReadonlySet<PageBlockKind> } = {}
): { blocks: PageBlock[]; demo: boolean; demoLabel: string; changedKinds: PageBlockKind[] } {
	const author = authorText(ctx);
	const wantsDemo = opts.demo ?? ctx.content?.demoData === true;
	const existingLabel = blocks.find((node) => typeof node.copy?.badge === "string")?.copy?.badge;
	const demoLabel = existingLabel ?? demoLabelForLocale(ctx.content?.demoLabel, locale) ?? defaultDemoLabel(locale);
	const merged = mergeModelContent(blocks, ctx.content, { demo: wantsDemo, demoLabel, locale, onlyKinds: opts.onlyKinds });
	if (merged.changed.length) warnings.push(`Model copy kept on: ${[...new Set(merged.changed.map((c) => c.split(".")[0]))].join(", ")}.`);
	if (merged.droppedData.length) {
		warnings.push(
			`Data rows dropped on ${merged.droppedData.join(", ")}: the author did not ask for demo data. Figures stay empty until the author supplies them.`
		);
	}
	if (wantsDemo && merged.demoBlocks.length) {
		warnings.push(`Demo data (not real) on ${merged.demoBlocks.join(", ")}, marked "${demoLabel}".`);
	} else if (wantsDemo && !opts.onlyKinds) {
		warnings.push("Demo data was requested but no data rows were supplied. Data blocks keep their empty state.");
	}
	const changedKinds = [...new Set(merged.changed.map((c) => c.split(".")[0] as PageBlockKind))];
	return { blocks: merged.blocks, demo: wantsDemo && merged.demoBlocks.length > 0, demoLabel, changedKinds };
}

type FinishIdentity = {
	title?: string;
	locale?: string;
	demoData?: boolean;
	demoLabel?: string;
	id?: string;
	createdAt?: string;
	stamp?: string;
	status?: Page["status"];
	slug?: string;
	diff?: LayoutProposal["diff"];
	intent?: ProposalIntent;
};

function finishProposal(
	ctx: ProposalContext,
	brief: string,
	screen: CatalogScreen | null,
	blocks: PageBlock[],
	warnings: string[],
	missing: string[],
	identity?: FinishIdentity
): LayoutProposal | LayoutProposalError {
	const briefTitle = displayTitleFromBrief(brief);
	const catalogTitle = screen?.title?.trim() ?? "";
	const assembledTitle = (briefTitle && briefTitle !== "Draft page" ? briefTitle : catalogTitle || briefTitle).slice(
		0,
		160
	);
	const title = (identity?.title ?? assembledTitle) || "Draft page";
	const id = identity?.id ?? ctx.pageId ?? "page-draft";
	const stamp = identity?.stamp ?? iso(ctx.now);
	const status = identity?.status ?? "draft";
	const slug = identity?.slug ?? (slugify(title) !== "page" ? slugify(title) : slugify(catalogTitle || title));
	const locale = identity?.locale ?? "en";
	const demo = Boolean(identity?.demoData);
	const seoDescription = demo
		? `${title}. ${identity?.demoLabel ?? "Demo data"}. Draft, not published.`
		: `${title} draft. Not published. Catalog blocks only.`;
	try {
		const raw = {
			id,
			slug,
			status,
			title,
			layout: { version: PAGE_LAYOUT_VERSION, blocks },
			seo: {
				title: title.slice(0, 200),
				description: seoDescription.slice(0, 200)
			},
			locale,
			createdAt: identity?.createdAt ?? stamp,
			updatedAt: stamp
		};
		// Page spec gate: the published page-spec/v1 schema, then the parsePage program checks.
		const page = parsePageSpec(raw, { draft: status === "draft" });
		const screenId = recordedScreenId(screen?.screenId) ?? inheritedScreenId(ctx);
		const checked = validateCatalogProvenance({ page, screenId, catalogDigest: catalogProvenance().sourceDigest });
		if (!checked.ok) return checked;
		return {
			ok: true,
			status: "proposal",
			applied: false,
			source: ctx.liveTurn ? "xai-runtime" : "local-catalog-assembler",
			liveModel: Boolean(ctx.liveTurn),
			page,
			baseRevision: ctx.expectedRevision,
			warnings,
			inspected: [...INSPECTED],
			missing,
			diff: identity?.diff ?? {
				added: page.layout.blocks.map((b) => b.kind),
				removed: [],
				changed: [],
				kept: []
			},
			demoData: demo,
			catalogRefs: checked.refs,
		provenance: {
			policyVersion: POLICY_VERSION,
			modelCatalogVersion: MODEL_CATALOG_VERSION,
			trialPolicyVersion: TRIAL_POLICY_VERSION,
			catalog: catalogProvenance(),
			scenarioId: ctx.scenarioId,
			screenId,
			assembler: "local-catalog-assembler",
			...(identity?.intent ? { intent: identity.intent } : {})
		}
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : "proposal failed validation";
		const path = err && typeof err === "object" && "path" in err ? String((err as { path: unknown }).path) : undefined;
		const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "invalid_proposal";
		return { ok: false, code, message, path };
	}
}

export function applyProposal(
	proposal: LayoutProposal,
	expectedRevision: number
): { ok: true; page: Page; revision: number } | LayoutProposalError {
	if (proposal.applied) {
		return { ok: false, code: "already_applied", message: "This proposal was already applied." };
	}
	if (proposal.baseRevision !== expectedRevision) {
		return {
			ok: false,
			code: "revision_conflict",
			message: "The page changed since this proposal. Discard it and send again."
		};
	}
	try {
		const page = parsePageSpec(proposal.page);
		for (const node of walk(page.layout.blocks)) {
			const details = getBlockDetails({ id: node.kind });
			if ("ok" in details && details.ok === false) {
				return { ok: false, code: "unknown_block", message: `Apply rejected unknown kind ${node.kind}` };
			}
		}
		return { ok: true, page, revision: expectedRevision + 1 };
	} catch (err) {
		const message = err instanceof Error ? err.message : "apply failed";
		return { ok: false, code: "invalid_proposal", message };
	}
}

function walk(blocks: PageBlock[]): PageBlock[] {
	const out: PageBlock[] = [];
	for (const b of blocks) {
		out.push(b);
		if (b.children) out.push(...walk(b.children));
	}
	return out;
}

export function rejectFabricatedLayout(input: unknown): LayoutProposalError | { ok: true; page: Page } {
	try {
		const page = parsePageSpec(input);
		return { ok: true, page };
	} catch (err) {
		const message = err instanceof Error ? err.message : "invalid layout";
		const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "invalid_proposal";
		return { ok: false, code, message };
	}
}

/**
 * One Stock block of `kind` from the page's Stock screen, with catalog fallback copy
 * (page-patch add / replace). The caller checks that the screen family has the kind.
 */
export function stockBlockFor(
	kind: PageBlockKind,
	input: { screen: CatalogScreen | null; scenarioId: ScenarioId | null; brief: string; pageTitle: string }
): PageBlock {
	const ctx: ProposalContext = { brief: input.brief, scenarioId: input.scenarioId, screenId: input.screen?.screenId ?? null, expectedRevision: 0 };
	return buildStockBlock(kind, ctx, input.screen, input.brief, input.pageTitle);
}

/** Natural index of a new top-level kind among `blocks` (the assembler's page order). */
export function naturalIndexFor(kind: PageBlockKind, blocks: PageBlock[]): number {
	const rank = new Map<PageBlockKind, number>();
	const slot = pageSlot(kind, rank);
	const index = blocks.findIndex((node) => pageSlot(node.kind, rank) > slot);
	return index < 0 ? blocks.length : index;
}

export { CHILD_ONLY_KINDS };

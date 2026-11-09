import {
	PAGE_LAYOUT_VERSION,
	parseDraftPage,
	parsePage,
	type Page,
	type PageBlock,
	type PageBlockKind
} from "@buildytech/page-contract";
import { SCENARIO_PROMPTS, type ScenarioId } from "./copy.ts";
import { displayTitleFromBrief, inferScenarioId, occasionFromBrief, titleFromSavedEdit } from "./brief.ts";
import { extractCopyEditsFromBrief, type LayoutCopyEdit } from "./edits.ts";
import { catalogProvenance } from "./catalog/snapshot.ts";
import { compareScreenSupport, compatibilityFor, rendererKindForLabel, screenSupport } from "./catalog/compatibility.ts";
import { getBlockDetails } from "./catalog/details.ts";
import { filterScreens, getScreenById, searchCatalog } from "./catalog/search.ts";
import { OWNER_FILTERS } from "./copy.ts";
import type { CatalogScreen } from "./catalog/types.ts";
import { MODEL_CATALOG_VERSION, POLICY_VERSION, TRIAL_POLICY_VERSION } from "./policy.ts";

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
	diff: { added: string[]; removed: string[]; changed: string[] };
	provenance: {
		policyVersion: string;
		modelCatalogVersion: string;
		trialPolicyVersion: string;
		catalog: ReturnType<typeof catalogProvenance>;
		scenarioId: ScenarioId | null;
		screenId: string | null;
		assembler: string;
	};
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
	if (kind === "nav") return 0;
	if (kind === "hero") return 10;
	if (kind === "cta") return 90;
	if (kind === "footer") return 100;
	if (kind === "nav-link" || kind === "feature" || kind === "dish") return 200;
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

/** New page from the brief itself — not a leftover scenario badge, not "create a stronger CTA". */
export function isNewPageCommand(brief: string): boolean {
	const text = brief.trim();
	if (!text) return false;
	if (/\b(?:start over|from scratch)\b/i.test(text)) return true;
	if (/\breplace (?:the )?(?:entire )?(?:page|layout)\b/i.test(text)) return true;
	if (!/\b(?:create|build|make|start)\b/i.test(text)) return false;
	if (inferScenarioId(text) == null) return false;
	const namesScenario = /\b(?:landing(?:\s+pages?)?|dashboard|website|web site)\b/i.test(text);
	const namesBlock = /\b(cta|call to action|headline|hero|footer|nav(?:igation)?|button)\b/i.test(text);
	if (namesBlock && !namesScenario) return false;
	return true;
}

function briefMentionsGrill(brief: string): boolean {
	return /\b(menu|grill|restaurant|food|barbecue|bbq|dish)\b/i.test(brief);
}

function briefMentionsDelivery(brief: string): boolean {
	return /\bdeliver(?:y|ies|ed)?\b/i.test(brief);
}

function navLinks(scenario: ScenarioId | null, brief: string): PageBlock[] {
	const byScenario: Record<ScenarioId, Array<[string, string, string]>> = {
		dashboard: [
			["overview", "Overview", "Jump to the metrics overview."],
			["orders", "Orders", "Orders the author can verify. Counts are not invented."],
			["ask", "Ask", "Questions about audience and data."]
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
	const rows = grill
		? [
				["home", "Home", "This page."],
				["menu", "Menu", "Ask the author for the real grill menu."],
				[delivery ? "delivery" : "hours", delivery ? "Delivery" : "Hours", delivery ? "Delivery area waits for the author." : "Hours wait for the author."],
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
	const who = title && title !== "Draft page" ? title : "this page";
	const grill = briefMentionsGrill(brief);
	const delivery = briefMentionsDelivery(brief);
	if (kind === "nav") {
		return { brand: who.slice(0, 32) };
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

function titleFor(kind: PageBlockKind, screen: CatalogScreen | null): string {
	if (kind === "nav") return "Header";
	if (kind === "hero") return "Hero";
	if (kind === "features") return screen?.labels.section.includes("dashboard") ? "Overview" : "Why this page";
	if (kind === "menu") return "Menu";
	if (kind === "cta") return "Next step";
	if (kind === "footer") return "Footer";
	if (kind === "hours") return "Hours";
	return kind;
}

function summaryFor(kind: PageBlockKind): string {
	if (kind === "nav") return "Brand and section links assembled from compatible catalog labels.";
	if (kind === "hero") return "Opening section. Claims wait for the author's facts.";
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

function pickSupportedScreen(pool: CatalogScreen[], brief: string): CatalogScreen | null {
	if (!pool.length) return null;
	const wantsMenu = /\bmenus?\b/i.test(brief) || briefMentionsGrill(brief) || briefMentionsDelivery(brief);
	if (wantsMenu && inferScenarioId(brief) !== "landing") {
		const menuPool = filterScreens({ type: "screen", section: "marketing" })
			.filter((screen) => screenSupport(screen).mappedKinds.includes("menu"))
			.sort(compareScreenSupport);
		const namedMenu = menuPool.find((screen) => screen.variant === "menu" || /\/menu$/.test(screen.screenId));
		if (namedMenu) return namedMenu;
		if (menuPool[0]) return menuPool[0];
	}
	const supported = pool.filter((screen) => screenSupport(screen).supported);
	return (supported[0] ?? pool[0]) ?? null;
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
		const compat = compatibilityFor(screen);
		if (!compat.compatible && !compat.partial) {
			return {
				ok: false,
				code: "incompatible_screen",
				message: "This screen has no renderer-compatible blocks in the current Browser snapshot.",
				suggestedScreenIds: suggestedFrom(pool)
			};
		}
		const best = pickSupportedScreen(pool.length ? pool : [screen], ctx.brief);
		const current = screenSupport(screen);
		if (best && best.screenId !== screen.screenId && compareScreenSupport(best, screen) < 0) {
			return {
				ok: false,
				code: "screen_not_renderable",
				message: `${screen.screenId} drops ${current.missing.join(", ") || "most blocks"} in this Browser snapshot. Use a supported screen such as ${best.screenId}. Do not retry the same screenId.`,
				suggestedScreenIds: suggestedFrom([best, ...pool])
			};
		}
		return screen;
	}
	if (!ctx.scenarioId) return null;
	if (!pool.length) {
		return {
			ok: false,
			code: "catalog_no_fit",
			message:
				"No Stock screens match that scenario filter. Re-search with a bounded section or job, or pick another scenario."
		};
	}
	const picked = pickSupportedScreen(pool, ctx.brief);
	if (!picked) {
		return {
			ok: false,
			code: "catalog_no_fit",
			message: "Matching Stock screens have no renderer-compatible blocks. Attach a different screen or scenario."
		};
	}
	return picked;
}

function resolvedScenario(ctx: ProposalContext, brief: string): ScenarioId | null {
	return inferScenarioId(brief) ?? ctx.scenarioId;
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

function editExistingPage(ctx: ProposalContext, brief: string): LayoutProposal | LayoutProposalError {
	const current = ctx.currentPage;
	if (!current) {
		return { ok: false, code: "missing_page", message: "No saved page is attached to this chat." };
	}
	const title = titleFromSavedEdit(brief, current.title);
	const stamp = iso(ctx.now);
	const scenarioId = resolvedScenario(ctx, brief);
	const edits = ctx.edits?.length ? ctx.edits : extractCopyEditsFromBrief(brief);
	if (edits.length) {
		const patched = applyCopyEdits(current.layout.blocks, edits);
		return finishProposal(
			{ ...ctx, pageId: current.id, scenarioId },
			brief,
			null,
			patched.blocks,
			[
				patched.changed.length
					? `Edited ${patched.changed.join(", ")} on the saved page. Other blocks are unchanged.`
					: "No matching block to edit. Other blocks are unchanged."
			],
			[],
			{ title, id: current.id, createdAt: current.createdAt, stamp, status: current.status, slug: current.slug }
		);
	}
	return finishProposal(
		{ ...ctx, pageId: current.id, scenarioId },
		brief,
		null,
		current.layout.blocks,
		["No structured copy edit in that message. Other blocks are unchanged."],
		[],
		{ title, id: current.id, createdAt: current.createdAt, stamp, status: current.status, slug: current.slug }
	);
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

	const scenarioId = resolvedScenario(ctx, brief);
	const working: ProposalContext = { ...ctx, scenarioId };

	const looksNewPage = isNewPageCommand(brief);
	if (ctx.currentPage && ctx.expectedRevision > 0 && !ctx.screenId && !looksNewPage) {
		return editExistingPage(working, brief);
	}

	const resolved = resolveCatalogScreen(working);
	if (resolved !== null && "ok" in resolved) return resolved;
	const screen = resolved;
	if (!screen) {
		return {
			ok: false,
			code: "needs_clarification",
			message:
				"Say that you want a landing, dashboard, or website, attach that scenario, or pick a Stock screen. Unsolicited empty or invented layouts are rejected."
		};
	}

	const kinds = uniqueKindsFromScreen(screen);
	const warnings: string[] = [];
	const missing: string[] = [];
	const support = screenSupport(screen);
	warnings.push(
		`Stock screen ${screen.screenId}. Browser renders ${support.mappedKinds.join(", ") || "no sections"}.`
	);
	if (support.missing.length) {
		missing.push(...support.missing);
		warnings.push(
			`Not rendered (no Browser contract renderer): ${support.missing.join(", ")}. Pick a supported screen if you need those sections.`
		);
	}

	const pageTitle = displayTitleFromBrief(brief);
	const blocks: PageBlock[] = [];
	for (const kind of kinds) {
		if (kind === "nav-link" || kind === "feature" || kind === "dish") continue;
		if (kind === "nav") {
			blocks.push(
				block("block-nav", "nav", titleFor("nav", screen), summaryFor("nav"), copyFor("nav", working.scenarioId, screen, brief, pageTitle), navLinks(working.scenarioId, brief))
			);
			continue;
		}
		if (kind === "features") {
			blocks.push(
				block(
					"block-features",
					"features",
					titleFor("features", screen),
					summaryFor("features"),
					undefined,
					featuresFor(working.scenarioId, screen, pageTitle, brief)
				)
			);
			continue;
		}
		if (kind === "menu") {
			const occasion = occasionFromBrief(brief);
			blocks.push(
				block("block-menu", "menu", titleFor("menu", screen), summaryFor("menu"), undefined, [
					block("block-dish-one", "dish", `${pageTitle} grill plate`, "Placeholder dish. Ask the author for the real grill menu. No price is invented."),
					block(
						"block-dish-two",
						"dish",
						occasion ? `${occasion} platter` : `${pageTitle} delivery plate`,
						"Placeholder dish. Ask the author for the real menu. No invented specials or prices."
					)
				])
			);
			continue;
		}
		blocks.push(
			block(
				`block-${kind}`,
				kind,
				titleFor(kind, screen),
				summaryFor(kind),
				copyFor(kind, working.scenarioId, screen, brief, pageTitle)
			)
		);
	}

	if (blocks.length === 0 && !clearPage) {
		return {
			ok: false,
			code: "empty_unsolicited_proposal",
			message:
				"Empty layout proposals are rejected unless you explicitly ask to clear the page. Search the catalog again with a bounded facet or attach a compatible screen."
		};
	}

	return finishProposal(working, brief, screen, blocks, warnings, missing);
}

type FinishIdentity = {
	title?: string;
	id?: string;
	createdAt?: string;
	stamp?: string;
	status?: Page["status"];
	slug?: string;
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
	const catalogTitle = screen ? `${screen.title} ${screen.subtitle}`.trim() : "";
	const assembledTitle = (briefTitle && briefTitle !== "Draft page" ? briefTitle : catalogTitle || briefTitle).slice(
		0,
		160
	);
	const title = (identity?.title ?? assembledTitle) || "Draft page";
	const id = identity?.id ?? ctx.pageId ?? "page-draft";
	const stamp = identity?.stamp ?? iso(ctx.now);
	const status = identity?.status ?? "draft";
	const slug = identity?.slug ?? slugify(title);
	try {
		const raw = {
			id,
			slug,
			status,
			title,
			layout: { version: PAGE_LAYOUT_VERSION, blocks },
			seo: {
				title,
				description: `${title} draft. Not published. Catalog blocks only.`
			},
			locale: "en",
			createdAt: identity?.createdAt ?? stamp,
			updatedAt: stamp
		};
		const page = status === "draft" ? parseDraftPage(raw) : parsePage(raw);
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
			diff: {
				added: page.layout.blocks.map((b) => b.kind),
				removed: [],
				changed: []
			},
		provenance: {
			policyVersion: POLICY_VERSION,
			modelCatalogVersion: MODEL_CATALOG_VERSION,
			trialPolicyVersion: TRIAL_POLICY_VERSION,
			catalog: catalogProvenance(),
			scenarioId: ctx.scenarioId,
			screenId: ctx.screenId ?? screen?.screenId ?? null,
			assembler: "local-catalog-assembler"
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
		const page = parsePage(proposal.page);
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
		const page = parsePage(input);
		return { ok: true, page };
	} catch (err) {
		const message = err instanceof Error ? err.message : "invalid layout";
		const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "invalid_proposal";
		return { ok: false, code, message };
	}
}

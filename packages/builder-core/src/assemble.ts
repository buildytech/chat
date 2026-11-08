import {
	PAGE_LAYOUT_VERSION,
	parseDraftPage,
	parsePage,
	type Page,
	type PageBlock,
	type PageBlockKind
} from "@buildytech/page-contract";
import { SCENARIO_PROMPTS, type ScenarioId } from "./copy.ts";
import { catalogProvenance } from "./catalog/snapshot.ts";
import { compatibilityFor, rendererKindForLabel } from "./catalog/compatibility.ts";
import { getBlockDetails } from "./catalog/details.ts";
import { getScreenById } from "./catalog/search.ts";
import type { CatalogScreen } from "./catalog/types.ts";
import { MODEL_CATALOG_VERSION, POLICY_VERSION, TRIAL_POLICY_VERSION } from "./policy.ts";

export type ProposalContext = {
	brief: string;
	scenarioId: ScenarioId | null;
	screenId: string | null;
	expectedRevision: number;
	pageId?: string;
	now?: string;
};

export type LayoutProposal = {
	ok: true;
	status: "proposal";
	applied: false;
	source: "local-catalog-assembler" | "xai-runtime";
	liveModel: false;
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

function uniqueKindsFromScreen(screen: CatalogScreen | null): PageBlockKind[] {
	if (!screen) return ["nav", "hero", "features", "cta", "footer"];
	const seen = new Set<PageBlockKind>();
	const ordered: PageBlockKind[] = [];
	for (const label of screen.labels.blocks) {
		const kind = rendererKindForLabel(label);
		if (!kind || seen.has(kind)) continue;
		inspectKind(kind, label);
		seen.add(kind);
		ordered.push(kind);
	}
	if (!seen.has("nav")) {
		inspectKind("nav");
		ordered.unshift("nav");
	}
	if (ordered.length === 1 && ordered[0] === "nav") {
		for (const kind of ["hero", "features", "cta", "footer"] as const) {
			inspectKind(kind);
			ordered.push(kind);
		}
	}
	return ordered;
}

function navLinks(scenario: ScenarioId | null): PageBlock[] {
	const byScenario: Record<ScenarioId, Array<[string, string, string]>> = {
		dashboard: [
			["overview", "Overview", "Jump to the metrics overview."],
			["activity", "Activity", "Recent work the author can verify."],
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
	const rows = scenario ? byScenario[scenario] : [
		["brief", "Brief", "What this page is for."],
		["sections", "Sections", "Blocks chosen from the catalog."],
		["next", "Next", "Ask the author before inventing facts."]
	];
	return rows.map(([id, title, summary]) => block(`block-nav-${id}`, "nav-link", title, summary));
}

function featuresFor(scenario: ScenarioId | null, screen: CatalogScreen | null): PageBlock[] {
	if (scenario === "dashboard") {
		return [
			block("block-feature-overview", "feature", "Overview", "A short status strip. No invented KPIs."),
			block("block-feature-metrics", "feature", "Metrics", "Figures stay empty until the author supplies real data."),
			block("block-feature-work", "feature", "Work queue", "Tasks the audience actually performs.")
		];
	}
	if (scenario === "landing") {
		return [
			block("block-feature-offer", "feature", "Clear offer", "State the product in the author's words, not invented claims."),
			block("block-feature-proof", "feature", "Evidence", "Testimonials and logos wait for verified facts."),
			block("block-feature-action", "feature", "One action", "A single next step. No checkout in this draft.")
		];
	}
	if (scenario === "website") {
		return [
			block("block-feature-nav", "feature", "Find the way", "Home, about, and the next useful page."),
			block("block-feature-story", "feature", "What you do", "Business facts come from the author."),
			block("block-feature-contact", "feature", "Talk to us", "Contact copy stays generic until confirmed.")
		];
	}
	const labels = screen?.labels.blocks.filter((l) => rendererKindForLabel(l) === "features") ?? [];
	if (labels.length) {
		return labels.slice(0, 3).map((label, i) =>
			block(`block-feature-${i + 1}`, "feature", label, "Mapped from the selected catalog screen. No extra claims.")
		);
	}
	return [
		block("block-feature-one", "feature", "Catalog only", "Only blocks that exist in this snapshot are used."),
		block("block-feature-two", "feature", "Human apply", "Nothing is written until you apply the proposal."),
		block("block-feature-three", "feature", "Ask first", "Unknown facts are questions, not invented copy.")
	];
}

function copyFor(
	kind: PageBlockKind,
	scenario: ScenarioId | null,
	screen: CatalogScreen | null,
	brief: string
): PageBlock["copy"] | undefined {
	const prompt = scenario ? SCENARIO_PROMPTS[scenario] : null;
	const screenTitle = screen ? `${screen.title} ${screen.subtitle}`.trim() : "";
	if (kind === "nav") {
		return { brand: prompt?.label ?? "BuildY" };
	}
	if (kind === "hero") {
		return {
			eyebrow: prompt?.label ?? "Blank page",
			headline: brief.slice(0, 80) || prompt?.label || "Describe the page",
			lede: "I will use only catalog blocks this renderer can paint. I will ask before inventing business facts.",
			action: scenario === "dashboard" ? "Review metrics" : "Continue"
		};
	}
	if (kind === "cta") {
		return {
			lede: "This is a local proposal. Apply it to replace the blank page. Nothing is published.",
			action: "Apply when ready",
			note: screenTitle ? `Screen reference: ${screen.screenId}` : "No screen attached."
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

export function proposeLayout(ctx: ProposalContext): LayoutProposal | LayoutProposalError {
	INSPECTED.clear();
	const brief = ctx.brief.trim();
	if (!brief) {
		return { ok: false, code: "empty_brief", message: "Write a task or attach a scenario before sending." };
	}

	let screen: CatalogScreen | null = null;
	if (ctx.screenId) {
		screen = getScreenById(ctx.screenId);
		if (!screen) {
			return { ok: false, code: "unknown_screen", message: `Unknown screen ${ctx.screenId}` };
		}
		const compat = compatibilityFor(screen);
		if (!compat.compatible && !compat.partial) {
			return {
				ok: false,
				code: "incompatible_screen",
				message: "This screen has no renderer-compatible blocks in the current Browser snapshot."
			};
		}
	}

	const kinds = uniqueKindsFromScreen(screen);
	const warnings: string[] = [];
	const missing: string[] = [];
	if (screen) {
		const compat = compatibilityFor(screen);
		for (const miss of compat.missing) {
			missing.push(miss.catalogLabel);
			warnings.push(`Catalog block "${miss.catalogLabel}" has no Browser renderer and was not added.`);
		}
	}

	const blocks: PageBlock[] = [];
	for (const kind of kinds) {
		if (kind === "nav-link" || kind === "feature" || kind === "dish") continue;
		if (kind === "nav") {
			blocks.push(
				block("block-nav", "nav", titleFor("nav", screen), summaryFor("nav"), copyFor("nav", ctx.scenarioId, screen, brief), navLinks(ctx.scenarioId))
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
					featuresFor(ctx.scenarioId, screen)
				)
			);
			continue;
		}
		if (kind === "menu") {
			blocks.push(
				block("block-menu", "menu", titleFor("menu", screen), summaryFor("menu"), undefined, [
					block("block-dish-one", "dish", "House plate", "A placeholder dish. No price is invented."),
					block("block-dish-two", "dish", "Seasonal plate", "Ask the author for the real menu.")
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
				copyFor(kind, ctx.scenarioId, screen, brief)
			)
		);
	}

	const title = (screen ? `${screen.title} ${screen.subtitle}`.trim() : brief).slice(0, 160) || "Draft page";
	const id = ctx.pageId ?? "page-draft";
	const stamp = iso(ctx.now);
	try {
		const page = parseDraftPage({
			id,
			slug: slugify(title),
			status: "draft",
			title,
			layout: { version: PAGE_LAYOUT_VERSION, blocks },
			seo: {
				title,
				description: "Local draft. Not published. Catalog blocks only."
			},
			locale: "en",
			createdAt: stamp,
			updatedAt: stamp
		});
		return {
			ok: true,
			status: "proposal",
			applied: false,
			source: "local-catalog-assembler",
			liveModel: false,
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
			screenId: ctx.screenId,
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

import { searchCatalog } from "./catalog/search.ts";
import { screenSupport } from "./catalog/compatibility.ts";
import { getBlockDetails } from "./catalog/details.ts";
import { blockLabelVocabulary, vocabularyValues } from "./catalog/text-search.ts";
import { getSkill, ALLOWED_TOOLS, RUN_BUDGET, type AllowedTool } from "./policy.ts";
import {
	inheritedScreenId,
	proposeLayout,
	recordedScreenId,
	type LayoutProposal,
	type LayoutProposalError,
	type ProposalContext
} from "./assemble.ts";
import { isScenarioId } from "./brief.ts";
import { parseLayoutCopyEdits } from "./edits.ts";
import { parseModelContent } from "./content.ts";
import { OWNER_FILTERS, type ScenarioId } from "./copy.ts";
import type { Page } from "@buildytech/page-contract";
import type { CatalogFacetFilter, SearchResult } from "./catalog/types.ts";

export type ToolName = AllowedTool;

export type ToolCall = { name: string; arguments?: Record<string, unknown> };

export type ToolHost = {
	currentPage?: Page | null;
	currentProvenance?: ProposalContext["currentProvenance"];
	scenarioId?: ScenarioId | null;
	/** Live xAI tool loop. Assembly stays the deterministic catalog assembler. */
	liveTurn?: boolean;
	/** The author's own message. Demo-data and locale detection read this, not the model's brief. */
	authorBrief?: string;
	/** Host flag: demo data was requested earlier in this chat (from the author's own messages). */
	sessionDemoData?: boolean;
};

export type CompactSearchItem = {
	screenId: string;
	title: string;
	subtitle: string;
	variant: string;
	mappedKinds: string[];
	supported: boolean;
	missing: string[];
	labels: { section: string[]; job: string[]; blocks: string[] };
	/** Text-match score and the query tokens that matched (q searches only). */
	score?: number;
	matched?: string[];
	/** Renderable sibling suggested because this unrenderable screen matched. */
	via?: string;
	/** Requested block labels this screen does not have (blocks is a soft facet). */
	missingBlocks?: string[];
};

export type CompactSearchPayload = {
	query: SearchResult["query"];
	page: number;
	pageSize: number;
	total: number;
	pageCount: number;
	noFit: boolean;
	code?: SearchResult["code"];
	clarification?: string;
	suggested?: SearchResult["suggested"];
	misplaced?: SearchResult["misplaced"];
	vocabulary?: SearchResult["vocabulary"] & { blocks: string[]; industry: string[] };
	unrenderable?: SearchResult["unrenderable"];
	nearest?: SearchResult["nearest"];
	items: CompactSearchItem[];
	pick: CompactSearchItem | null;
	next: "propose_layout";
};

function compactItem(item: SearchResult["items"][number]): CompactSearchItem {
	const support = screenSupport(item);
	return {
		screenId: item.screenId,
		title: item.title,
		subtitle: item.subtitle,
		variant: item.variant,
		mappedKinds: support.mappedKinds,
		supported: support.supported,
		missing: support.missing,
		labels: { section: item.labels.section, job: item.labels.job, blocks: item.labels.blocks },
		...(item.score ? { score: Math.round(item.score * 10) / 10, matched: item.matched } : {}),
		...(item.via ? { via: item.via } : {}),
		...(item.missingBlocks?.length ? { missingBlocks: item.missingBlocks } : {})
	};
}

/** Tool-loop payload: shortlist only. No preview, spec, snapshot dump, or block-id inspect list. */
export function compactSearchResult(result: SearchResult): CompactSearchPayload {
	const items = result.items.map(compactItem);
	return {
		query: result.query,
		page: result.page,
		pageSize: result.pageSize,
		total: result.total,
		pageCount: result.pageCount,
		noFit: result.noFit,
		code: result.code,
		clarification: result.clarification,
		suggested: result.suggested,
		misplaced: result.misplaced,
		...(result.noFit
			? { vocabulary: { ...result.vocabulary, blocks: blockLabelVocabulary(), industry: vocabularyValues("industry") } }
			: {}),
		...(result.unrenderable ? { unrenderable: result.unrenderable } : {}),
		...(result.nearest ? { nearest: result.nearest } : {}),
		items,
		pick: items.find((item) => item.supported) ?? items[0] ?? null,
		next: "propose_layout"
	};
}

/** Compact host seed so the model can propose without paging the catalog. */
export function scenarioCatalogContext(scenarioId: ScenarioId | null): {
	scenarioId: ScenarioId;
	filter: CatalogFacetFilter;
	pick: CompactSearchItem | null;
	items: CompactSearchItem[];
	next: "propose_layout";
} | null {
	if (!scenarioId) return null;
	const filter = OWNER_FILTERS[scenarioId];
	// The scenario id is itself a catalog term: rank the facet pool with the generated text index
	// (a marketing-tagged dashboard screen no longer outranks real landing screens). If the
	// catalog has no such word, keep the plain facet order.
	const ranked = compactSearchResult(
		searchCatalog({ ...filter, q: scenarioId, page: 1, pageSize: RUN_BUDGET.toolPageSize, supportedOnly: true })
	);
	const result = ranked.pick
		? ranked
		: compactSearchResult(searchCatalog({ ...filter, page: 1, pageSize: RUN_BUDGET.toolPageSize, supportedOnly: true }));
	return {
		scenarioId,
		filter,
		pick: result.pick,
		items: result.items,
		next: "propose_layout"
	};
}

export function isAllowedTool(name: string): name is AllowedTool {
	return (ALLOWED_TOOLS as readonly string[]).includes(name);
}

export type ToolLoopRejection = { code: string; path?: string };

/** User-facing tool-loop miss. Codes and schema paths only — no author text. */
export function toolLoopProposalFailure(input: {
	toolsCalled: string[];
	rejections: ToolLoopRejection[];
}): LayoutProposalError {
	const proposeCount = input.toolsCalled.filter((name) => name === "propose_layout").length;
	if (proposeCount > 0) {
		const codes = [...new Set(input.rejections.map((row) => row.code).filter(Boolean))];
		const paths = [...new Set(input.rejections.map((row) => row.path).filter((path): path is string => Boolean(path)))];
		const detail = [
			codes.length ? `codes ${codes.join(", ")}` : "assembler rejected every call",
			paths.length ? `paths ${paths.join(", ")}` : null
		]
			.filter(Boolean)
			.join("; ");
		return {
			ok: false,
			code: "propose_layout_rejected",
			message: `propose_layout was called ${proposeCount} time(s) and rejected (${detail}). No local layout was substituted.`,
			path: paths[0]
		};
	}
	const used = input.toolsCalled.length > 0;
	return {
		ok: false,
		code: used ? "propose_layout_missing" : "tools_not_used",
		message: used
			? "Grok used catalog tools but did not call propose_layout. No local layout was substituted."
			: "Grok did not call catalog tools on this turn. No local layout was substituted."
	};
}

export function executeTool(
	call: ToolCall,
	host?: ToolHost
): { ok: true; name: AllowedTool; result: unknown } | { ok: false; code: string; message: string; result?: unknown; path?: string } {
	if (!isAllowedTool(call.name)) {
		return {
			ok: false,
			code: "unknown_tool",
			message: `Tool "${call.name}" is not on the allowlist. Production tools are search_catalog, get_block_details, propose_layout, get_skill.`
		};
	}
	const args = call.arguments ?? {};
	if (call.name === "search_catalog") {
		const blocks = Array.isArray(args.blocks) ? args.blocks.filter((b): b is string => typeof b === "string" && b.length > 0).slice(0, 6) : undefined;
		const result = searchCatalog({
			type: "screen",
			section: typeof args.section === "string" && args.section ? args.section : undefined,
			job: typeof args.job === "string" && args.job ? args.job : undefined,
			industry: typeof args.industry === "string" && args.industry ? args.industry : undefined,
			blocks: blocks?.length ? blocks : undefined,
			q: typeof args.q === "string" && args.q.trim() ? args.q.trim().slice(0, 200) : undefined,
			page: typeof args.page === "number" ? args.page : 1,
			pageSize: RUN_BUDGET.toolPageSize,
			supportedOnly: true
		});
		if (result.code === "catalog_facet_unknown") {
			return {
				ok: false,
				code: "catalog_facet_unknown",
				message: result.clarification ?? "Unknown catalog facet. Use the pinned Stock vocabulary.",
				result
			};
		}
		return { ok: true, name: call.name, result: compactSearchResult(result) };
	}
	if (call.name === "get_block_details") {
		const details = getBlockDetails({
			id: String(args.id ?? ""),
			variant: typeof args.variant === "string" ? args.variant : undefined,
			target: typeof args.target === "string" ? args.target : undefined
		});
		if ("ok" in details && details.ok === false) {
			return { ok: false, code: details.code, message: `No authoritative details for ${details.id}` };
		}
		if (!("ok" in details)) {
			const { provenance, ...compact } = details;
			return {
				ok: true,
				name: call.name,
				result: { ...compact, catalogDigest: provenance.sourceDigest }
			};
		}
		return { ok: true, name: call.name, result: details };
	}
	if (call.name === "get_skill") {
		const skill = getSkill(String(args.id ?? ""));
		if (!skill.ok) return { ok: false, code: skill.code, message: `Skill ${skill.id} is not available.` };
		return { ok: true, name: call.name, result: skill.skill };
	}
	if (call.name === "propose_layout") {
		if (args.layout != null) {
			return {
				ok: false,
				code: "untrusted_layout",
				message: "propose_layout does not accept a caller-supplied layout. It assembles from the catalog."
			};
		}
		const brief = String(args.brief ?? "");
		const scenarioRaw = args.scenarioId;
		const content = parseModelContent(args);
		const scenarioId = isScenarioId(scenarioRaw) ? scenarioRaw : (host?.scenarioId ?? null);
		const editing = Boolean(host?.currentPage) && content.newPage !== true;
		const currentPage = host?.currentPage ?? undefined;
		const currentProvenance = host?.currentProvenance;
		const screenId = editing
			? inheritedScreenId({
					screenId: recordedScreenId(args.screenId),
					currentPage,
					currentProvenance
				})
			: recordedScreenId(args.screenId);
		const result = proposeLayout({
			brief,
			scenarioId,
			screenId,
			expectedRevision: typeof args.expectedRevision === "number" ? args.expectedRevision : 0,
			pageId: typeof args.pageId === "string" ? args.pageId : currentPage?.id,
			currentPage,
			currentProvenance,
			liveTurn: Boolean(host?.liveTurn),
			edits: parseLayoutCopyEdits(args.edits),
			authorBrief: host?.authorBrief,
			sessionDemoData: Boolean(host?.sessionDemoData),
			targetScreenId: editing
				? (recordedScreenId(args.targetScreenId) ?? recordedScreenId(args.screenId))
				: null,
			content
		});
		if (!result.ok) {
			return {
				ok: false,
				code: result.code,
				message: result.message,
				path: result.path,
				result: {
					...(result.suggestedScreenIds ? { suggestedScreenIds: result.suggestedScreenIds } : {}),
					...(result.path ? { path: result.path } : {})
				}
			};
		}
		return { ok: true, name: call.name, result };
	}
	return { ok: false, code: "unknown_tool", message: "Unreachable tool" };
}

export function runConstructorTools(ctx: ProposalContext): LayoutProposal | LayoutProposalError {
	const scenarioId = ctx.scenarioId;
	const host = {
		currentPage: ctx.currentPage,
		currentProvenance: ctx.currentProvenance,
		authorBrief: ctx.authorBrief ?? ctx.brief,
		sessionDemoData: ctx.sessionDemoData
	};
	const search = executeTool({
		name: "search_catalog",
		arguments: scenarioId === "dashboard"
			? { section: "dashboard" }
			: scenarioId === "landing"
				? { section: "marketing" }
				: scenarioId === "website"
					? { job: "hero" }
					: {}
	}, host);
	if (!search.ok) return { ok: false, code: search.code, message: search.message };
	const found = search.result as SearchResult;
	if (found.noFit) {
		return {
			ok: false,
			code: "catalog_no_fit",
			message: found.clarification ?? "No Stock screens match. Re-search with a bounded facet from the vocabulary."
		};
	}

	if (ctx.screenId) {
		const hit = found.items.find((item) => item.screenId === ctx.screenId);
		const labels = hit?.labels.blocks ?? [];
		for (const id of labels.slice(0, 12)) {
			executeTool({ name: "get_block_details", arguments: { id } }, host);
		}
	}

	const proposed = executeTool({
		name: "propose_layout",
		arguments: {
			brief: ctx.brief,
			scenarioId,
			screenId: ctx.screenId,
			expectedRevision: ctx.expectedRevision,
			pageId: ctx.pageId
		}
	}, host);
	if (!proposed.ok) return { ok: false, code: proposed.code, message: proposed.message };
	return proposed.result as LayoutProposal;
}

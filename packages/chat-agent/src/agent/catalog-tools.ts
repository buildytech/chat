/**
 * The read tools of the agent (ADR 0034): search_catalog (Stock screens as ranking hints, with their sections as registry
 * items), get_block (one registry item: variants, props outline, sample props) and get_page (the page document). No
 * tool here writes; write_page runs in the turn loop (turn.ts).
 */
import type { PageV2 } from "@buildytech/page-contract";
import { facetTree, searchCatalog, type FacetTree } from "@buildytech/builder-core";
import { blockLabelVocabulary, vocabularyValues } from "@buildytech/builder-core";
import type { SearchQuery, SearchResult } from "@buildytech/builder-core";
import { toolOffersMode, type AgentMode } from "./agent-tools.ts";
import { readBlock } from "./blocks.ts";
import { screenItems } from "@buildytech/builder-core";
import { renderProblems } from "@buildytech/builder-core";
import { ALLOWED_TOOLS, RUN_BUDGET, type AllowedTool } from "@buildytech/builder-core";

export type ToolCall = { name: string; arguments?: Record<string, unknown> };
export type ToolHost = { mode?: AgentMode; page?: PageV2 | null };
export type ToolOutcome =
	| { ok: true; name: AllowedTool; result: unknown }
	| { ok: false; code: string; message: string; result?: unknown; path?: string };

export function isAllowedTool(name: string): name is AllowedTool {
	return (ALLOWED_TOOLS as readonly string[]).includes(name);
}

export type CompactSearchItem = {
	screenId: string;
	title: string;
	subtitle: string;
	/** The screen's sections as registry items: a starting point for the page, never a constraint. */
	sections: Array<{ item: string; variant: string }>;
	labels: { site: string[]; section: string[]; job: string[]; blocks: string[] };
	score?: number;
	matched?: string[];
	via?: string;
	missingBlocks?: string[];
};

function compactItem(item: SearchResult["items"][number]): CompactSearchItem {
	return {
		screenId: item.screenId,
		title: item.title,
		subtitle: item.subtitle,
		sections: screenItems(item.screenId).items,
		labels: { site: item.labels.site, section: item.labels.section, job: item.labels.job, blocks: item.labels.blocks },
		...(item.score ? { score: Math.round(item.score * 10) / 10, matched: item.matched } : {}),
		...(item.via ? { via: item.via } : {}),
		...(item.missingBlocks?.length ? { missingBlocks: item.missingBlocks } : {})
	};
}

const RELAX_ORDER = ["industry", "section", "job", "blocks", "site"] as const;

function combinations<T>(items: readonly T[], size: number): T[][] {
	if (size === 0) return [[]];
	return items.flatMap((item, index) => combinations(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]));
}

/** No renderable screen for the exact filter: drop the fewest facets until screens match and say which were dropped. */
export function searchRelaxed(query: SearchQuery): { result: SearchResult; dropped: string[] } | null {
	const present = RELAX_ORDER.filter((facet) => {
		const value = query[facet];
		return Array.isArray(value) ? value.length > 0 : Boolean(value);
	});
	for (let size = 1; size <= present.length; size += 1) {
		for (const dropped of combinations(present, size)) {
			const next: SearchQuery = { ...query };
			for (const facet of dropped) delete next[facet];
			const result = searchCatalog(next);
			if (!result.noFit && result.total > 0) return { result, dropped };
		}
	}
	return null;
}

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
	relaxed?: { dropped: string[]; note: string };
	facets?: FacetTree;
};

export function compactSearchResult(result: SearchResult): CompactSearchPayload {
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
		...(result.noFit ? { vocabulary: { ...result.vocabulary, blocks: blockLabelVocabulary(), industry: vocabularyValues("industry") } } : {}),
		...(result.unrenderable ? { unrenderable: result.unrenderable } : {}),
		...(result.nearest ? { nearest: result.nearest } : {}),
		items: result.items.map(compactItem)
	};
}

function searchTool(args: Record<string, unknown>): ToolOutcome {
	const blocks = Array.isArray(args.blocks) ? args.blocks.filter((b): b is string => typeof b === "string" && b.length > 0).slice(0, 6) : undefined;
	const str = (value: unknown) => (typeof value === "string" && value ? value : undefined);
	const query: SearchQuery = {
		type: "screen",
		site: str(args.site),
		section: str(args.section),
		job: str(args.job),
		industry: str(args.industry),
		blocks: blocks?.length ? blocks : undefined,
		q: typeof args.q === "string" && args.q.trim() ? args.q.trim().slice(0, 200) : undefined,
		page: typeof args.page === "number" ? args.page : 1,
		pageSize: RUN_BUDGET.toolPageSize,
		supportedOnly: true
	};
	const result = searchCatalog(query);
	if (result.code === "catalog_facet_unknown") {
		const valid: SearchQuery = { ...query };
		const bad = result.misplaced?.used ?? (["site", "section", "job"] as const).find((facet) => query[facet] && !result.vocabulary[facet].includes(query[facet]!));
		if (bad) delete valid[bad as keyof SearchQuery];
		if (query.industry && !vocabularyValues("industry").includes(query.industry)) delete valid.industry;
		if (query.blocks?.some((label) => !blockLabelVocabulary().includes(label))) delete valid.blocks;
		return { ok: false, code: "catalog_facet_unknown", message: result.clarification ?? "Unknown catalog facet. Use the pinned Stock vocabulary.", result: { ...result, facets: facetTree(valid, 10) } };
	}
	const relaxed = result.noFit ? searchRelaxed(query) : null;
	if (relaxed) {
		return {
			ok: true,
			name: "search_catalog",
			result: {
				...compactSearchResult(relaxed.result),
				facets: facetTree(query, 10),
				query: result.query,
				...(result.unrenderable?.length ? { unrenderable: result.unrenderable } : {}),
				relaxed: { dropped: relaxed.dropped, note: `No renderable Stock screen matches every facet. These match without ${relaxed.dropped.join(", ")}. Use one as a hint; do not repeat the same search.` }
			}
		};
	}
	const tree = args.browse === true || result.total <= 1 ? { facets: facetTree(query, 10) } : {};
	return { ok: true, name: "search_catalog", result: { ...compactSearchResult(result), ...tree } };
}

export function executeCatalogTool(call: ToolCall, host: ToolHost = {}): ToolOutcome {
	if (!isAllowedTool(call.name)) return { ok: false, code: "unknown_tool", message: `Tool "${call.name}" is not on the allowlist. Tools are ${ALLOWED_TOOLS.join(", ")}.` };
	if (host.mode && !toolOffersMode(call.name, host.mode)) return { ok: false, code: "tool_not_in_mode", message: `Tool "${call.name}" is not offered in ${host.mode} mode.` };
	const args = call.arguments ?? {};
	if (call.name === "search_catalog") return searchTool(args);
	if (call.name === "get_block") {
		const read = readBlock(args.item ?? args.id, args.variant);
		if (!read.ok) return { ok: false, code: read.code, message: read.message, result: { near: read.near } };
		const { ok: _ok, ...result } = read;
		return { ok: true, name: "get_block", result };
	}
	if (call.name === "get_page") {
		if (!host.page) return { ok: false, code: "missing_page", message: "There is no page document in this turn." };
		const problems = renderProblems(host.page);
		return { ok: true, name: "get_page", result: problems.length ? { ...host.page, renderProblems: problems } : host.page };
	}
	return { ok: false, code: "not_a_read_tool", message: `${call.name} is handled by the turn, not by the catalog tools.` };
}

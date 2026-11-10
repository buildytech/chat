import { searchCatalog } from "./catalog/search.ts";
import { screenSupport } from "./catalog/compatibility.ts";
import { getAskBlock, getBlockDetails } from "./catalog/details.ts";
import { toolOffersMode, type AgentMode } from "./agent/agent-tools.ts";
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
import { checkContentCatalog, parseModelContent } from "./content.ts";
import { editPage, normalizePatch } from "./patch.ts";
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
	/** Revision of currentPage (edit_page baseRevision check). */
	expectedRevision?: number;
	/** Chat mode of the turn: a tool the mode does not offer (agent-tools.v1.json) is rejected, never run. */
	mode?: AgentMode;
};

export type CompactSearchItem = {
	screenId: string;
	title: string;
	subtitle: string;
	variant: string;
	mappedKinds: string[];
	supported: boolean;
	missing: string[];
	labels: { site: string[]; section: string[]; job: string[]; blocks: string[] };
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
		labels: { site: item.labels.site, section: item.labels.section, job: item.labels.job, blocks: item.labels.blocks },
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

export type ToolLoopRejection = { code: string; path?: string; screenId?: string };

const SCREEN_TOKEN = /^[A-Za-z0-9][A-Za-z0-9./_-]{0,159}$/;

/**
 * One rejected propose_layout / edit_page call of the tool loop: code and path, plus the screen id the model sent when
 * the screen was the problem (a catalog token, never author text) so an unknown_screen run can be diagnosed.
 */
export function toolLoopRejection(
	args: Record<string, unknown>,
	result: { code: string; path?: string }
): ToolLoopRejection {
	const row: ToolLoopRejection = { code: result.code, path: result.path };
	if (/screen/.test(result.code) && typeof args.screenId === "string") {
		const id = args.screenId.trim();
		row.screenId = SCREEN_TOKEN.test(id) ? id : "(not a catalog token)";
	}
	return row;
}

function proposeLabel(toolsCalled: string[]): string {
	const edit = toolsCalled.includes("edit_page");
	const propose = toolsCalled.includes("propose_layout");
	return edit && propose ? "propose_layout / edit_page" : edit ? "edit_page" : "propose_layout";
}

/** User-facing tool-loop miss. Codes and schema paths only — no author text. */
export function toolLoopProposalFailure(input: {
	toolsCalled: string[];
	rejections: ToolLoopRejection[];
}): LayoutProposalError {
	const proposeCount = input.toolsCalled.filter((name) => name === "propose_layout" || name === "edit_page").length;
	if (proposeCount > 0) {
		const codes = [...new Set(input.rejections.map((row) => row.code).filter(Boolean))];
		const paths = [...new Set(input.rejections.map((row) => row.path).filter((path): path is string => Boolean(path)))];
		const screens = [...new Set(input.rejections.map((row) => row.screenId).filter((id): id is string => Boolean(id)))];
		const detail = [
			codes.length ? `codes ${codes.join(", ")}` : "assembler rejected every call",
			paths.length ? `paths ${paths.join(", ")}` : null,
			screens.length ? `screen ids ${screens.join(", ")}` : null
		]
			.filter(Boolean)
			.join("; ");
		return {
			ok: false,
			code: "propose_layout_rejected",
			message: `${proposeLabel(input.toolsCalled)} was called ${proposeCount} time(s) and rejected (${detail}). No local layout was substituted.`,
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
			message: `Tool "${call.name}" is not on the allowlist. Production tools are ${ALLOWED_TOOLS.join(", ")}.`
		};
	}
	if (host?.mode && !toolOffersMode(call.name, host.mode)) {
		return {
			ok: false,
			code: "tool_not_in_mode",
			message: `Tool "${call.name}" is not offered in ${host.mode} mode.${host.mode === "ask" ? " Ask mode is read-only: answer in text." : ""}`
		};
	}
	const args = call.arguments ?? {};
	if (call.name === "get_block") {
		const block = getAskBlock(String(args.id ?? ""));
		if (!block.ok) return { ok: false, code: block.code, message: `${block.id || "(empty)"} is not a Stock catalog block. Use a spec from catalogBlocks.` };
		const { ok: _ok, ...result } = block;
		return { ok: true, name: call.name, result };
	}
	if (call.name === "search_catalog") {
		const blocks = Array.isArray(args.blocks) ? args.blocks.filter((b): b is string => typeof b === "string" && b.length > 0).slice(0, 6) : undefined;
		const result = searchCatalog({
			type: "screen",
			site: typeof args.site === "string" && args.site ? args.site : undefined,
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
	if (call.name === "edit_page") {
		if (args.layout != null || args.page != null) {
			return { ok: false, code: "untrusted_layout", message: "edit_page takes page-patch/v1 ops, never a layout or page." };
		}
		if (!host?.currentPage) {
			return { ok: false, code: "missing_page", message: "edit_page needs a current page. Use propose_layout for a new page." };
		}
		const result = editPage({
			page: host.currentPage,
			provenance: host.currentProvenance,
			patch: normalizePatch({ ops: args.ops, baseRevision: args.baseRevision }),
			expectedRevision: typeof args.expectedRevision === "number" ? args.expectedRevision : (host.expectedRevision ?? 0),
			demoData: typeof args.demoData === "boolean" ? args.demoData : undefined,
			sessionDemoData: Boolean(host.sessionDemoData),
			demoLabel: typeof args.demoLabel === "string" ? args.demoLabel : undefined,
			liveTurn: Boolean(host.liveTurn),
			brief: host.authorBrief
		});
		if (!result.ok) {
			return { ok: false, code: result.code, message: result.message, path: result.path, result: result.path ? { path: result.path } : {} };
		}
		return { ok: true, name: call.name, result };
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
		const catalogCheck = checkContentCatalog(content);
		if (!catalogCheck.ok) {
			return { ok: false, code: catalogCheck.code, message: catalogCheck.message, path: catalogCheck.path, result: { path: catalogCheck.path } };
		}
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
		// The scenario's own Stock facets (catalog/policy.v0.json ownerFilters), without the asset type the tool fixes.
		arguments: scenarioId ? Object.fromEntries(Object.entries(OWNER_FILTERS[scenarioId]).filter(([facet]) => facet !== "type")) : {}
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

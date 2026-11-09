import { searchCatalog } from "./catalog/search.ts";
import { screenSupport } from "./catalog/compatibility.ts";
import { getBlockDetails } from "./catalog/details.ts";
import { getSkill, ALLOWED_TOOLS, type AllowedTool } from "./policy.ts";
import { proposeLayout, type LayoutProposal, type LayoutProposalError, type ProposalContext } from "./assemble.ts";
import { inferScenarioId, isScenarioId } from "./brief.ts";
import { parseLayoutCopyEdits } from "./edits.ts";
import type { Page } from "@buildytech/page-contract";
import type { SearchResult } from "./catalog/types.ts";

export type ToolName = AllowedTool;

export type ToolCall = { name: string; arguments?: Record<string, unknown> };

export type ToolHost = {
	currentPage?: Page | null;
	/** Live xAI tool loop. Assembly stays the deterministic catalog assembler. */
	liveTurn?: boolean;
};

export type CompactSearchItem = {
	screenId: string;
	title: string;
	subtitle: string;
	variant: string;
	group: string;
	labels: SearchResult["items"][number]["labels"];
	mappedKinds: string[];
	supported: boolean;
	compatibility: { compatible: boolean; partial: boolean; missing: string[] };
};

/** Tool-loop payload: shortlist only. No preview, spec, or snapshot dump. */
export function compactSearchResult(result: SearchResult): Omit<SearchResult, "items"> & { items: CompactSearchItem[] } {
	return {
		query: result.query,
		page: result.page,
		pageSize: result.pageSize,
		total: result.total,
		pageCount: result.pageCount,
		vocabulary: result.vocabulary,
		noFit: result.noFit,
		code: result.code,
		clarification: result.clarification,
		suggested: result.suggested,
		misplaced: result.misplaced,
		items: result.items.map((item) => {
			const support = screenSupport(item);
			return {
				screenId: item.screenId,
				title: item.title,
				subtitle: item.subtitle,
				variant: item.variant,
				group: item.group,
				labels: item.labels,
				mappedKinds: support.mappedKinds,
				supported: support.supported,
				compatibility: {
					compatible: item.compatibility.compatible,
					partial: item.compatibility.partial,
					missing: support.missing
				}
			};
		})
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
		const result = searchCatalog({
			type: "screen",
			section: typeof args.section === "string" ? args.section : undefined,
			job: typeof args.job === "string" ? args.job : undefined,
			page: typeof args.page === "number" ? args.page : 1,
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
		const scenarioId = isScenarioId(scenarioRaw) ? scenarioRaw : inferScenarioId(brief);
		const result = proposeLayout({
			brief,
			scenarioId,
			screenId: typeof args.screenId === "string" ? args.screenId : null,
			expectedRevision: typeof args.expectedRevision === "number" ? args.expectedRevision : 0,
			pageId: typeof args.pageId === "string" ? args.pageId : host?.currentPage?.id,
			currentPage: host?.currentPage ?? undefined,
			liveTurn: Boolean(host?.liveTurn),
			edits: parseLayoutCopyEdits(args.edits)
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
	const scenarioId = ctx.scenarioId ?? inferScenarioId(ctx.brief);
	const host = { currentPage: ctx.currentPage };
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

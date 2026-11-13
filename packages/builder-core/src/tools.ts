import { facetTree, getScreenById, searchCatalog, type FacetTree } from "./catalog/search.ts";
import { familyLabelForKind } from "./catalog/provenance.ts";
import { catalogBlocksWithVariant, catalogSourceFor, catalogVariantsFor } from "./catalog/sources.ts";
import { getBlockIndex } from "./catalog/compatibility.ts";
import { lucideIcons } from "./catalog/props-schema.ts";
import type { ModelPageContent } from "./content.ts";
import { screenSupport } from "./catalog/compatibility.ts";
import { askBlockCard, getAskBlock, getBlockDetails } from "./catalog/details.ts";
import { toolOffersMode, type AgentMode } from "./agent/agent-tools.ts";
import { blockLabelVocabulary, vocabularyValues } from "./catalog/text-search.ts";
import { checkPagePlan, resolveBlockRef } from "./page-plan.ts";
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
import { checkCollectionPage, collectionRejection, pruneToCollection, unplacedWarnings, type CollectionBounds } from "./collection.ts";
import { parseLayoutCopyEdits } from "./edits.ts";
import { checkContentCatalog, parseModelContent } from "./content.ts";
import { editPage, normalizePatch } from "./patch.ts";
import { OWNER_FILTERS, type ScenarioId } from "./copy.ts";
import type { Page } from "@buildytech/page-contract";
import type { CatalogFacetFilter, SearchQuery, SearchResult } from "./catalog/types.ts";

export type ToolName = AllowedTool;

export type ToolCall = { name: string; arguments?: Record<string, unknown> };

export type ToolHost = {
 scopeBlockIds?: string[];
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
	/** Stock collection bounds of the chat (host input): propose_layout pages stay inside them. */
	collection?: CollectionBounds | null;
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
	/** The exact filter had no renderable screen: the facets dropped to reach these items (searchRelaxed). */
	relaxed?: { dropped: string[]; note: string };
	/** Drill-down tree (browse=true, zero or weak hits): renderable screen counts per site, section, job, industry and block label. */
	facets?: FacetTree;
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
const RELAX_ORDER = ["industry", "section", "job", "blocks", "site"] as const;

/**
 * No renderable screen for the exact filter: drop the fewest facets (industry, section, job, blocks, then site) until
 * screens match, and say which were dropped. The text query is kept, so items still rank by the author's terms. The
 * result is the same Stock search; nothing is invented. Null when no relaxation finds a screen.
 */
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

function combinations<T>(items: readonly T[], size: number): T[][] {
	if (size === 0) return [[]];
	return items.flatMap((item, index) => combinations(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]));
}

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

/** Two rejections the model would repeat: the same code on the same op / block (the path up to its first index). */
export function sameRejection(a: Pick<ToolLoopRejection, "code" | "path"> | undefined, b: Pick<ToolLoopRejection, "code" | "path"> | undefined): boolean {
	if (!a || !b || a.code !== b.code) return false;
	const head = (path: string | undefined) => (path ? path.slice(0, path.indexOf("]") + 1) || path : "");
	return head(a.path) === head(b.path);
}

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
	/** Step budget summary: the nearest renderable screens the search returned and the allowed values of rejected blocks (catalog tokens only). */
	nearest?: { screens?: string[]; fixes?: string[]; budget?: number };
	/** The loop stopped on the same rejection twice (ADR 0033); `last` is the host's own words for it. */
	stopped?: { last?: string };
}): LayoutProposalError {
	const near = nearestSummary(input.nearest);
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
			message: `${proposeLabel(input.toolsCalled)} was called ${proposeCount} time(s) and rejected (${detail}).${
				input.stopped ? ` Stopped on the same rejection twice; the rest of the step budget was not spent.${input.stopped.last ? ` Last: ${input.stopped.last.slice(0, 280)}` : ""}` : ""
			} No local layout was substituted. The page did not change.${near}`,
			path: paths[0]
		};
	}
	const used = input.toolsCalled.length > 0;
	return {
		ok: false,
		code: used ? "propose_layout_missing" : "tools_not_used",
		message: used
			? `Grok used catalog tools but did not call propose_layout. No local layout was substituted.${near}`
			: "Grok did not call catalog tools on this turn. No local layout was substituted."
	};
}

function nearestSummary(nearest: { screens?: string[]; fixes?: string[]; budget?: number } | undefined): string {
	if (!nearest) return "";
	const parts = [
		nearest.budget ? `Step budget ${nearest.budget} used up.` : null,
		nearest.screens?.length ? `Nearest renderable screens: ${nearest.screens.slice(0, 4).join(", ")}.` : null,
		...(nearest.fixes ?? []).slice(0, 4)
	].filter(Boolean);
	return parts.length ? ` ${parts.join(" ")}` : "";
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
		const query: SearchQuery = {
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
		};
		const result = searchCatalog(query);
		const browse = args.browse === true;
		if (result.code === "catalog_facet_unknown") {
			// Not a dead end: the facet tree of the valid part of the filter comes with the error.
			const valid: SearchQuery = { ...query };
			const bad = result.misplaced?.used ?? (["site", "section", "job"] as const).find((facet) => query[facet] && !result.vocabulary[facet].includes(query[facet]!));
			if (bad) delete valid[bad as keyof SearchQuery];
			if (query.industry && !vocabularyValues("industry").includes(query.industry)) delete valid.industry;
			if (query.blocks?.some((label) => !blockLabelVocabulary().includes(label))) delete valid.blocks;
			return {
				ok: false,
				code: "catalog_facet_unknown",
				message: result.clarification ?? "Unknown catalog facet. Use the pinned Stock vocabulary.",
				result: { ...result, facets: facetTree(valid, 10) }
			};
		}
		const relaxed = result.noFit ? searchRelaxed(query) : null;
		const tree = browse || result.total <= 1 ? { facets: facetTree(query, 10) } : {};
		if (relaxed) {
			return {
				ok: true,
				name: call.name,
				result: {
					...compactSearchResult(relaxed.result),
					facets: facetTree(query, 10),
					query: result.query,
					...(result.unrenderable?.length ? { unrenderable: result.unrenderable } : {}),
					relaxed: {
						dropped: relaxed.dropped,
						note: `No renderable Stock screen matches every facet. These match without ${relaxed.dropped.join(", ")}. Pick one and call propose_layout; do not repeat the same search.`
					}
				}
			};
		}
		return { ok: true, name: call.name, result: { ...compactSearchResult(result), ...tree } };
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
	if (call.name === "propose_plan") {
		if (!host?.currentPage) {
			return { ok: false, code: "missing_page", message: "There is no page yet: answer in text; Build creates the page first." };
		}
		const plan = checkPagePlan({
			page: host.currentPage,
			scopeBlockIds: host.scopeBlockIds,
			provenance: host.currentProvenance,
			revision: host.expectedRevision ?? 0,
			sessionDemoData: Boolean(host.sessionDemoData),
			raw: args
		});
		if (!plan) return { ok: false, code: "plan_empty", message: "propose_plan needs ops on currentPage block ids." };
		return { ok: true, name: call.name, result: plan };
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
		// A block named by title, catalog block or catalog title (Logo cloud, block.logos) resolves to its page id.
		const page = host.currentPage;
		const ops = Array.isArray(args.ops)
			? args.ops.map((op) => {
					if (!op || typeof op !== "object") return op;
					let row = op as Record<string, unknown>;
					if (typeof row.blockId === "string") row = { ...row, blockId: resolveBlockRef(page, row.blockId) ?? row.blockId };
					// A named catalog block carries its own page role: kind is that block's kind when the call left it out.
					if (typeof row.catalogBlock === "string" && row.catalogBlock && typeof row.kind !== "string" && (row.op === "add" || row.op === "replace")) {
						const target = typeof row.blockId === "string" ? page.layout.blocks.find((node) => node.id === row.blockId) : undefined;
						const kind = row.op === "replace" && target ? target.kind : askBlockCard(row.catalogBlock.split("/")[0]!.startsWith("block.") ? row.catalogBlock.split("/")[0]! : `block.${row.catalogBlock.split("/")[0]}`)?.kind;
						if (kind) row = { ...row, kind };
					}
					return row;
				})
			: args.ops;
		const result = editPage({
 scopeBlockIds: host.scopeBlockIds,
			page: host.currentPage,
			provenance: host.currentProvenance,
			patch: normalizePatch({ ops, baseRevision: args.baseRevision }),
			expectedRevision: typeof args.expectedRevision === "number" ? args.expectedRevision : (host.expectedRevision ?? 0),
			demoData: typeof args.demoData === "boolean" ? args.demoData : undefined,
			sessionDemoData: Boolean(host.sessionDemoData),
			demoLabel: typeof args.demoLabel === "string" ? args.demoLabel : undefined,
			liveTurn: Boolean(host.liveTurn),
			brief: host.authorBrief
		});
		if (!result.ok) {
			// The op that failed, by index (never its text): the model fixes that op and leaves the others as they are.
			const at = result.path ? /^\$\.ops\[(\d+)\]/.exec(result.path) : null;
			const index = at ? Number(at[1]) : null;
			const failed = index !== null && Array.isArray(ops) && ops[index] && typeof ops[index] === "object" ? (ops[index] as Record<string, unknown>) : null;
			const summary = failed ? Object.fromEntries(["op", "blockId", "kind", "catalogBlock", "field"].filter((key) => typeof failed[key] === "string").map((key) => [key, failed[key]])) : null;
			const fix: Record<string, unknown> = { ...(result.fix ?? {}) };
			if (result.code === "block_not_found") fix.blockIds = page.layout.blocks.map((node) => node.id);
			const message = index !== null && result.code !== "page_patch_invalid" ? `ops[${index}]${summary?.op ? ` (${String(summary.op)}${summary.blockId ? ` ${String(summary.blockId)}` : ""})` : ""}: ${result.message}` : result.message;
			return {
				ok: false,
				code: result.code,
				message,
				path: result.path,
				result: { ...(result.path ? { path: result.path } : {}), ...(index !== null ? { opIndex: index } : {}), ...(Object.keys(fix).length ? { fix } : {}) }
			};
		}
		return { ok: true, name: call.name, result };
	}
	if (call.name === "propose_layout") {
 if (host?.scopeBlockIds?.length) return { ok: false, code: "outside_scope", message: "Selected blocks only: use edit_page on scopeBlockIds, not propose_layout." };
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
			// A named catalog block without that variant: the caller's block with every allowed value and the default
			// (ADR 0018 fix), so the model fixes it once and the host repair can fall back to the default.
			const at = catalogCheck.code === "unknown_variant" ? /^blocks\[(\d+)\]\.variant$/.exec(catalogCheck.path ?? "") : null;
			const entry = at ? content.blocks.find((row, index) => (row.at ?? index) === Number(at[1])) : undefined;
			if (at && entry?.catalogBlock) {
				return {
					ok: false,
					code: "unknown_variant",
					message: catalogCheck.message,
					path: catalogCheck.path,
					result: {
						path: catalogCheck.path,
						blockIndex: Number(at[1]),
						kind: entry.kind,
						catalogBlock: entry.catalogBlock,
						variant: entry.variant,
						allowedVariants: catalogVariantsFor(entry.catalogBlock),
						defaultVariant: catalogSourceDefault(entry.catalogBlock)
					}
				};
			}
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
			// The assembled page named a variant its catalog block does not have: point at the caller's block with the
			// allowed values (only when that block is the one the screen rendered; otherwise keep the assembler's error).
			const variantCheck = result.code === "unknown_variant" ? checkContentVariants(content, screenId) : null;
			if (variantCheck) return variantCheck;
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
		const bounds = host?.collection;
		if (bounds) {
			// Collection bounds (contract docs/collection-intake.md): reject a page outside the set so the model fixes it
			// (ADR 0018 loop); the host repair (prune) drops outside blocks and says so.
			if (bounds.prune) {
				const pruned = pruneToCollection(result.page, bounds);
				return { ok: true, name: call.name, result: { ...result, page: pruned.page, warnings: [...result.warnings, ...pruned.warnings] } };
			}
			const check = checkCollectionPage(result.page, bounds);
			const rejection = collectionRejection(check, bounds);
			if (rejection) return rejection;
			const notes = unplacedWarnings(check);
			if (notes.length) return { ok: true, name: call.name, result: { ...result, warnings: [...result.warnings, ...notes] } };
		}
		return { ok: true, name: call.name, result };
	}
	return { ok: false, code: "unknown_tool", message: "Unreachable tool" };
}

export type VariantRejection = {
	ok: false;
	code: "unknown_variant";
	message: string;
	path: string;
	result: {
		path: string;
		blockIndex: number;
		kind: string;
		catalogBlock: string;
		variant: string;
		allowedVariants: string[];
		defaultVariant: string | null;
		catalogBlocksWithVariant: string[];
	};
};

/**
 * A block that names a variant but no catalogBlock takes the catalog block of its kind on the screen (as
 * attachCatalogSources does). Check that variant against that block before assembly, so the rejection names the
 * caller's block (propose_layout.blocks[i]), the catalog block it rendered as, every allowed variant, and the
 * catalog blocks of the same kind that do have the variant. Catalog data only.
 */
export function checkContentVariants(content: ModelPageContent, screenId: string | null | undefined): VariantRejection | null {
	const screen = screenId ? getScreenById(screenId) : null;
	if (!screen) return null;
	for (const [bi, entry] of content.blocks.entries()) {
		if (!entry.variant || entry.catalogBlock) continue;
		const found = familyLabelForKind(screen, entry.kind);
		// Only kinds the screen itself renders; a family sibling's block is checked after assembly (when it is added).
		const spec = found && found.screenId === screen.screenId ? getBlockIndex(found.label)?.spec : undefined;
		if (!spec) continue;
		const allowed = catalogVariantsFor(spec);
		if (!allowed.length || allowed.includes(entry.variant)) continue;
		const at = entry.at ?? bi;
		const path = `blocks[${at}].variant`;
		const others = catalogBlocksWithVariant(entry.kind, entry.variant).filter((other) => other !== spec);
		const defaultVariant = catalogSourceDefault(spec);
		const title = entry.title ? ` "${entry.title}"` : "";
		return {
			ok: false,
			code: "unknown_variant",
			path,
			message:
				`propose_layout.blocks[${at}] (kind ${entry.kind}${title}) has no catalogBlock, so it renders as ${spec} of screen ${screen.screenId}; ` +
				`${spec} has no variant ${entry.variant}. Fix only this block: set variant to one of ${allowed.join(", ")}` +
				(others.length ? `, or keep variant ${entry.variant} and set catalogBlock to one of ${others.join(", ")}` : "") +
				`, or omit variant to keep the screen's own variant of ${spec}. Nothing was rendered.`,
			result: {
				path,
				blockIndex: at,
				kind: entry.kind,
				catalogBlock: spec,
				variant: entry.variant,
				allowedVariants: allowed,
				defaultVariant,
				catalogBlocksWithVariant: others
			}
		};
	}
	return null;
}

function catalogSourceDefault(spec: string): string | null {
	return catalogSourceFor(spec)?.defaultVariant ?? null;
}

const BLOCK_CHOICE_PATH = /^blocks\[(\d+)\]\.(variant|catalogBlock)$/;

/**
 * Partial acceptance of a rejected propose_layout: when the rejection names one caller block's catalog choice
 * (blocks[i].variant or blocks[i].catalogBlock), return the same arguments without that choice (the tool contract:
 * an omitted variant is the catalog default, an omitted catalogBlock is the screen's block of that kind) and a warning
 * naming the block, the rejected value and what is used instead. Every other block stays as the model sent it.
 */
export function repairProposeArgs(
	args: Record<string, unknown>,
	result: { code: string; path?: string; result?: unknown }
): { args: Record<string, unknown>; warning: string; blockIndex: number; field: "variant" | "catalogBlock" | "icon" } | null {
	if (result.code === "props_invalid" && result.path && /\.icon$/.test(result.path)) return repairIcons(args, result.code);
	const match = result.path ? BLOCK_CHOICE_PATH.exec(result.path) : null;
	if (!match) return null;
	const at = Number(match[1]);
	const field = match[2] as "variant" | "catalogBlock";
	const blocks = Array.isArray(args.blocks) ? args.blocks : null;
	const block = blocks?.[at];
	if (!block || typeof block !== "object") return null;
	const rec = block as Record<string, unknown>;
	const fix = (result.result ?? {}) as { catalogBlock?: unknown; defaultVariant?: unknown };
	const label = `propose_layout.blocks[${at}] (kind ${String(rec.kind)}${typeof rec.title === "string" ? ` "${rec.title}"` : ""})`;
	let next: Record<string, unknown>;
	let warning: string;
	if (field === "variant") {
		if (rec.variant === undefined) return null;
		const { variant, ...rest } = rec;
		next = rest;
		const where = typeof fix.catalogBlock === "string" ? fix.catalogBlock : "its catalog block";
		warning = `${label}: variant ${String(variant)} is not a variant of ${where} (${result.code}); this block keeps the screen's default variant, every other block is as proposed.`;
	} else {
		if (rec.catalogBlock === undefined) return null;
		const { catalogBlock, variant: _variant, ...rest } = rec;
		next = rest;
		warning = `${label}: catalogBlock ${String(catalogBlock)} was rejected (${result.code}); this block uses the screen's ${String(rec.kind)} block and its default variant, every other block is as proposed.`;
	}
	return { args: { ...args, blocks: blocks!.map((entry, index) => (index === at ? next : entry)) }, warning, blockIndex: at, field };
}

/** Row icons outside the contract's Lucide enum (the props schema) are dropped; those rows keep their text. */
function repairIcons(args: Record<string, unknown>, code: string): { args: Record<string, unknown>; warning: string; blockIndex: number; field: "icon" } | null {
	const allowed = new Set(lucideIcons());
	const blocks = Array.isArray(args.blocks) ? args.blocks : null;
	if (!blocks || !allowed.size) return null;
	const dropped: string[] = [];
	let first = -1;
	const next = blocks.map((block, index) => {
		if (!block || typeof block !== "object" || !Array.isArray((block as { items?: unknown }).items)) return block;
		const rec = block as Record<string, unknown>;
		const items = (rec.items as unknown[]).map((item) => {
			if (!item || typeof item !== "object") return item;
			const row = item as Record<string, unknown>;
			if (typeof row.icon !== "string" || allowed.has(row.icon.trim())) return item;
			dropped.push(row.icon);
			if (first < 0) first = index;
			const { icon: _icon, ...rest } = row;
			return rest;
		});
		return { ...rec, items };
	});
	if (!dropped.length) return null;
	return {
		args: { ...args, blocks: next },
		warning: `Row icons ${[...new Set(dropped)].join(", ")} are not in the published props schema (${code}); those rows render without an icon, everything else is as proposed.`,
		blockIndex: first,
		field: "icon"
	};
}

export function runConstructorTools(ctx: ProposalContext): LayoutProposal | LayoutProposalError {
	const scenarioId = ctx.scenarioId;
	const host = {
 scopeBlockIds: ctx.scopeBlockIds,
		currentPage: ctx.currentPage,
		currentProvenance: ctx.currentProvenance,
		authorBrief: ctx.authorBrief ?? ctx.brief,
		sessionDemoData: ctx.sessionDemoData,
		// The local assembler has no model to fix a page: it keeps only collection blocks at once.
		collection: ctx.collection ? { ...ctx.collection, prune: true } : null
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
			pageId: ctx.pageId,
			// Collection items are placed as the model would place them: one entry per required item with a renderer.
			...(ctx.collection
				? { blocks: ctx.collection.required.filter((r) => r.kind).map((r) => ({ kind: r.kind, catalogBlock: r.catalogBlock, ...(r.variant ? { variant: r.variant } : {}) })) }
				: {})
		}
	}, host);
	if (!proposed.ok) return { ok: false, code: proposed.code, message: proposed.message };
	return proposed.result as LayoutProposal;
}

/** One block of a collection intake draft: what the host placed and the variants the model may pick from. */
export type CollectionDraftBlock = {
	kind: string;
	catalogBlock: string;
	variant: string | null;
	/** Catalog default of the block (used when a model variant is not allowed, ADR 0018). */
	defaultVariant: string | null;
	/** Every allowed variant of the catalog block (pinned catalog). */
	variants: string[];
	/** A collection block item (the author picked this block and variant). */
	required: boolean;
};

/**
 * Collection intake draft (ADR 0022): the page the host assembles deterministically from the collection before the
 * first model call. The screen is the collection's first screen (else the chat screen, else the first renderable
 * screen with the required blocks), the required items sit on the blocks of their kind with their variants, kinds the
 * collection has no block for are removed. The model only writes copy and may refine variants from `variants`.
 */
export type CollectionDraft = {
	screenId: string;
	blocks: CollectionDraftBlock[];
	remove: string[];
	warnings: string[];
	/** Set when the collection's own screen cannot render and the draft uses another one (said in the proposal). */
	screenNote?: string;
	/** The draft page itself (catalog copy, no model copy): the base of placeholder detection (ADR 0023). */
	stock?: Page;
};

/**
 * A fresh Stock page from one screen, program only (ADR 0024 step B, "Start page from this screen"): the same
 * propose_layout assembly the collection intake draft runs, with no model step and no copy, so every block keeps its
 * Stock sample. The result is an ordinary layout proposal for the client / server gates, or the tool error (for
 * example screen_not_renderable with suggestedScreenIds).
 */
export function stockScreenDraft(input: {
	screenId: string;
	scenarioId?: ScenarioId | null;
	/** Page locale (the UI language); the blocks keep their Stock sample text either way. */
	locale?: string | null;
}): { ok: true; proposal: LayoutProposal } | { ok: false; code: string; message: string; suggestedScreenIds?: string[] } {
	const screenId = recordedScreenId(input.screenId);
	if (!screenId) return { ok: false, code: "unknown_screen", message: `${input.screenId || "(empty)"} is not a Stock screen.` };
	const made = executeTool(
		{
			name: "propose_layout",
			arguments: {
				brief: getScreenById(screenId)?.title ?? screenId,
				screenId,
				scenarioId: input.scenarioId ?? null,
				expectedRevision: 0,
				newPage: true,
				...(input.locale ? { locale: input.locale } : {})
			}
		},
		{}
	);
	if (!made.ok) {
		const suggested = (made.result as { suggestedScreenIds?: string[] } | undefined)?.suggestedScreenIds;
		return { ok: false, code: made.code, message: made.message, ...(suggested?.length ? { suggestedScreenIds: suggested } : {}) };
	}
	return { ok: true, proposal: made.result as LayoutProposal };
}

export function collectionIntakeDraft(input: {
	bounds: CollectionBounds;
	brief: string;
	screenId?: string | null;
	scenarioId?: ScenarioId | null;
}): CollectionDraft | null {
	const { bounds } = input;
	const placed = bounds.required.filter((r) => r.kind).map((r) => ({ kind: r.kind, catalogBlock: r.catalogBlock, ...(r.variant ? { variant: r.variant } : {}) }));
	const requiredSpecs = new Set(bounds.required.map((r) => r.catalogBlock));
	const own = [...bounds.screens, ...(recordedScreenId(input.screenId) ? [recordedScreenId(input.screenId)!] : [])];
	const queue: string[] = [...own];
	const notRenderable: string[] = [];
	const tried = new Set<string>();
	let best: { draft: CollectionDraft; score: number } | null = null;
	const consider = (screenId: string) => {
		if (tried.has(screenId)) return;
		tried.add(screenId);
		const base = { brief: input.brief, screenId, scenarioId: input.scenarioId ?? null, expectedRevision: 0, blocks: placed };
		// Kinds of the screen whose every block is outside the collection go to remove (one model step saved).
		const full = executeTool({ name: "propose_layout", arguments: base }, {});
		if (!full.ok) {
			if (full.code === "screen_not_renderable" && own.includes(screenId)) {
				notRenderable.push(screenId);
				const next = (full.result as { suggestedScreenIds?: string[] } | undefined)?.suggestedScreenIds ?? [];
				for (const id of next) if (!queue.includes(id)) queue.push(id);
			}
			return;
		}
		const fullPage = (full.result as LayoutProposal).page;
		const check = checkCollectionPage(fullPage, bounds);
		const outsideKinds = new Set(check.outside.map((o) => o.kind));
		const remove = [...outsideKinds].filter((kind) =>
			fullPage.layout.blocks.every((node, index) => node.kind !== kind || check.outside.some((o) => o.index === index))
		);
		const made = executeTool(
			{ name: "propose_layout", arguments: { ...base, ...(remove.length ? { remove } : {}) } },
			{ collection: { ...bounds, prune: true } }
		);
		if (!made.ok) return;
		const proposal = made.result as LayoutProposal;
		const blocks = proposal.page.layout.blocks
			.filter((node) => node.catalogBlock)
			.map((node) => ({
				kind: node.kind,
				catalogBlock: node.catalogBlock!,
				variant: node.variant ?? null,
				defaultVariant: catalogSourceFor(node.catalogBlock)?.defaultVariant ?? null,
				variants: catalogVariantsFor(node.catalogBlock!),
				required: requiredSpecs.has(node.catalogBlock!)
			}));
		if (!blocks.length) return;
		// The collection's own screen wins; another screen only when none of them renders, then the one that carries
		// the most required items, then the most collection blocks.
		const score = (own.includes(screenId) ? 1000 : 0) + blocks.filter((row) => row.required).length * 10 + blocks.length;
		if (best && best.score >= score) return;
		const warnings = proposal.warnings.filter((w) => /collection/i.test(w));
		const screenNote =
			!own.includes(screenId) && notRenderable.length
				? `${notRenderable.join(", ")} cannot render in this BuildY version yet; the page uses ${screenId} with the collection's blocks only.`
				: undefined;
		if (screenNote) warnings.unshift(screenNote);
		best = { draft: { screenId, blocks, remove, warnings, ...(screenNote ? { screenNote } : {}), stock: proposal.page }, score };
	};
	for (let i = 0; i < queue.length && i < 6; i += 1) consider(queue[i]!);
	if (!best || (best as { score: number }).score < 1000) {
		// No own screen renders (or the collection has none): renderable screens that carry the required blocks.
		const labels = [...new Set(bounds.required.filter((r) => r.kind).map((r) => r.label))];
		const found = executeTool({ name: "search_catalog", arguments: labels.length ? { blocks: labels } : {} }, {});
		const items = found.ok ? ((found.result as { items?: Array<{ screenId?: string; supported?: boolean }> }).items ?? []) : [];
		for (const item of items) if (item.supported !== false && item.screenId && !queue.includes(item.screenId)) queue.push(item.screenId);
		for (let i = 0; i < queue.length && tried.size < 10; i += 1) consider(queue[i]!);
	}
	return best ? (best as { draft: CollectionDraft }).draft : null;
}

/**
 * Pre-placement of a model's propose_layout call in an intake turn: the draft screen when the model names none (or one
 * outside the collection's screens), the draft catalog block and variant on every entry of a draft kind that names
 * none, and the draft's removed kinds. The model's copy and its own allowed variant choices are kept; invalid choices
 * still come back as unknown_variant with the allowed list (ADR 0018).
 */
export function placeCollectionDraft(args: Record<string, unknown>, draft: CollectionDraft, bounds: CollectionBounds): Record<string, unknown> {
	return placeCollectionDraftWithNotes(args, draft, bounds).args;
}

/** placeCollectionDraft plus what the host changed (a catalog block outside the collection is put back to the draft's). */
export function placeCollectionDraftWithNotes(
	args: Record<string, unknown>,
	draft: CollectionDraft,
	bounds: CollectionBounds
): { args: Record<string, unknown>; warnings: string[] } {
	const warnings: string[] = [];
	const allowed = new Set(bounds.allowed);
	const asked = recordedScreenId(args.screenId);
	const screenId = asked && (bounds.screens.length === 0 ? asked === draft.screenId : bounds.screens.includes(asked)) ? asked : draft.screenId;
	const entries: unknown[] = Array.isArray(args.blocks) ? [...args.blocks] : [];
	const seen = new Set<string>();
	const blocks = entries.map((raw) => {
		if (!raw || typeof raw !== "object") return raw;
		const rec = raw as Record<string, unknown>;
		const kind = typeof rec.kind === "string" ? rec.kind : "";
		const pick = draft.blocks.find((row) => row.kind === kind);
		if (!pick || seen.has(kind)) return raw;
		seen.add(kind);
		const asked = typeof rec.catalogBlock === "string" && rec.catalogBlock ? rec.catalogBlock : null;
		// A catalog block outside the collection is never rendered: the entry keeps its copy on the draft's block.
		const outside = Boolean(asked && !allowed.has(asked));
		if (outside) warnings.push(`${asked} (${kind}) is not in the collection "${bounds.title}"; the ${kind} block stays ${pick.catalogBlock}${pick.variant ? `/${pick.variant}` : ""}.`);
		const spec = asked && !outside ? asked : pick.catalogBlock;
		const sameBlock = spec === pick.catalogBlock;
		const variant = !outside && typeof rec.variant === "string" && rec.variant ? rec.variant : sameBlock ? pick.variant : null;
		// A section title that only names the kind or catalog block (e.g. "Hero") takes the model's own headline.
		const title = typeof rec.title === "string" ? rec.title.trim().toLowerCase() : "";
		const generic = !title || title === kind.toLowerCase() || title === spec.replace(/^block\./, "").toLowerCase() || title === (askBlockCard(spec)?.title ?? "").toLowerCase();
		const headline = typeof rec.headline === "string" ? rec.headline.trim() : "";
		const named = generic && headline ? { title: headline.slice(0, 80) } : {};
		// A required item keeps the author's variant unless the model picked another variant of the same block.
		return { ...rec, ...named, catalogBlock: spec, ...(variant ? { variant } : {}) };
	});
	for (const row of draft.blocks) {
		if (seen.has(row.kind)) continue;
		seen.add(row.kind);
		if (row.required) blocks.push({ kind: row.kind, catalogBlock: row.catalogBlock, ...(row.variant ? { variant: row.variant } : {}) });
	}
	const remove = [...new Set([...(Array.isArray(args.remove) ? args.remove.filter((k): k is string => typeof k === "string") : []), ...draft.remove])];
	if (draft.screenNote && screenId === draft.screenId) warnings.unshift(draft.screenNote);
	return { args: { ...args, screenId, blocks, ...(remove.length ? { remove } : {}) }, warnings };
}

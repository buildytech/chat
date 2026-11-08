import { paginateScreens } from "./catalog/search.ts";
import { getBlockDetails } from "./catalog/details.ts";
import { getSkill, ALLOWED_TOOLS, type AllowedTool } from "./policy.ts";
import { proposeLayout, type LayoutProposal, type LayoutProposalError, type ProposalContext } from "./assemble.ts";

export type ToolName = AllowedTool;

export type ToolCall = { name: string; arguments?: Record<string, unknown> };

export function isAllowedTool(name: string): name is AllowedTool {
	return (ALLOWED_TOOLS as readonly string[]).includes(name);
}

export function executeTool(
	call: ToolCall
): { ok: true; name: AllowedTool; result: unknown } | { ok: false; code: string; message: string } {
	if (!isAllowedTool(call.name)) {
		return { ok: false, code: "unknown_tool", message: `Tool "${call.name}" is not on the allowlist.` };
	}
	const args = call.arguments ?? {};
	if (call.name === "search_catalog") {
		try {
			const result = paginateScreens({
				type: "screen",
				section: typeof args.section === "string" ? args.section : undefined,
				job: typeof args.job === "string" ? args.job : undefined,
				page: typeof args.page === "number" ? args.page : 1
			});
			return { ok: true, name: call.name, result };
		} catch (err) {
			const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "search_failed";
			return { ok: false, code, message: err instanceof Error ? err.message : "search failed" };
		}
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
		const scenarioRaw = args.scenarioId;
		const scenarioId =
			scenarioRaw === "dashboard" || scenarioRaw === "landing" || scenarioRaw === "website" ? scenarioRaw : null;
		const result = proposeLayout({
			brief: String(args.brief ?? ""),
			scenarioId,
			screenId: typeof args.screenId === "string" ? args.screenId : null,
			expectedRevision: typeof args.expectedRevision === "number" ? args.expectedRevision : 0,
			pageId: typeof args.pageId === "string" ? args.pageId : undefined
		});
		if (!result.ok) return { ok: false, code: result.code, message: result.message };
		return { ok: true, name: call.name, result };
	}
	return { ok: false, code: "unknown_tool", message: "Unreachable tool" };
}

export function runConstructorTools(ctx: ProposalContext): LayoutProposal | LayoutProposalError {
	const search = executeTool({
		name: "search_catalog",
		arguments: ctx.scenarioId === "dashboard"
			? { section: "dashboard" }
			: ctx.scenarioId === "landing"
				? { section: "marketing" }
				: ctx.scenarioId === "website"
					? { job: "hero" }
					: {}
	});
	if (!search.ok) return { ok: false, code: search.code, message: search.message };

	if (ctx.screenId) {
		const screenSearch = search.result as { items: Array<{ screenId: string; labels: { blocks: string[] } }> };
		const hit = screenSearch.items.find((item) => item.screenId === ctx.screenId);
		const labels = hit?.labels.blocks ?? [];
		for (const id of labels.slice(0, 12)) {
			executeTool({ name: "get_block_details", arguments: { id } });
		}
	} else {
		for (const id of ["nav", "hero", "features", "cta", "footer"]) {
			const details = executeTool({ name: "get_block_details", arguments: { id } });
			if (!details.ok) return { ok: false, code: details.code, message: details.message };
		}
	}

	const proposed = executeTool({
		name: "propose_layout",
		arguments: {
			brief: ctx.brief,
			scenarioId: ctx.scenarioId,
			screenId: ctx.screenId,
			expectedRevision: ctx.expectedRevision,
			pageId: ctx.pageId
		}
	});
	if (!proposed.ok) return { ok: false, code: proposed.code, message: proposed.message };
	return proposed.result as LayoutProposal;
}

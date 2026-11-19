/**
 * The read tools of the agent (ADR 0034, 0059): list_blocks (every block of the catalog with its variants), get_block (one
 * block: variants, props outline, sample props) and get_page (the page document). No tool here writes; write_page runs in
 * the turn loop (turn.ts) and only in Build.
 */
import type { PageV2 } from "@buildytech/page-contract";
import { toolOffersMode, type AgentMode } from "./agent-tools.ts";
import { readBlock } from "./blocks.ts";
import { catalogBlocks, pageForModel, renderProblems } from "@buildytech/builder-core";
import { ALLOWED_TOOLS, type AllowedTool } from "@buildytech/builder-core";

type ToolCall = { name: string; arguments?: Record<string, unknown> };
type ToolHost = { mode?: AgentMode; page?: PageV2 | null };
type ToolOutcome =
	| { ok: true; name: AllowedTool; result: unknown }
	| { ok: false; code: string; message: string; result?: unknown; path?: string };

function isAllowedTool(name: string): name is AllowedTool {
	return (ALLOWED_TOOLS as readonly string[]).includes(name);
}

/** list_blocks: the whole catalog (it is small): item, title, category, description and every variant. */
function listBlocks(): ToolOutcome {
	return {
		ok: true,
		name: "list_blocks",
		result: {
			total: catalogBlocks().length,
			blocks: catalogBlocks().map((block) => ({
				item: block.item,
				title: block.title,
				category: block.category,
				description: block.description,
				defaultVariant: block.contract.defaultVariant,
				variants: block.contract.variants.map((v) => ({ id: v.id, label: v.label }))
			}))
		}
	};
}

export function executeCatalogTool(call: ToolCall, host: ToolHost = {}): ToolOutcome {
	if (!isAllowedTool(call.name)) return { ok: false, code: "unknown_tool", message: `Tool "${call.name}" is not on the allowlist. Tools are ${ALLOWED_TOOLS.join(", ")}.` };
	if (host.mode && !toolOffersMode(call.name, host.mode)) return { ok: false, code: "tool_not_in_mode", message: `Tool "${call.name}" is not offered in ${host.mode} mode.` };
	const args = call.arguments ?? {};
	if (call.name === "list_blocks") return listBlocks();
	if (call.name === "get_block") {
		const read = readBlock(args.item ?? args.id, args.variant);
		if (!read.ok) return { ok: false, code: read.code, message: read.message, result: { near: read.near } };
		const { ok: _ok, ...result } = read;
		return { ok: true, name: "get_block", result };
	}
	if (call.name === "get_page") {
		if (!host.page) return { ok: false, code: "missing_page", message: "There is no page document in this turn." };
		const problems = renderProblems(host.page);
		return { ok: true, name: "get_page", result: problems.length ? { ...pageForModel(host.page), renderProblems: problems } : pageForModel(host.page) };
	}
	return { ok: false, code: "not_a_read_tool", message: `${call.name} is handled by the turn, not by the catalog tools.` };
}

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
/** Compact evidence stays available in hash-only session exports. No provider-specific fields. */
export function catalogEvidence(name: string, result: unknown) {
 if (!record(result)) return undefined;
 if (name === "get_block") return { kind: "catalog-block", item: result.item };
 if (name !== "list_blocks") return undefined;
 return { kind: "catalog-list", total: result.total };
}

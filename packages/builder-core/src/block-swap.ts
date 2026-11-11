import type { PageBlock } from "@buildytech/page-contract";
import sourcesRaw from "./catalog/sources.json" with { type: "json" };
import { organismFor, registryItemFor } from "./catalog/organism.ts";
import { catalogSourceFor, catalogVariantsFor, resolveCatalogChoice } from "./catalog/sources.ts";

/**
 * Block replacement by another Stock catalog block in the same place (ADR 0023, follow-up to ADR 0020): hero on
 * block.hero -> block.storehero. The new block keeps the block id, its kind (the page role: same slot on the page),
 * title and every text field the new block's registry props read (the organism mapping, ADR 0021 viewMap origins);
 * text the new block does not render is dropped and named. Pure and deterministic: no model call.
 */
export type BlockSwap =
	| { ok: true; node: PageBlock; dropped: string[] }
	| { ok: false; code: string; message: string; allowed?: string[] };

/**
 * Text fields of a page block as origin paths of the organism mapping (`copy.lede`, `children[0].copy.icon`). Title
 * and summary are required page data (section name, meta text): they always stay, so they are not listed.
 */
function textFields(node: PageBlock): string[] {
	const out: string[] = [];
	for (const [key, value] of Object.entries(node.copy ?? {})) if (value) out.push(`copy.${key}`);
	for (const [index, child] of (node.children ?? []).entries()) {
		out.push(`children[${index}]`);
		for (const [key, value] of Object.entries(child.copy ?? {})) if (value) out.push(`children[${index}].copy.${key}`);
	}
	return out;
}

/** A dropped origin path as the author reads it: `eyebrow`, `rows`, `row icon`. */
function fieldName(path: string): string {
	const row = /^children\[\d+\](?:\.(?:copy\.)?([a-z]+))?$/.exec(path);
	if (row) return row[1] ? `rows.${row[1]}` : "rows";
	return path.replace(/^copy\./, "");
}

export function swapCatalogBlock(target: PageBlock, want: { catalogBlock: string; variant?: string | null }): BlockSwap {
	const choice = resolveCatalogChoice({ kind: target.kind, catalogBlock: want.catalogBlock, variant: want.variant ?? null });
	if (!choice.ok) {
		const allowed = choice.code === "unknown_variant" ? catalogVariantsFor(want.catalogBlock.startsWith("block.") ? want.catalogBlock.split("/")[0]! : `block.${want.catalogBlock.split("/")[0]}`) : undefined;
		return { ok: false, code: choice.code, message: choice.message, ...(allowed?.length ? { allowed } : {}) };
	}
	const variant = choice.variant ?? catalogSourceFor(choice.catalogBlock)?.defaultVariant ?? null;
	if (choice.catalogBlock === target.catalogBlock && (variant ?? null) === (target.variant ?? null)) {
		return { ok: false, code: "no_change", message: `${target.id} already renders ${choice.catalogBlock}${variant ? `/${variant}` : ""}.` };
	}
	if (!registryItemFor(choice.catalogBlock, variant)) {
		return { ok: false, code: "no_renderer", message: `${choice.catalogBlock} has no page renderer in this BuildY version yet.` };
	}
	const draft: PageBlock = { ...structuredClone(target), catalogBlock: choice.catalogBlock };
	if (variant) draft.variant = variant;
	else delete draft.variant;
	const render = organismFor(draft);
	if (!render) return { ok: false, code: "no_renderer", message: `${choice.catalogBlock} has no page renderer in this BuildY version yet.` };
	const read = new Set(Object.values(render.origins));
	// headline / lede read the title / summary only when the copy key is absent: the copy key carries the text then.
	const lost = textFields(draft).filter((path) => !read.has(path));
	const node = draft;
	const droppedRows = new Set<number>();
	for (const path of lost) {
		const rowOnly = /^children\[(\d+)\]$/.exec(path);
		if (rowOnly) {
			droppedRows.add(Number(rowOnly[1]));
			continue;
		}
		const rowField = /^children\[(\d+)\]\.copy\.([a-z]+)$/.exec(path);
		if (rowField) {
			const child = node.children?.[Number(rowField[1])];
			if (child?.copy) delete (child.copy as Record<string, unknown>)[rowField[2]!];
			continue;
		}
		const key = /^copy\.([a-z]+)$/.exec(path)?.[1];
		if (key && node.copy) delete (node.copy as Record<string, unknown>)[key];
	}
	if (droppedRows.size && node.children) {
		node.children = node.children.filter((_, index) => !droppedRows.has(index));
		if (!node.children.length) delete node.children;
	}
	if (node.copy && !Object.keys(node.copy).length) delete node.copy;
	for (const child of node.children ?? []) if (child.copy && !Object.keys(child.copy).length) delete child.copy;
	const dropped = [...new Set(lost.filter((path) => !/^children\[\d+\]\./.test(path) || !droppedRows.has(Number(/\d+/.exec(path)![0]))).map(fieldName))];
	return { ok: true, node, dropped };
}

/** Stock catalog blocks that render as this page kind and have a page renderer (the allowed list of a replace). */
export function catalogBlocksForKind(kind: PageBlock["kind"]): string[] {
	return Object.keys((sourcesRaw as unknown as { specs: Record<string, unknown> }).specs)
		.filter((spec) => resolveCatalogChoice({ kind, catalogBlock: spec, variant: null }).ok && registryItemFor(spec))
		.sort()
		.slice(0, 40);
}

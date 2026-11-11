import { PAGE_SLOTS, type Page, type PageBlock } from "@buildytech/page-contract";
import { askBlockCard } from "./catalog/details.ts";

/**
 * Catalog placeholder copy (ADR 0023): text a proposal still carries from the assembler's own draft (the page built
 * from the catalog with no model copy) or a section title that is only the block's kind or catalog title. Detected
 * by comparison, never by word lists, so it works for any topic and language.
 */
export type PlaceholderField = { blockId: string; kind: string; field: string };

const SKIP_KEYS = new Set(["badge", "href", "note"]);

function names(node: PageBlock): Set<string> {
	const out = new Set([node.kind.toLowerCase()]);
	if (node.catalogBlock) {
		out.add(node.catalogBlock.replace(/^block\./, "").toLowerCase());
		const card = askBlockCard(node.catalogBlock);
		if (card) {
			out.add(card.title.toLowerCase());
			out.add(card.label.toLowerCase());
		}
	}
	return out;
}

/** Text fields of a block the author sees: its copy keys (not badge / href / note), title, and rows. */
export function placeholderFields(page: Page, stock: Page | null | undefined): PlaceholderField[] {
	const out: PlaceholderField[] = [];
	const stockById = new Map((stock?.layout.blocks ?? []).map((node) => [node.id, node]));
	for (const node of page.layout.blocks) {
		const base = stockById.get(node.id) ?? stock?.layout.blocks.find((row) => row.kind === node.kind && row.catalogBlock === node.catalogBlock);
		const push = (field: string) => out.push({ blockId: node.id, kind: node.kind, field });
		if (names(node).has(node.title.trim().toLowerCase()) || (base && base.title === node.title)) push("title");
		for (const key of PAGE_SLOTS[node.kind]?.copy ?? []) {
			if (SKIP_KEYS.has(key)) continue;
			const value = node.copy?.[key];
			if (typeof value === "string" && value && base?.copy?.[key] === value) push(key);
		}
		const rows = node.children ?? [];
		const stockRows = new Set((base?.children ?? []).map((child) => child.title));
		if (rows.length && stockRows.size && rows.every((child) => stockRows.has(child.title))) push("rows");
	}
	return out;
}

/** The placeholder values of the draft page, per block kind, for the model to replace (copy keys and row labels). */
export function placeholderHints(stock: Page): Record<string, Record<string, unknown>> {
	const out: Record<string, Record<string, unknown>> = {};
	for (const node of stock.layout.blocks) {
		const hint: Record<string, unknown> = {};
		for (const key of PAGE_SLOTS[node.kind]?.copy ?? []) {
			if (SKIP_KEYS.has(key)) continue;
			const value = node.copy?.[key];
			if (typeof value === "string" && value) hint[key] = value.slice(0, 120);
		}
		if (node.children?.length) hint.rows = node.children.map((child) => child.title).slice(0, 6);
		if (Object.keys(hint).length) out[node.kind] = hint;
	}
	return out;
}

export function placeholderWarning(fields: readonly PlaceholderField[]): string | null {
	if (!fields.length) return null;
	return `Catalog placeholder copy is still on ${fields.map((row) => `${row.kind}.${row.field}`).join(", ")}: write it in the inspector or ask Build to change it.`;
}

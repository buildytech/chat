import type { PageBlock } from "@buildytech/page-contract";

/**
 * Host-side copy guards that do not read author intent from words.
 * (Intent such as demo data, locale, required or removed blocks is a typed propose_layout field.)
 */

const YEAR = /(?:\u00a9|\(c\)|copyright)?\s*\b(?:19|20)\d{2}\b(?:\s*[-\u2013]\s*(?:19|20)\d{2}\b)?/gi;

/**
 * Footer facts the author never gave are not invented: strip years (and the copyright
 * sign attached to them) from footer legal/contact unless the year appears in the brief.
 */
export function stripInventedFooterYears(
	blocks: PageBlock[],
	authorText: string
): { blocks: PageBlock[]; stripped: string[] } {
	const stripped: string[] = [];
	const allowed = new Set((authorText.match(/\b(?:19|20)\d{2}\b/g) ?? []).map(String));
	const next = blocks.map((node) => {
		if (node.kind !== "footer" || !node.copy) return node;
		const copy = { ...node.copy };
		let touched = false;
		for (const field of ["legal", "contact"] as const) {
			const value = copy[field];
			if (typeof value !== "string") continue;
			const cleaned = value
				.replace(YEAR, (match) => {
					const years = match.match(/(?:19|20)\d{2}/g) ?? [];
					if (years.length && years.every((y) => allowed.has(y))) return match;
					stripped.push(`${node.kind}.${field}`);
					touched = true;
					return " ";
				})
				.replace(/\s*\u00a9\s*(?=[.,;]|$)/g, "")
				.replace(/^\s*[.,;:\-\u2013\u00b7|]+\s*/, "")
				.replace(/\s{2,}/g, " ")
				.trim();
			if (cleaned) copy[field] = cleaned;
			else delete copy[field];
		}
		return touched ? { ...node, copy } : node;
	});
	return { blocks: next, stripped: [...new Set(stripped)] };
}

const YEAR_TOKEN = /\b(?:19|20)\d{2}\b/g;
const SENTENCE = /[^.!?]+(?:[.!?]+|$)/g;

/** Every text the model wrote in this propose_layout call (copy, titles, rows): the only text the guard touches. */
export function modelTexts(content: { title?: string; blocks: Array<{ title?: string; copy: Record<string, unknown>; items: Array<Record<string, unknown>> }> } | undefined): Set<string> {
	const out = new Set<string>();
	if (!content) return out;
	if (content.title) out.add(content.title);
	for (const entry of content.blocks) {
		if (entry.title) out.add(entry.title);
		for (const value of Object.values(entry.copy)) if (typeof value === "string") out.add(value);
		for (const item of entry.items) for (const field of ["label", "detail", "note"]) if (typeof item[field] === "string") out.add(item[field] as string);
	}
	return out;
}

function withoutYearSentences(value: string, allowed: Set<string>): string | null {
	const years = value.match(YEAR_TOKEN) ?? [];
	if (!years.length || years.every((y) => allowed.has(y))) return null;
	const kept = (value.match(SENTENCE) ?? [value]).filter((part) => (part.match(YEAR_TOKEN) ?? []).every((y) => allowed.has(y)));
	return kept.join("").replace(/\s{2,}/g, " ").trim();
}

/**
 * Years the author never gave are not invented anywhere on the page (ADR 0023; the footer has its own guard): a
 * sentence of model copy (copy fields, titles, row label / detail / note) with a year missing from the author's
 * message is dropped; an emptied field falls back to nothing. Only text the model wrote this turn is touched (hand
 * edits and earlier copy stay); data rows of an explicit demo are figures, not facts, and stay.
 */
export function stripInventedYears(
	blocks: PageBlock[],
	authorText: string,
	prior: string[] = [],
	fromModel: ReadonlySet<string> = new Set(),
	skipKinds: ReadonlySet<string> = new Set(["footer", "overview", "metrics", "chart", "activity"])
): { blocks: PageBlock[]; stripped: string[] } {
	const stripped = [...prior];
	const allowed = new Set((authorText.match(YEAR_TOKEN) ?? []).map(String));
	const clean = (node: PageBlock, path: string): PageBlock => {
		let next = node;
		const copy = { ...(node.copy ?? {}) } as Record<string, unknown>;
		let touched = false;
		for (const [field, value] of Object.entries(copy)) {
			if (typeof value !== "string" || !fromModel.has(value)) continue;
			const cleaned = withoutYearSentences(value, allowed);
			if (cleaned === null) continue;
			touched = true;
			stripped.push(`${path}.${field}`);
			if (cleaned) copy[field] = cleaned;
			else delete copy[field];
		}
		if (touched) next = { ...next, copy: copy as PageBlock["copy"] };
		for (const field of ["title", "summary"] as const) {
			const value = next[field];
			if (typeof value !== "string" || !fromModel.has(value)) continue;
			const cleaned = withoutYearSentences(value, allowed);
			if (cleaned === null || !cleaned) continue;
			stripped.push(`${path}.${field}`);
			next = { ...next, [field]: cleaned };
		}
		return next;
	};
	const out = blocks.map((node) => {
		if (skipKinds.has(node.kind)) return node;
		const top = clean(node, node.kind);
		if (!top.children?.length) return top;
		return { ...top, children: top.children.map((child, index) => clean(child, `${node.kind}.rows[${index}]`)) };
	});
	return { blocks: out, stripped: [...new Set(stripped)] };
}

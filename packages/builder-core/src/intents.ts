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

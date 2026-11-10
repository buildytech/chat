import raw from "./search-index.json" with { type: "json" };

/**
 * Catalog-driven text search over Stock screens. The index is derived by `npm run snapshot`
 * (scripts/lib/catalog-graph.mjs) from catalog/stock-registry.v0.json (asset titles, subtitles,
 * labels, search words, facet value labels in five locales and facet synonyms). There are no
 * hand-written keyword lists here: new catalog terms work without code changes.
 */
type VocabValue = { id: string; label: Record<string, string> };

type RawIndex = {
	format: string;
	schemaVersion: number;
	pinnedCommit: string;
	sources: { assets: { artifact: string; digest: string }; facets: { artifact: string; sha256: string } };
	vocabulary: Record<string, VocabValue[]>;
	terms: string[];
	screens: Record<string, string>;
};

const index = raw as RawIndex;

const screenTerms = new Map<string, Map<string, number>>();
for (const [screenId, packed] of Object.entries(index.screens)) {
	const terms = new Map<string, number>();
	for (const pair of packed.split(",")) {
		if (!pair) continue;
		const [at, weight] = pair.split(":");
		const term = index.terms[parseInt(at ?? "", 36)];
		if (term) terms.set(term, Number(weight) || 1);
	}
	screenTerms.set(screenId, terms);
}
const allTerms = index.terms;

export const SEARCH_INDEX_SOURCES = index.sources;
export const SEARCH_INDEX_PINNED_COMMIT = index.pinnedCommit;

export function queryTokens(q: string): string[] {
	return [
		...new Set(
			String(q ?? "")
				.toLowerCase()
				.split(/[^\p{L}\p{N}]+/u)
				.filter((t) => t.length >= 2 && t.length <= 40)
		)
	].slice(0, 12);
}

function termScore(token: string, terms: Map<string, number>): number {
	const exact = terms.get(token);
	if (exact) return exact;
	if (token.length < 4) return 0;
	let best = 0;
	for (const [term, weight] of terms) {
		if (term.length < 4) continue;
		if (term.startsWith(token) || token.startsWith(term)) best = Math.max(best, weight * 0.5);
	}
	return best;
}

export type TextScore = { score: number; matched: string[] };

/** Score every indexed screen for a free-text query. Screens with no matching token are omitted. */
export function scoreScreens(q: string): { scores: Map<string, TextScore>; tokens: string[]; unmatched: string[] } {
	const tokens = queryTokens(q);
	const scores = new Map<string, TextScore>();
	const hitTokens = new Set<string>();
	for (const [screenId, terms] of screenTerms) {
		let score = 0;
		const matched: string[] = [];
		for (const token of tokens) {
			const s = termScore(token, terms);
			if (s > 0) {
				score += s;
				matched.push(token);
				hitTokens.add(token);
			}
		}
		if (score > 0) scores.set(screenId, { score, matched });
	}
	return { scores, tokens, unmatched: tokens.filter((t) => !hitTokens.has(t)) };
}

function distance(a: string, b: string): number {
	if (Math.abs(a.length - b.length) > 2) return 99;
	const row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i += 1) {
		let prev = row[0]!;
		row[0] = i;
		for (let j = 1; j <= b.length; j += 1) {
			const tmp = row[j]!;
			row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
			prev = tmp;
		}
	}
	return row[b.length]!;
}

/** Nearest indexed catalog terms for tokens that matched nothing (typos, near words). */
export function nearestTerms(tokens: string[], limit = 5): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const token of tokens) {
		const ranked = allTerms
			.map((term) => ({ term, d: term.startsWith(token.slice(0, 3)) ? Math.min(distance(token, term), 3) : distance(token, term) }))
			.filter((row) => row.d <= 2 || (token.length >= 3 && row.term.startsWith(token.slice(0, 3))))
			.sort((a, b) => a.d - b.d || a.term.length - b.term.length)
			.slice(0, limit)
			.map((row) => row.term);
		out[token] = ranked;
	}
	return out;
}

/** Compact search vocabulary: facet values with an English meaning (from the catalog's own labels). */
export function searchVocabulary(): Record<string, Array<{ id: string; en: string }>> {
	const out: Record<string, Array<{ id: string; en: string }>> = {};
	for (const [facet, values] of Object.entries(index.vocabulary)) {
		out[facet] = values.map((value) => ({ id: value.id, en: value.label.en ?? value.id }));
	}
	return out;
}

export function vocabularyValues(facet: string): string[] {
	return (index.vocabulary[facet] ?? []).map((value) => value.id);
}

/** Block labels used by Stock screens (e.g. sidenav, bottomnav, navbar, sitemap). */
export function blockLabelVocabulary(): string[] {
	return vocabularyValues("blocks");
}

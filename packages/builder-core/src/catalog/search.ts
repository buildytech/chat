import { catalogSnapshot } from "./snapshot.ts";
import type { CatalogFacetFilter, CatalogScreen, SearchQuery, SearchResult } from "./types.ts";
import { compareScreenSupport, compatibilityFor, screenSupport } from "./compatibility.ts";
import { OWNER_FILTERS } from "../copy.ts";

export const DEFAULT_PAGE_SIZE = catalogSnapshot.pageSize;

export function facetVocabulary(): CatalogSnapshotVocab {
	return catalogSnapshot.facetVocabulary;
}

type CatalogSnapshotVocab = (typeof catalogSnapshot)["facetVocabulary"];

export function isFacetValue(facet: "section" | "job" | "type", value: string): boolean {
	return catalogSnapshot.facetVocabulary[facet].includes(value);
}

export function assertFacetValue(facet: "section" | "job" | "type", value: string): void {
	if (!isFacetValue(facet, value)) {
		throw Object.assign(new Error(`Unknown catalog facet ${facet}=${value}`), {
			code: "catalog_facet_unknown",
			facet,
			value
		});
	}
}

/** If a value was sent on the wrong facet, point at the bounded re-search. */
export function misplacedFacet(facet: "section" | "job", value: string): { tryFacet: "section" | "job" } | null {
	if (isFacetValue(facet, value)) return null;
	const other = facet === "section" ? "job" : "section";
	if (isFacetValue(other, value)) return { tryFacet: other };
	return null;
}

export function filterScreens(query: CatalogFacetFilter): CatalogScreen[] {
	const type = query.type ?? "screen";
	if (type !== "screen") {
		return [];
	}
	if (query.section) assertFacetValue("section", query.section);
	if (query.job) assertFacetValue("job", query.job);

	return catalogSnapshot.screens.filter((screen) => {
		if (query.section && !screen.labels.section.includes(query.section)) return false;
		if (query.job && !screen.labels.job.includes(query.job)) return false;
		return true;
	});
}

function ownerSuggestions(): SearchResult["suggested"] {
	return [
		{ section: OWNER_FILTERS.dashboard.section, reason: "Dashboard uses section=dashboard." },
		{ section: OWNER_FILTERS.landing.section, reason: "Landing uses section=marketing." },
		{ job: OWNER_FILTERS.website.job, reason: "Website uses job=hero. hero is a job facet, not a section." }
	];
}

export function searchCatalog(query: SearchQuery = {}): SearchResult {
	const vocabulary = facetVocabulary();
	const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

	for (const facet of ["section", "job"] as const) {
		const value = query[facet];
		if (!value) continue;
		if (isFacetValue(facet, value)) continue;
		const swap = misplacedFacet(facet, value);
		const suggested = swap
			? [{ [swap.tryFacet]: value, reason: `"${value}" is a ${swap.tryFacet} value, not ${facet}. Re-search with ${swap.tryFacet}=${value}.` }]
			: ownerSuggestions();
		return {
			query: { type: query.type ?? "screen", section: query.section, job: query.job },
			page: 1,
			pageSize,
			total: 0,
			pageCount: 1,
			items: [],
			vocabulary,
			noFit: true,
			code: "catalog_facet_unknown",
			clarification: `Unknown catalog facet ${facet}=${value}. Use only the pinned Stock vocabulary.`,
			suggested,
			misplaced: swap ? { used: facet, value, tryFacet: swap.tryFacet } : undefined
		};
	}

	const items = filterScreens(query).slice().sort(compareScreenSupport);
	const total = items.length;
	const pageCount = total === 0 ? 1 : Math.ceil(total / pageSize);
	let page = query.page ?? 1;
	if (page < 1) page = 1;
	if (page > pageCount) page = pageCount;
	const start = (page - 1) * pageSize;
	const slice = items.slice(start, start + pageSize);
	const noFit = total === 0;
	return {
		query: { type: query.type ?? "screen", section: query.section, job: query.job },
		page,
		pageSize,
		total,
		pageCount,
		items: slice.map((screen) => ({
			...screen,
			compatibility: compatibilityFor(screen)
		})),
		vocabulary,
		noFit,
		clarification: noFit
			? "No Stock screens match that filter. Re-search with a bounded section or job from the vocabulary, or attach a scenario."
			: undefined,
		suggested: noFit ? ownerSuggestions() : undefined
	};
}

/** Alias used by the constructor tool path. Same Stock snapshot, never a synthetic fixture. */
export function paginateScreens(query: SearchQuery = {}): SearchResult {
	return searchCatalog(query);
}

export function getScreenById(screenId: string): CatalogScreen | null {
	return catalogSnapshot.screens.find((s) => s.screenId === screenId) ?? null;
}

export function catalogToolParameterSchema(): {
	section: { type: "string"; enum: string[] };
	job: { type: "string"; enum: string[] };
	page: { type: "integer"; minimum: number };
} {
	const vocab = facetVocabulary();
	return {
		section: { type: "string", enum: [...vocab.section] },
		job: { type: "string", enum: [...vocab.job] },
		page: { type: "integer", minimum: 1 }
	};
}

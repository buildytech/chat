import { catalogSnapshot } from "./snapshot.ts";
import type { CatalogFacetFilter, CatalogScreen, SearchQuery, SearchResult } from "./types.ts";
import { compatibilityFor } from "./compatibility.ts";

export const DEFAULT_PAGE_SIZE = catalogSnapshot.pageSize;

export function assertFacetValue(facet: "section" | "job" | "type", value: string): void {
	const allowed = catalogSnapshot.facetVocabulary[facet];
	if (!allowed.includes(value)) {
		throw Object.assign(new Error(`Unknown catalog facet ${facet}=${value}`), {
			code: "catalog_facet_unknown",
			facet,
			value
		});
	}
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

export function paginateScreens(query: SearchQuery = {}): SearchResult {
	const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
	const items = filterScreens(query);
	const total = items.length;
	const pageCount = total === 0 ? 1 : Math.ceil(total / pageSize);
	let page = query.page ?? 1;
	if (page < 1) page = 1;
	if (page > pageCount) page = pageCount;
	const start = (page - 1) * pageSize;
	const slice = items.slice(start, start + pageSize);
	return {
		query: { type: query.type ?? "screen", section: query.section, job: query.job },
		page,
		pageSize,
		total,
		pageCount,
		items: slice.map((screen) => ({
			...screen,
			compatibility: compatibilityFor(screen)
		}))
	};
}

export function getScreenById(screenId: string): CatalogScreen | null {
	return catalogSnapshot.screens.find((s) => s.screenId === screenId) ?? null;
}

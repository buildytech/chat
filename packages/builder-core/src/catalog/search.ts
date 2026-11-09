import { catalogSnapshot } from "./snapshot.ts";
import type { CatalogFacetFilter, CatalogScreen, SearchQuery, SearchResult } from "./types.ts";
import { compareScreenSupport, compatibilityFor, screenSupport } from "./compatibility.ts";
import { OWNER_FILTERS } from "../copy.ts";
import { blockLabelVocabulary, nearestTerms, scoreScreens, vocabularyValues } from "./text-search.ts";

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
		if (query.industry && !screen.labels.industry.includes(query.industry)) return false;
		if (query.blocks?.length && !query.blocks.every((label) => screen.labels.blocks.includes(label))) return false;
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

	const unknownBlocks = (query.blocks ?? []).filter((label) => !blockLabelVocabulary().includes(label));
	const unknownIndustry = query.industry && !vocabularyValues("industry").includes(query.industry) ? [query.industry] : [];
	if (unknownBlocks.length || unknownIndustry.length) {
		const facet = unknownBlocks.length ? "blocks" : "industry";
		const value = unknownBlocks[0] ?? unknownIndustry[0]!;
		return {
			query: { type: query.type ?? "screen", section: query.section, job: query.job, industry: query.industry, blocks: query.blocks, q: query.q },
			page: 1,
			pageSize,
			total: 0,
			pageCount: 1,
			items: [],
			vocabulary,
			noFit: true,
			code: "catalog_facet_unknown",
			clarification: `Unknown catalog ${facet} value ${value}. Use values from the catalog vocabulary.`,
			nearest: nearestTerms([value.toLowerCase()])
		};
	}

	type Hit = CatalogScreen & { score?: number; matched?: string[]; via?: string; missingBlocks?: string[] };
	// blocks is a soft facet: rank by how many requested block labels a screen has (all first),
	// and say which are missing, so an over-specified list still returns the closest screens.
	const wanted = query.blocks ?? [];
	const base = filterScreens({ ...query, blocks: undefined });
	const coverage = (screen: CatalogScreen) => wanted.filter((label) => screen.labels.blocks.includes(label)).length;
	let items: Hit[] = (wanted.length ? base.filter((screen) => coverage(screen) > 0) : base)
		.map((screen) => {
			const missingBlocks = wanted.filter((label) => !screen.labels.blocks.includes(label));
			return missingBlocks.length ? { ...screen, missingBlocks } : screen;
		})
		.sort((a, b) => coverage(b) - coverage(a) || compareScreenSupport(a, b));
	let nearest: Record<string, string[]> | undefined;
	if (query.q?.trim()) {
		const text = scoreScreens(query.q);
		items = items
			.filter((screen) => text.scores.has(screen.screenId))
			.map((screen) => ({ ...screen, score: text.scores.get(screen.screenId)!.score, matched: text.scores.get(screen.screenId)!.matched }))
			.sort((a, b) => coverage(b) - coverage(a) || (b.score ?? 0) - (a.score ?? 0) || compareScreenSupport(a, b));
		if (text.unmatched.length) nearest = nearestTerms(text.unmatched);
	}
	let unrenderable: SearchResult["unrenderable"];
	if (query.supportedOnly) {
		const unsupported = items.filter((screen) => !screenSupport(screen).supported);
		const supported = items.filter((screen) => screenSupport(screen).supported);
		// A matching screen we cannot render points at renderable screens of the same Stock family.
		for (const miss of unsupported) {
			for (const sibling of catalogSnapshot.screens) {
				if (sibling.spec !== miss.spec || sibling.screenId === miss.screenId) continue;
				if (!screenSupport(sibling).supported || supported.some((s) => s.screenId === sibling.screenId)) continue;
				if (!base.some((s) => s.screenId === sibling.screenId)) continue;
				const missingBlocks = wanted.filter((label) => !sibling.labels.blocks.includes(label));
				supported.push({
					...sibling,
					score: (miss.score ?? 0) * 0.8,
					matched: miss.matched,
					via: miss.screenId,
					...(missingBlocks.length ? { missingBlocks } : {})
				});
			}
		}
		supported.sort((a, b) => coverage(b) - coverage(a) || (b.score ?? 0) - (a.score ?? 0) || compareScreenSupport(a, b));
		unrenderable = unsupported.slice(0, 4).map((screen) => ({ screenId: screen.screenId, missing: screenSupport(screen).missing }));
		items = supported;
	}
	const total = items.length;
	const pageCount = total === 0 ? 1 : Math.ceil(total / pageSize);
	let page = query.page ?? 1;
	if (page < 1) page = 1;
	if (page > pageCount) page = pageCount;
	const start = (page - 1) * pageSize;
	const slice = items.slice(start, start + pageSize);
	const noFit = total === 0;
	return {
		query: { type: query.type ?? "screen", section: query.section, job: query.job, industry: query.industry, blocks: query.blocks, q: query.q },
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
		...(unrenderable?.length ? { unrenderable } : {}),
		...(nearest || noFit ? { nearest: nearest ?? (query.q ? nearestTerms(scoreScreens(query.q).tokens) : undefined) } : {}),
		clarification: noFit
			? query.supportedOnly
				? "No renderer-supported Stock screens match that filter. Attach a different scenario or a supported screen."
				: "No Stock screens match that filter. Re-search with a bounded section or job from the vocabulary, or attach a scenario."
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

export function catalogToolParameterSchema(): Record<string, unknown> {
	const vocab = facetVocabulary();
	return {
		q: {
			type: "string",
			description:
				"Free text in catalog terms (English catalog words work best, e.g. sidebar, shell, kanban, pricing). Matched against Stock titles, subtitles, block names and facet labels."
		},
		section: { type: "string", enum: [...vocab.section] },
		job: { type: "string", enum: [...vocab.job] },
		industry: { type: "string", enum: vocabularyValues("industry") },
		blocks: {
			type: "array",
			items: { type: "string", enum: blockLabelVocabulary() },
			description: "Block labels every screen must contain, e.g. [\"sidenav\"] for a built-in sidebar."
		},
		page: { type: "integer", minimum: 1 }
	};
}

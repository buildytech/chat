/**
 * One Stock search for every surface (ADR 0024): the home Stock screens field, the Build Blocks feed, and later a
 * REST / MCP / CLI endpoint call this function with the same query and get the same `stock-search/v1` result. Pure
 * and JSON in, JSON out: no DOM, no Svelte, no network; the pinned catalog snapshot is the only data.
 *
 * Items are Stock screens and Stock block variants. Filters: free text (q), type, role (the page kind a block renders
 * as, or the kinds a screen contains), spec (block spec or screen family), site, variant (of the chosen spec), plus an
 * optional scope (an owner filter such as site=landing) that narrows screens. Facet counts follow the usual rule:
 * each facet is counted with every other filter applied and its own left out, so any value with count > 0 is a valid
 * next refinement.
 */
import { catalogSnapshot } from "./snapshot.ts";
import { blockAssetUrl, blockThumbUrl, screenThumbUrl, stockAssetUrl } from "./provenance.ts";
import { screenStartable } from "../assemble.ts";
import { getScreenById, searchCatalog } from "./search.ts";
import { catalogSourceFor } from "./sources.ts";
import type { CatalogBlockIndexEntry, CatalogFacetFilter, CatalogScreen } from "./types.ts";

export const STOCK_SEARCH_FORMAT = "stock-search/v1";
export const STOCK_SEARCH_PAGE_SIZE = 8;
export const STOCK_SEARCH_MAX_PAGE_SIZE = 48;

export type StockSearchType = "screen" | "block";
export type StockSearchFacet = "type" | "role" | "spec" | "site" | "variant";
export const STOCK_SEARCH_FACETS: readonly StockSearchFacet[] = ["type", "role", "spec", "site", "variant"];

export type StockSearchQuery = {
	/** Free text: words of titles, ids, labels (screens also match catalog synonyms). */
	q?: string | null;
	type?: StockSearchType | null;
	/** Page kind: a block that renders as it, a screen that contains it (hero, features, nav, ...). */
	role?: string | null;
	/** Block spec (block.hero) or screen family (screen.site). */
	spec?: string | null;
	site?: string | null;
	/** A variant of `spec` (ignored without spec). */
	variant?: string | null;
	/** Owner filter that narrows screens (site / section / job), e.g. a picked scenario. */
	scope?: Pick<CatalogFacetFilter, "site" | "section" | "job"> | null;
	page?: number | null;
	pageSize?: number | null;
};

export type StockSearchItem = {
	type: StockSearchType;
	/** screenId, or `<spec>/<variant>` for a block variant. */
	id: string;
	spec: string;
	variant: string;
	title: string;
	subtitle: string;
	/** Block: the page kind it renders as (null: no page renderer). Screen: null. */
	role: string | null;
	/** Screen: the page kinds it contains. Block: [role] or []. */
	roles: string[];
	sites: string[];
	/** The block's catalog default variant. */
	isDefault: boolean;
	/**
	 * Whether this BuildY renders it: a block variant with a page renderer, a screen the program can start a page
	 * from (no model call). Unsupported items still list, for browsing and the asset page.
	 */
	supported: boolean;
	/** Absolute WebP thumbnail URL, or null when Stock has none. */
	thumb: string | null;
	/** The codegen-x Stock asset page. */
	url: string;
};

export type StockSearchResult = {
	format: typeof STOCK_SEARCH_FORMAT;
	query: {
		q: string;
		type: StockSearchType | null;
		role: string | null;
		spec: string | null;
		site: string | null;
		variant: string | null;
		scope: Pick<CatalogFacetFilter, "site" | "section" | "job"> | null;
	};
	page: number;
	pageSize: number;
	pageCount: number;
	total: number;
	items: StockSearchItem[];
	facets: Record<StockSearchFacet, Array<{ value: string; count: number }>>;
	catalog: { digest: string; commit: string };
};

type Row = StockSearchItem & { text: string; score: number };

const lower = (value: string) => value.toLowerCase();
const words = (q: string) => lower(q).split(/\s+/).filter(Boolean);

/** Block label (blockId) of a screen slot -> its index entry. */
function entryByLabel(): Map<string, CatalogBlockIndexEntry> {
	return new Map(catalogSnapshot.blockIndex.map((entry) => [entry.blockId, entry]));
}

let blockRowsCache: Row[] | null = null;

/** Every Stock block variant as a row; sites = the sites of the screens whose layout uses the block. */
function blockRows(): Row[] {
	if (blockRowsCache) return blockRowsCache;
	const byLabel = entryByLabel();
	const sites = new Map<string, Set<string>>();
	for (const screen of catalogSnapshot.screens) {
		for (const slot of screen.layout ?? []) {
			const entry = byLabel.get(slot.block);
			if (!entry) continue;
			const set = sites.get(entry.spec) ?? new Set<string>();
			for (const site of screen.labels.site) set.add(site);
			sites.set(entry.spec, set);
		}
	}
	const rows: Row[] = [];
	for (const entry of catalogSnapshot.blockIndex) {
		if (!entry.available) continue;
		const role = entry.rendererCompatible && entry.rendererKind ? entry.rendererKind : null;
		const fallback = catalogSourceFor(entry.spec)?.defaultVariant ?? entry.variants[0];
		const blockSites = [...(sites.get(entry.spec) ?? [])].sort();
		for (const variant of entry.variants) {
			rows.push({
				type: "block",
				id: `${entry.spec}/${variant}`,
				spec: entry.spec,
				variant,
				title: entry.title,
				subtitle: variant,
				role,
				roles: role ? [role] : [],
				sites: blockSites,
				isDefault: variant === fallback,
				supported: role !== null,
				thumb: blockThumbUrl(entry.spec, variant),
				url: blockAssetUrl(entry.spec, variant) ?? stockAssetUrl(`${entry.spec}/${variant}`),
				text: lower(`${entry.spec} ${entry.blockId} ${entry.title} ${variant} ${role ?? ""} ${(entry.jobs ?? []).join(" ")} ${blockSites.join(" ")}`),
				score: 0
			});
		}
	}
	// Blocks with a page section renderer (they can be added to a page) first, each group in catalog order.
	rows.sort((a, b) => Number(!a.role) - Number(!b.role));
	blockRowsCache = rows;
	return rows;
}

function screenRow(screen: CatalogScreen, byLabel: Map<string, CatalogBlockIndexEntry>): Row {
	const roles = [
		...new Set(
			(screen.layout ?? [])
				.map((slot) => byLabel.get(slot.block))
				.map((entry) => (entry?.rendererCompatible && entry.rendererKind ? entry.rendererKind : null))
				.filter((kind): kind is string => Boolean(kind))
		)
	].sort();
	return {
		type: "screen",
		id: screen.screenId,
		spec: screen.spec,
		variant: screen.variant,
		title: screen.title,
		subtitle: screen.subtitle,
		role: null,
		roles,
		sites: [...screen.labels.site],
		isDefault: false,
		supported: screenStartable(screen),
		thumb: screenThumbUrl(screen.screenId),
		url: stockAssetUrl(screen.screenId),
		text: lower(`${screen.screenId} ${screen.title} ${screen.subtitle} ${screen.labels.blocks.join(" ")} ${screen.labels.job.join(" ")}`),
		score: 0
	};
}

/**
 * Screens in scope matching q: the catalog text index first (titles, labels, facet values in the catalog's locales
 * and synonyms, scored), then plain substring hits on id, title and labels; with no q, the catalog order.
 */
function screenRows(q: string, scope: StockSearchQuery["scope"]): Row[] {
	const byLabel = entryByLabel();
	const filter = { ...(scope ?? {}), type: "screen" as const };
	const scoped = searchCatalog({ ...filter, page: 1, pageSize: 1000 }).items.map((hit) => getScreenById(hit.screenId)!);
	if (!q) return scoped.map((screen) => screenRow(screen, byLabel));
	const scored = searchCatalog({ ...filter, q, page: 1, pageSize: 1000 }).items.map((hit) => getScreenById(hit.screenId)!);
	const seen = new Set(scored.map((screen) => screen.screenId));
	const needle = lower(q);
	const rows = scored.map((screen) => screenRow(screen, byLabel));
	for (const screen of scoped) {
		if (seen.has(screen.screenId)) continue;
		const row = screenRow(screen, byLabel);
		if (row.text.includes(needle)) rows.push(row);
	}
	return rows;
}

/** Blocks matching every word of q, the ones that hit the title, spec or role first (catalog order otherwise). */
function blockMatches(q: string): Row[] {
	const rows = blockRows();
	const tokens = words(q);
	if (!tokens.length) return rows;
	const out: Row[] = [];
	for (const row of rows) {
		if (!tokens.every((token) => row.text.includes(token))) continue;
		const head = lower(`${row.spec} ${row.title} ${row.role ?? ""}`);
		out.push({ ...row, score: tokens.filter((token) => head.includes(token)).length });
	}
	return out.sort((a, b) => b.score - a.score);
}

function valuesOf(row: Row, facet: StockSearchFacet): string[] {
	switch (facet) {
		case "type":
			return [row.type];
		case "role":
			return row.roles;
		case "spec":
			return [row.spec];
		case "site":
			return row.sites;
		case "variant":
			return [row.variant];
	}
}

const clean = (value: string | null | undefined): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

export function stockSearch(input: StockSearchQuery = {}): StockSearchResult {
	const q = (input.q ?? "").trim();
	const type = input.type === "screen" || input.type === "block" ? input.type : null;
	const spec = clean(input.spec);
	const query: StockSearchResult["query"] = {
		q,
		type,
		role: clean(input.role),
		spec,
		site: clean(input.site),
		variant: spec ? clean(input.variant) : null,
		scope: input.scope && Object.keys(input.scope).length ? { ...input.scope } : null
	};
	const active: Partial<Record<StockSearchFacet, string>> = {};
	if (query.type) active.type = query.type;
	if (query.role) active.role = query.role;
	if (query.spec) active.spec = query.spec;
	if (query.site) active.site = query.site;
	if (query.variant) active.variant = query.variant;

	// Blocks first: the Build feed is about blocks; type=screen gives the home Stock list alone.
	const pool: Row[] = [...blockMatches(q), ...screenRows(q, query.scope)];
	const passes = (row: Row, except: StockSearchFacet | null) =>
		STOCK_SEARCH_FACETS.every((facet) => facet === except || !active[facet] || valuesOf(row, facet).includes(active[facet]!));

	const facets = {} as StockSearchResult["facets"];
	for (const facet of STOCK_SEARCH_FACETS) {
		if (facet === "variant" && !query.spec) {
			facets.variant = [];
			continue;
		}
		const counts = new Map<string, number>();
		for (const row of pool) {
			if (!passes(row, facet)) continue;
			for (const value of valuesOf(row, facet)) counts.set(value, (counts.get(value) ?? 0) + 1);
		}
		if (active[facet] && !counts.has(active[facet]!)) counts.set(active[facet]!, 0);
		const list = [...counts.entries()].map(([value, count]) => ({ value, count }));
		// spec and variant keep the catalog order; the others go by count.
		facets[facet] = facet === "spec" || facet === "variant" ? list : list.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
	}

	const matched = pool.filter((row) => passes(row, null));
	const size = Math.round(input.pageSize ?? STOCK_SEARCH_PAGE_SIZE);
	const pageSize = Number.isFinite(size) ? Math.min(Math.max(size, 1), STOCK_SEARCH_MAX_PAGE_SIZE) : STOCK_SEARCH_PAGE_SIZE;
	const total = matched.length;
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const wanted = Math.round(input.page ?? 1);
	const page = Math.min(Math.max(Number.isFinite(wanted) ? wanted : 1, 1), pageCount);
	const items = matched.slice((page - 1) * pageSize, page * pageSize).map(({ text: _text, score: _score, ...item }) => item);
	return {
		format: STOCK_SEARCH_FORMAT,
		query,
		page,
		pageSize,
		pageCount,
		total,
		items,
		facets,
		catalog: { digest: catalogSnapshot.sourceDigest, commit: catalogSnapshot.pinnedCommit }
	};
}

export type CatalogFacetFilter = {
	type?: "screen" | "block";
	/** Site type facet value (landing, website, app, ...) from the catalog vocabulary. */
	site?: string;
	section?: string;
	job?: string;
	/** Industry facet value from the catalog vocabulary. */
	industry?: string;
	/** Block labels every hit must contain (catalog vocabulary, e.g. sidenav). */
	blocks?: string[];
	/** Free text, matched against the catalog-generated search index. */
	q?: string;
};

export type CatalogScreen = {
	screenId: string;
	sourceOrdinal: number;
	title: string;
	subtitle: string;
	spec: string;
	variant: string;
	group: string;
	order: number;
	preview: unknown;
	/** Stock thumbnail relative to the Stock app (thumbs/<id>.webp?v=<sha8>), when Stock has one (stockThumbUrl). */
	thumb?: string;
	labels: {
		type: string[];
		site: string[];
		section: string[];
		job: string[];
		blocks: string[];
		industry: string[];
	};
	added?: string;
	missingFacets?: string[];
	/** The screen's composition (ADR 0012 screen-contains-block): each Stock block once, in order, with its variant and region. */
	layout?: CatalogScreenSlot[];
};

/** One Stock block of a screen: `before` / `after` are the frame (header, footer), `area` is the body. */
export type CatalogScreenSlot = { block: string; variant: string; region: "before" | "area" | "after" };

export type CatalogBlockIndexEntry = {
	blockId: string;
	spec: string;
	catalogIds: string[];
	variants: string[];
	/** Stock thumbnails by variant, relative to the Stock app (stockThumbUrl); a variant without a picture is absent. */
	thumbs?: Record<string, string>;
	title: string;
	available: boolean;
	rendererKind: string | null;
	rendererCompatible: boolean;
	/** Job facet values of the block's variants (Stock tags). */
	jobs?: string[];
};

export type CatalogSnapshot = {
	format: string;
	schemaVersion: number;
	provider: string;
	repo: string;
	pinnedCommit: string;
	sourceArtifact: string;
	sourceDigest: string;
	sourceVersion: string;
	counts: { screen: number; upstreamBlock?: number; upstreamScreen?: number };
	pageSize: number;
	facetVocabulary: { type: string[]; site: string[]; section: string[]; job: string[] };
	ownerFilters: Record<string, CatalogFacetFilter>;
	rendererKinds: string[];
	rendererMap: Record<string, string>;
	screens: CatalogScreen[];
	blockIndex: CatalogBlockIndexEntry[];
};

export type ScreenCompatibility = {
	screenId: string;
	compatible: boolean;
	partial: boolean;
	mapped: Array<{ catalogLabel: string; rendererKind: string; catalogIds: string[] }>;
	missing: Array<{ catalogLabel: string; catalogIds: string[]; reason: string }>;
};

export type SearchQuery = CatalogFacetFilter & { page?: number; pageSize?: number; supportedOnly?: boolean };

export type SearchResult = {
	query: CatalogFacetFilter;
	page: number;
	pageSize: number;
	total: number;
	pageCount: number;
	items: Array<CatalogScreen & { compatibility: ScreenCompatibility; score?: number; matched?: string[]; via?: string; missingBlocks?: string[] }>;
	vocabulary: { type: string[]; site: string[]; section: string[]; job: string[] };
	noFit: boolean;
	code?: "catalog_facet_unknown";
	/** Unsupported Stock screens that matched (exist in Stock, not renderable here). */
	unrenderable?: Array<{ screenId: string; missing: string[] }>;
	/** Query tokens that matched no catalog term, with the nearest catalog terms. */
	nearest?: Record<string, string[]>;
	clarification?: string;
	suggested?: Array<{ site?: string; section?: string; job?: string; reason: string }>;
	misplaced?: { used: "site" | "section" | "job"; value: string; tryFacet: "section" | "job" };
};

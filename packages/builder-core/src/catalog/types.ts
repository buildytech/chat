export type CatalogFacetFilter = {
	type?: "screen" | "block";
	section?: string;
	job?: string;
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
	labels: {
		type: string[];
		section: string[];
		job: string[];
		blocks: string[];
		industry: string[];
	};
	added?: string;
	missingFacets?: string[];
};

export type CatalogBlockIndexEntry = {
	blockId: string;
	spec: string;
	catalogIds: string[];
	variants: string[];
	title: string;
	available: boolean;
	rendererKind: string | null;
	rendererCompatible: boolean;
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
	facetVocabulary: { type: string[]; section: string[]; job: string[] };
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

export type SearchQuery = CatalogFacetFilter & { page?: number; pageSize?: number };

export type SearchResult = {
	query: CatalogFacetFilter;
	page: number;
	pageSize: number;
	total: number;
	pageCount: number;
	items: Array<CatalogScreen & { compatibility: ScreenCompatibility }>;
	vocabulary: { type: string[]; section: string[]; job: string[] };
	noFit: boolean;
	code?: "catalog_facet_unknown";
	clarification?: string;
	suggested?: Array<{ section?: string; job?: string; reason: string }>;
	misplaced?: { used: "section" | "job"; value: string; tryFacet: "section" | "job" };
};

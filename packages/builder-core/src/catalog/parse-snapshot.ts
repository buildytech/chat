import type {
	CatalogBlockIndexEntry,
	CatalogFacetFilter,
	CatalogScreen,
	CatalogSnapshot
} from "./types.ts";

export function catalogSnapshotInvalid(message: string): Error {
	return Object.assign(new Error(message), { code: "catalog_snapshot_invalid" });
}

function fail(path: string, message: string): never {
	throw catalogSnapshotInvalid(`${path}: ${message}`);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "must be an object");
	return value as Record<string, unknown>;
}

function asString(value: unknown, path: string): string {
	if (typeof value !== "string") fail(path, "must be a string");
	return value;
}

function asFiniteNumber(value: unknown, path: string): number {
	if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "must be a finite number");
	return value;
}

function asBoolean(value: unknown, path: string): boolean {
	if (typeof value !== "boolean") fail(path, "must be a boolean");
	return value;
}

function asStringArray(value: unknown, path: string): string[] {
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		fail(path, "must be an array of strings");
	}
	return value;
}

function asFacetType(value: unknown, path: string): "screen" | "block" | undefined {
	if (value === undefined) return undefined;
	if (value === "screen" || value === "block") return value;
	fail(path, 'must be "screen" or "block"');
}

function parseOwnerFilter(value: unknown, path: string): CatalogFacetFilter {
	const rec = asRecord(value, path);
	const filter: CatalogFacetFilter = {};
	const type = asFacetType(rec.type, `${path}.type`);
	if (type) filter.type = type;
	if (rec.section !== undefined) filter.section = asString(rec.section, `${path}.section`);
	if (rec.job !== undefined) filter.job = asString(rec.job, `${path}.job`);
	return filter;
}

function parseOwnerFilters(value: unknown, path: string): Record<string, CatalogFacetFilter> {
	const rec = asRecord(value, path);
	const out: Record<string, CatalogFacetFilter> = {};
	for (const [key, filter] of Object.entries(rec)) {
		if (!key) fail(path, "filter name must be non-empty");
		out[key] = parseOwnerFilter(filter, `${path}.${key}`);
	}
	return out;
}

function parseLabels(value: unknown, path: string): CatalogScreen["labels"] {
	const rec = asRecord(value, path);
	return {
		type: asStringArray(rec.type, `${path}.type`),
		section: asStringArray(rec.section, `${path}.section`),
		job: asStringArray(rec.job, `${path}.job`),
		blocks: asStringArray(rec.blocks, `${path}.blocks`),
		industry: asStringArray(rec.industry, `${path}.industry`)
	};
}

function parseScreen(value: unknown, path: string): CatalogScreen {
	const rec = asRecord(value, path);
	const screen: CatalogScreen = {
		screenId: asString(rec.screenId, `${path}.screenId`),
		sourceOrdinal: asFiniteNumber(rec.sourceOrdinal, `${path}.sourceOrdinal`),
		title: asString(rec.title, `${path}.title`),
		subtitle: asString(rec.subtitle, `${path}.subtitle`),
		spec: asString(rec.spec, `${path}.spec`),
		variant: asString(rec.variant, `${path}.variant`),
		group: asString(rec.group, `${path}.group`),
		order: asFiniteNumber(rec.order, `${path}.order`),
		preview: rec.preview,
		labels: parseLabels(rec.labels, `${path}.labels`)
	};
	if (rec.added !== undefined) screen.added = asString(rec.added, `${path}.added`);
	if (rec.missingFacets !== undefined) {
		screen.missingFacets = asStringArray(rec.missingFacets, `${path}.missingFacets`);
	}
	return screen;
}

function parseBlockIndexEntry(value: unknown, path: string): CatalogBlockIndexEntry {
	const rec = asRecord(value, path);
	let rendererKind: string | null = null;
	if (rec.rendererKind !== null && rec.rendererKind !== undefined) {
		rendererKind = asString(rec.rendererKind, `${path}.rendererKind`);
	}
	return {
		blockId: asString(rec.blockId, `${path}.blockId`),
		spec: asString(rec.spec, `${path}.spec`),
		catalogIds: asStringArray(rec.catalogIds, `${path}.catalogIds`),
		variants: asStringArray(rec.variants, `${path}.variants`),
		title: asString(rec.title, `${path}.title`),
		available: asBoolean(rec.available, `${path}.available`),
		rendererKind,
		rendererCompatible: asBoolean(rec.rendererCompatible, `${path}.rendererCompatible`)
	};
}

function parseCounts(value: unknown, path: string): CatalogSnapshot["counts"] {
	const rec = asRecord(value, path);
	const counts: CatalogSnapshot["counts"] = {
		screen: asFiniteNumber(rec.screen, `${path}.screen`)
	};
	if (rec.upstreamBlock !== undefined) {
		counts.upstreamBlock = asFiniteNumber(rec.upstreamBlock, `${path}.upstreamBlock`);
	}
	if (rec.upstreamScreen !== undefined) {
		counts.upstreamScreen = asFiniteNumber(rec.upstreamScreen, `${path}.upstreamScreen`);
	}
	return counts;
}

function parseVocabulary(value: unknown, path: string): CatalogSnapshot["facetVocabulary"] {
	const rec = asRecord(value, path);
	return {
		type: asStringArray(rec.type, `${path}.type`),
		section: asStringArray(rec.section, `${path}.section`),
		job: asStringArray(rec.job, `${path}.job`)
	};
}

function parseRendererMap(value: unknown, path: string): Record<string, string> {
	const rec = asRecord(value, path);
	const out: Record<string, string> = {};
	for (const [key, mapped] of Object.entries(rec)) {
		out[key] = asString(mapped, `${path}.${key}`);
	}
	return out;
}

/** Narrow JSON (where literals widen to string) into the catalog contract. Throws catalog_snapshot_invalid. */
export function parseCatalogSnapshot(value: unknown): CatalogSnapshot {
	const rec = asRecord(value, "$");
	if (!Array.isArray(rec.screens)) fail("$.screens", "must be an array");
	if (!Array.isArray(rec.blockIndex)) fail("$.blockIndex", "must be an array");
	const screens = rec.screens.map((screen, i) => parseScreen(screen, `$.screens[${i}]`));
	const counts = parseCounts(rec.counts, "$.counts");
	if (counts.screen !== screens.length) {
		fail("$.counts.screen", `must equal screens.length (${screens.length})`);
	}
	return {
		format: asString(rec.format, "$.format"),
		schemaVersion: asFiniteNumber(rec.schemaVersion, "$.schemaVersion"),
		provider: asString(rec.provider, "$.provider"),
		repo: asString(rec.repo, "$.repo"),
		pinnedCommit: asString(rec.pinnedCommit, "$.pinnedCommit"),
		sourceArtifact: asString(rec.sourceArtifact, "$.sourceArtifact"),
		sourceDigest: asString(rec.sourceDigest, "$.sourceDigest"),
		sourceVersion: asString(rec.sourceVersion, "$.sourceVersion"),
		counts,
		pageSize: asFiniteNumber(rec.pageSize, "$.pageSize"),
		facetVocabulary: parseVocabulary(rec.facetVocabulary, "$.facetVocabulary"),
		ownerFilters: parseOwnerFilters(rec.ownerFilters, "$.ownerFilters"),
		rendererKinds: asStringArray(rec.rendererKinds, "$.rendererKinds"),
		rendererMap: parseRendererMap(rec.rendererMap, "$.rendererMap"),
		screens,
		blockIndex: rec.blockIndex.map((entry, i) => parseBlockIndexEntry(entry, `$.blockIndex[${i}]`))
	};
}

/**
 * Unified catalog snapshot (.project/adr/0012-unified-catalog-snapshot.md): pure functions, no I/O.
 *
 *   buildGraph(inputs, policy, pins)  the pinned codegen-x Stock files + registry.buildy.tw files -> stock-registry.v0.json
 *   validateGraph(graph, propsDoc)    every edge resolves, every variant preset passes its props schema (Ajv 2020 strict)
 *   coverage(graph, policy)           computed coverage report (catalog/coverage.json)
 *   deriveSnapshot(graph, policy)     packages/builder-core/src/catalog/snapshot.json (the runtime's screen catalog)
 *   deriveSearchIndex(graph, policy)  packages/builder-core/src/catalog/search-index.json
 *   serialize(value)                  deterministic, ASCII-only JSON (one entity or edge per line)
 *
 * The graph is the only input of every derived artifact, so Lab, WP and the chat read the same data.
 */
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";

export const FORMAT = "buildy-stock-registry";
export const ENTITY_TYPES = ["locale", "facet", "facetValue", "screenFamily", "screen", "block", "variant", "item", "props", "record", "icon", "collection"];
export const EDGE_TYPES = {
	"facet-has-value": ["facet", "facetValue"],
	"screen-in-family": ["screen", "screenFamily"],
	"screen-contains-block": ["screen", "block"],
	"screen-installs-item": ["screen", "item"],
	"screen-tagged-facet": ["screen", "facetValue"],
	"block-has-variant": ["block", "variant"],
	"block-implemented-by-item": ["block", "item"],
	"block-binds-collection": ["block", "collection"],
	"variant-tagged-facet": ["variant", "facetValue"],
	"variant-implemented-by-item": ["variant", "item"],
	"variant-sets-props": ["variant", "props"],
	"item-depends-on-item": ["item", "item"],
	"item-has-props": ["item", "props"],
	"props-uses-record": ["props", "record"]
};
/** $defs of the props contract that are reference shapes or scalars, not records (props-schema.ts reads the same names). */
const SHAPE_DEFS = new Set(["text", "uiRef", "data", "dataRef", "dataOp", "lucideIcon"]);
const ICON_DEF = "lucideIcon";

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Keys of an object in a fixed order; missing keys are dropped, undefined values too. */
function pick(source, keys) {
	const out = {};
	for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
	return out;
}

const valueId = (facet, value) => `${facet}/${value}`;

/** Inputs: { stock: { "<file>": parsed JSON }, registry: { "<file>": parsed JSON } } keyed by the config file names. */
export function buildGraph(inputs, pins) {
	const S = inputs.stock;
	const R = inputs.registry;
	const assets = S["assets.v0.json"];
	const facetsDoc = S["facets.v0.json"];
	const previews = S["previews.v0.json"];
	const install = S["install.v0.json"];
	const added = S["added.v0.json"];
	const patternMap = S["pattern-map.v0.json"];
	const patternTerms = S["terms/pattern.v0.json"];
	const locales = S["i18n/locales.json"];
	const variantsDoc = R["variants/v0.json"];
	const propsDoc = R["props/v0.json"];
	const index = R["svelte/index.json"];
	const registryDoc = R["registry.json"];

	const entities = Object.fromEntries(ENTITY_TYPES.map((type) => [type, {}]));
	const edges = Object.fromEntries(Object.keys(EDGE_TYPES).map((type) => [type, []]));
	const edge = (type, from, to, attrs = {}) => edges[type].push({ from, to, ...attrs });

	for (const locale of locales.locales) entities.locale[locale.id] = { label: locale.label, default: locale.id === locales.default };

	// Facets: the vocabulary of facets.v0.json (every facet, also the ones Stock hides), with the values Stock resolved
	// for facets whose values come from elsewhere (valuesFrom: terms, blocks, axis). Hidden facets / values keep a reason.
	const resolved = new Map(assets.facets.map((facet) => [facet.id, facet]));
	const hiddenFacet = new Map(assets.hidden.facets.map((h) => [h.facet, h.reason]));
	const hiddenValue = new Set(assets.hidden.values.map((h) => valueId(h.facet, h.value)));
	const terms = new Map(patternTerms.terms.map((term) => [term.id, term]));
	for (const facet of facetsDoc.facets) {
		entities.facet[facet.id] = {
			...pick(facet, ["label", "ui", "scope", "types", "source", "derive", "valuesFrom", "mode", "wildcard", "draft", "draftNote", "open", "visible", "order"]),
			...(hiddenFacet.has(facet.id) ? { hidden: hiddenFacet.get(facet.id) } : {})
		};
		const values = facet.values?.length ? facet.values : (resolved.get(facet.id)?.values ?? []);
		let order = 0;
		const seen = new Set();
		const addValue = (value, extra = {}) => {
			const id = valueId(facet.id, value.id);
			if (seen.has(id)) return;
			seen.add(id);
			entities.facetValue[id] = {
				facet: facet.id,
				value: value.id,
				...pick(value, ["label", "synonyms"]),
				...extra,
				...(hiddenValue.has(id) ? { hidden: true } : {})
			};
			edge("facet-has-value", facet.id, id, { order: order++ });
		};
		for (const value of values) {
			const term = facet.valuesFrom === "terms:pattern" ? terms.get(value.id) : undefined;
			addValue(term ? { ...value, label: term.label } : value, term ? pick(term, ["definition", "status", "provenance"]) : {});
		}
		// Terms Stock does not show (no asset carries them) are still part of the vocabulary.
		if (facet.valuesFrom === "terms:pattern") for (const term of patternTerms.terms) addValue(term, { ...pick(term, ["definition", "status", "provenance"]), hidden: true });
	}

	// Screen families: the screen compositions of previews.v0.json (chrome before and after, one block list per area).
	for (const [id, family] of Object.entries(previews.screens)) {
		entities.screenFamily[id] = { name: family.name, areas: Object.keys(family.areas) };
	}

	// Blocks (Stock block specs) from previews.v0.json, in the order of their first asset.
	const blockAssets = assets.assets.filter((asset) => asset.type === "block");
	const specOrder = [...new Set(blockAssets.map((asset) => asset.spec))];
	const variantItem = new Map();
	for (const [name, item] of Object.entries(variantsDoc.items)) {
		for (const [variant, entry] of Object.entries(item.variants)) variantItem.set(entry.asset, { name, variant, entry, item });
	}
	for (const spec of specOrder) {
		const blockId = spec.slice("block.".length);
		const preview = previews.blocks[blockId] ?? {};
		const first = blockAssets.find((asset) => asset.spec === spec);
		entities.block[spec] = {
			blockId,
			title: first.title,
			...pick(preview, ["organism", "defaults", "alt", "fit", "sample"]),
			added: added.specs[spec] ?? first.added,
			...(patternMap.labels[blockId] ? { patternDraft: patternMap.labels[blockId] } : {})
		};
		for (const binding of preview.data ?? []) {
			const collection = binding.collection;
			entities.collection[collection] ??= { fields: [] };
			const fields = entities.collection[collection].fields;
			for (const name of Object.values(binding.fields ?? {})) if (!fields.includes(name)) fields.push(name);
			edge("block-binds-collection", spec, collection, pick(binding, ["as", "fields"]));
		}
	}
	for (const collection of Object.values(entities.collection)) collection.fields.sort();
	entities.collection = Object.fromEntries(Object.entries(entities.collection).sort(([a], [b]) => a.localeCompare(b)));

	// Variants: every block asset (one per variant), its registry item and preset props from variants.v0.json.
	const blockItems = new Map();
	for (const asset of blockAssets) {
		const pv = (previews.blocks[asset.spec.slice(6)]?.variants ?? []).find((v) => v.id === asset.variant);
		entities.variant[asset.id] = {
			block: asset.spec,
			variant: asset.variant,
			title: asset.title,
			subtitle: asset.subtitle,
			order: asset.order,
			added: asset.added,
			preview: asset.preview,
			...(asset.thumb ? { thumb: asset.thumb } : {}),
			...(pv?.set && Object.keys(pv.set).length ? { set: pv.set } : {}),
			...(pv?.props ? { sample: pv.props } : {}),
			weak: asset.weak,
			missing: asset.missing,
			fields: asset.fields
		};
		edge("block-has-variant", asset.spec, asset.id, { order: (blockItems.get(asset.spec)?.count ?? 0) });
		const entry = blockItems.get(asset.spec) ?? { count: 0, items: [] };
		entry.count += 1;
		if (!entry.items.includes(asset.registry)) entry.items.push(asset.registry);
		blockItems.set(asset.spec, entry);
		for (const [facet, values] of Object.entries(asset.labels)) {
			for (const value of values) edge("variant-tagged-facet", asset.id, valueId(facet, value), asset.weak.includes(facet) ? { weak: true } : {});
		}
		const mapped = variantItem.get(asset.id);
		if (mapped) {
			edge("variant-implemented-by-item", asset.id, mapped.name, mapped.item.defaultVariant === mapped.variant ? { default: true } : {});
			edge("variant-sets-props", asset.id, mapped.name, { props: mapped.entry.props });
		}
	}
	for (const [spec, entry] of blockItems) for (const name of entry.items) edge("block-implemented-by-item", spec, name);

	// Screens: every screen asset with its ordered composition (previews), install list and facet tags.
	const screenAssets = assets.assets.filter((asset) => asset.type === "screen");
	for (const asset of screenAssets) {
		entities.screen[asset.id] = {
			...pick(asset, ["title", "subtitle", "spec", "variant", "group", "order", "added", "preview", "thumb"]),
			weak: asset.weak,
			missing: asset.missing,
			fields: asset.fields
		};
		const family = previews.screens[asset.preview.screen];
		edge("screen-in-family", asset.id, asset.preview.screen, { area: asset.preview.area });
		const rows = [
			...family.before.map((row) => ["before", row]),
			...(family.areas[asset.preview.area] ?? []).map((row) => ["area", row]),
			...family.after.map((row) => ["after", row])
		];
		rows.forEach(([region, row], order) =>
			edge("screen-contains-block", asset.id, `block.${row.block}`, { order, region, variant: `block.${row.block}/${row.variant}`, ...(row.props ? { props: row.props } : {}) })
		);
		(install.screens[asset.id]?.items ?? []).forEach((item, order) => edge("screen-installs-item", asset.id, item.name, { order }));
		for (const [facet, values] of Object.entries(asset.labels)) {
			for (const value of values) edge("screen-tagged-facet", asset.id, valueId(facet, value), asset.weak.includes(facet) ? { weak: true } : {});
		}
	}

	// Registry items: the runtime index (what `npx ui8kit add` installs) + the cross-runtime registry.json metadata.
	const registryItems = new Map(registryDoc.items.map((item) => [item.name, item]));
	const sorted = [...index.components].sort((a, b) => a.name.localeCompare(b.name));
	for (const component of sorted) {
		const meta = registryItems.get(component.name) ?? {};
		const variants = variantsDoc.items[component.name];
		entities.item[component.name] = {
			type: component.type,
			...pick(meta, ["kind", "category", "group"]),
			title: component.title,
			description: component.description,
			runtimes: Object.keys(meta.runtimes ?? {}).sort(),
			dependencies: component.dependencies ?? [],
			files: meta.runtimes?.[pins.runtime]?.files ?? [],
			...(variants ? pick(variants, ["organism", "axes", "defaults", "defaultVariant"]) : {})
		};
		for (const dep of component.registryDependencies ?? []) edge("item-depends-on-item", component.name, dep);
	}

	// Props schemas (registry.buildy.tw/props/v0.json): one per organism; records are the shared object $defs.
	const icons = new Set();
	for (const [name, entry] of Object.entries(propsDoc.items)) {
		const schema = entry.schema;
		const defs = schema.$defs ?? {};
		entities.props[name] = {
			organism: entry.organism,
			description: schema.description,
			properties: Object.keys(schema.properties ?? {}),
			required: schema.required ?? [],
			events: entry.events,
			slots: entry.slots,
			usesIcons: ICON_DEF in defs,
			schema: `registry/props.v0.json#/items/${name}/schema`
		};
		edge("item-has-props", name, name);
		for (const [def, body] of Object.entries(defs)) {
			if (def === ICON_DEF) for (const icon of body.enum ?? []) icons.add(icon);
			if (SHAPE_DEFS.has(def)) continue;
			entities.record[def] ??= { properties: Object.keys(body.properties ?? {}), required: body.required ?? [] };
			edge("props-uses-record", name, def);
		}
	}
	entities.record = Object.fromEntries(Object.entries(entities.record).sort(([a], [b]) => a.localeCompare(b)));
	for (const icon of [...icons].sort()) entities.icon[icon] = {};

	const counts = {
		entities: Object.fromEntries(ENTITY_TYPES.map((type) => [type, Object.keys(entities[type]).length])),
		edges: Object.fromEntries(Object.keys(EDGE_TYPES).map((type) => [type, edges[type].length]))
	};
	return {
		format: FORMAT,
		version: 0,
		sources: pins.sources,
		catalog: { quick: facetsDoc.quick, sorts: facetsDoc.sorts, shared: assets.shared, locales: facetsDoc.locales, assetCounts: assets.counts },
		counts,
		entities,
		edges
	};
}

/** Problems of a graph: dangling edges, unknown entity types, variant presets that fail their props schema. */
export function validateGraph(graph, propsDoc) {
	const problems = [];
	for (const type of ENTITY_TYPES) if (!graph.entities[type]) problems.push(`entities.${type} missing`);
	for (const [type, list] of Object.entries(graph.edges)) {
		const ends = EDGE_TYPES[type];
		if (!ends) {
			problems.push(`unknown edge type ${type}`);
			continue;
		}
		for (const e of list) {
			if (!graph.entities[ends[0]][e.from]) problems.push(`${type}: from ${ends[0]} ${e.from} does not exist`);
			if (!graph.entities[ends[1]][e.to]) problems.push(`${type}: to ${ends[1]} ${e.to} does not exist`);
			if (type === "screen-contains-block" && !graph.entities.variant[e.variant]) problems.push(`${type}: ${e.from} variant ${e.variant} does not exist`);
		}
	}
	for (const type of ENTITY_TYPES) {
		if (graph.counts.entities[type] !== Object.keys(graph.entities[type]).length) problems.push(`counts.entities.${type} is stale`);
	}
	// A variant preset merges field by field over content, so it is validated like Stock's props test does: against the
	// schema without any `required` list (props and record fields), Ajv 2020 strict.
	const ajv = new Ajv2020({ strict: true, allErrors: true });
	const compiled = new Map();
	for (const e of graph.edges["variant-sets-props"]) {
		let validate = compiled.get(e.to);
		if (!validate) {
			const schema = propsDoc.items[e.to]?.schema;
			if (!schema) {
				problems.push(`variant-sets-props: no schema for ${e.to}`);
				continue;
			}
			validate = ajv.compile(withoutRequired(schema));
			compiled.set(e.to, validate);
		}
		if (!validate(e.props)) problems.push(`variant-sets-props: ${e.from} -> ${e.to}: ${ajv.errorsText(validate.errors)}`);
	}
	return problems;
}

function withoutRequired(node) {
	if (Array.isArray(node)) return node.map(withoutRequired);
	if (!node || typeof node !== "object") return node;
	return Object.fromEntries(Object.entries(node).filter(([k, v]) => !(k === "required" && Array.isArray(v))).map(([k, v]) => [k, withoutRequired(v)]));
}

const groupBy = (list, key) => {
	const out = new Map();
	for (const e of list) {
		const bucket = out.get(e[key]) ?? [];
		bucket.push(e);
		out.set(e[key], bucket);
	}
	return out;
};

/** Facet labels of an asset rebuilt from its tag edges, facet order = order of first appearance (the source order). */
function labelsOf(tags) {
	const labels = {};
	for (const e of tags ?? []) {
		const [facet, ...rest] = e.to.split("/");
		(labels[facet] ??= []).push(rest.join("/"));
	}
	return labels;
}

/** Computed coverage: what each source lacks for the other and for BuildY, never written by hand. */
export function coverage(graph, policy) {
	const E = graph.entities;
	const G = graph.edges;
	const blockItems = groupBy(G["block-implemented-by-item"], "from");
	const variantItems = new Set(G["variant-implemented-by-item"].map((e) => e.from));
	const itemBlocks = new Set(G["block-implemented-by-item"].map((e) => e.to));
	const tagged = new Set([...G["screen-tagged-facet"], ...G["variant-tagged-facet"]].map((e) => e.to));
	const screensOfBlock = groupBy(G["screen-contains-block"], "to");
	const screenTags = groupBy(G["screen-tagged-facet"], "from");
	const blockKinds = Object.keys(E.block);
	const pageKind = (spec) => policy.pageKindOfBlock[spec.slice(6)] ?? (policy.pageKinds.includes(spec.slice(6)) ? spec.slice(6) : null);
	const noPageKind = blockKinds.filter((spec) => !pageKind(spec));
	const registryBlocks = Object.entries(E.item).filter(([, item]) => item.type === "registry:block").map(([name]) => name);
	const valuesWithoutAssets = Object.keys(E.facetValue).filter((id) => !tagged.has(id));
	const facetsWithoutAssets = Object.keys(E.facet).filter((facet) => !Object.keys(E.facetValue).some((id) => id.startsWith(`${facet}/`) && tagged.has(id)));
	const composition = [];
	for (const [screen, rows] of groupBy(G["screen-contains-block"], "from")) {
		const fromComposition = [...new Set(rows.map((e) => e.to.slice(6)))].sort();
		const fromLabels = [...(labelsOf(screenTags.get(screen)).blocks ?? [])].sort();
		if (JSON.stringify(fromComposition) !== JSON.stringify(fromLabels)) composition.push({ screen, composition: fromComposition, labels: fromLabels });
	}
	const missingFacetLabels = {};
	const weakFacetLabels = {};
	for (const asset of [...Object.values(E.screen), ...Object.values(E.variant)]) {
		for (const facet of asset.missing) missingFacetLabels[facet] = (missingFacetLabels[facet] ?? 0) + 1;
		for (const facet of asset.weak) weakFacetLabels[facet] = (weakFacetLabels[facet] ?? 0) + 1;
	}
	const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
	const screensRenderable = Object.keys(E.screen).filter((screen) => (groupBy(G["screen-contains-block"], "from").get(screen) ?? []).every((e) => pageKind(e.to)));
	const report = {
		format: "buildy-catalog-coverage",
		version: 0,
		summary: {
			stockBlocks: blockKinds.length,
			stockBlocksWithRegistryItem: blockKinds.filter((spec) => blockItems.has(spec)).length,
			stockVariants: Object.keys(E.variant).length,
			stockVariantsWithRegistryVariant: Object.keys(E.variant).filter((id) => variantItems.has(id)).length,
			registryBlocks: registryBlocks.length,
			registryBlocksWithStockBlock: registryBlocks.filter((name) => itemBlocks.has(name)).length,
			stockBlocksWithPageKind: blockKinds.length - noPageKind.length,
			screens: Object.keys(E.screen).length,
			screensFullyPageKinded: screensRenderable.length,
			facets: Object.keys(E.facet).length,
			facetValues: Object.keys(E.facetValue).length,
			facetValuesOnAssets: Object.keys(E.facetValue).length - valuesWithoutAssets.length,
			collections: Object.keys(E.collection).length,
			collectionsWithData: 0
		},
		stock: {
			blocksWithoutRegistryItem: blockKinds.filter((spec) => !blockItems.has(spec)),
			variantsWithoutRegistryVariant: Object.keys(E.variant).filter((id) => !variantItems.has(id)),
			facetsWithoutAssets,
			facetValuesWithoutAssets: valuesWithoutAssets,
			screensWhoseBlockLabelsDifferFromComposition: composition,
			missingFacetLabels: sortObj(missingFacetLabels),
			weakFacetLabels: sortObj(weakFacetLabels),
			blocksInNoScreen: blockKinds.filter((spec) => !screensOfBlock.has(spec)),
			collectionsWithoutData: Object.keys(E.collection)
		},
		registry: {
			blocksWithoutStockBlock: registryBlocks.filter((name) => !itemBlocks.has(name)),
			propsWithoutVariants: Object.keys(E.props).filter((name) => !G["variant-sets-props"].some((e) => e.to === name)),
			itemsMissingInRuntime: Object.entries(E.item).filter(([, item]) => !item.runtimes.includes(graph.sources.ui8kit.runtime)).map(([name]) => name)
		},
		buildy: {
			blocksWithoutPageKind: noPageKind,
			screensWithBlocksWithoutPageKind: Object.keys(E.screen).filter((screen) => !screensRenderable.includes(screen))
		}
	};
	return report;
}

/** packages/builder-core/src/catalog/snapshot.json: the runtime's screen catalog, same shape as before ADR 0012. */
export function deriveSnapshot(graph, policy) {
	const E = graph.entities;
	const screenTags = groupBy(graph.edges["screen-tagged-facet"], "from");
	const variantsOf = groupBy(graph.edges["block-has-variant"], "from");
	const facetValues = (facet) =>
		graph.edges["facet-has-value"].filter((e) => e.from === facet).map((e) => E.facetValue[e.to].value);
	const sortedValues = (facet) => [...facetValues(facet)].sort();
	const pageKind = (blockId) => policy.pageKindOfBlock[blockId] ?? null;
	const composition = groupBy(graph.edges["screen-contains-block"], "from");
	// Job facet values of each Stock block, from the tags of its variants (data, not a word list).
	const jobsOf = new Map();
	for (const e of graph.edges["variant-tagged-facet"]) {
		if (!e.to.startsWith("job/")) continue;
		const spec = E.variant[e.from]?.block;
		if (!spec) continue;
		if (!jobsOf.has(spec)) jobsOf.set(spec, new Set());
		jobsOf.get(spec).add(e.to.slice(4));
	}
	const screens = Object.entries(E.screen).map(([screenId, screen], sourceOrdinal) => {
		const labels = labelsOf(screenTags.get(screenId));
		// The screen's own composition: each Stock block once, in screen order, with the variant the screen sets.
		const layout = [];
		for (const e of [...(composition.get(screenId) ?? [])].sort((a, b) => a.order - b.order)) {
			const block = e.to.slice(6);
			if (layout.some((row) => row.block === block)) continue;
			layout.push({ block, variant: e.variant.slice(e.variant.indexOf("/") + 1), region: e.region });
		}
		return {
			screenId,
			sourceOrdinal,
			title: screen.title,
			subtitle: screen.subtitle,
			spec: screen.spec,
			variant: screen.variant,
			group: screen.group,
			order: screen.order,
			preview: screen.preview,
			...(screen.thumb ? { thumb: screen.thumb } : {}),
			labels: { type: labels.type ?? [], site: labels.site ?? [], section: labels.section ?? [], job: labels.job ?? [], blocks: labels.blocks ?? [], industry: labels.industry ?? [] },
			added: screen.added,
			missingFacets: screen.missing,
			layout
		};
	});
	const blockIndex = Object.entries(E.block)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([spec, block]) => {
			const variants = (variantsOf.get(spec) ?? []).map((e) => e.to);
			const kind = pageKind(block.blockId);
			return {
				blockId: block.blockId,
				spec,
				catalogIds: variants,
				variants: variants.map((id) => E.variant[id].variant),
				// Stock thumbnails by variant (thumbs/<id>.webp?v=..., relative to the Stock app), for the variants that have one
				thumbs: Object.fromEntries(variants.filter((id) => E.variant[id].thumb).map((id) => [E.variant[id].variant, E.variant[id].thumb])),
				title: block.title,
				available: true,
				rendererKind: kind,
				rendererCompatible: kind !== null,
				jobs: [...(jobsOf.get(spec) ?? [])].sort()
			};
		});
	const stock = graph.sources.codegenX;
	return {
		format: "buildy-browser-catalog-snapshot",
		schemaVersion: 1,
		provider: "codegen-x",
		repo: stock.repo,
		pinnedCommit: stock.commit,
		sourceArtifact: `${stock.content}/assets.v0.json`,
		sourceDigest: stock.assetsDigest,
		sourceVersion: stock.assetsVersion,
		counts: { screen: screens.length, upstreamBlock: graph.catalog.assetCounts.block, upstreamScreen: graph.catalog.assetCounts.screen },
		pageSize: policy.pageSize,
		facetVocabulary: { type: [...policy.assetTypes], site: sortedValues("site"), section: sortedValues("section"), job: sortedValues("job") },
		ownerFilters: policy.ownerFilters,
		rendererKinds: policy.pageKinds,
		screens,
		blockIndex,
		rendererMap: policy.pageKindOfBlock
	};
}

/** Unicode word tokens, lower-case; run-together phrase keys (search-engine artefacts) are skipped. */
function tokens(text) {
	return String(text ?? "")
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((t) => t.length >= 2 && t.length <= 20);
}

/** packages/builder-core/src/catalog/search-index.json: per-screen weighted terms from catalog data only. */
export function deriveSearchIndex(graph, policy) {
	const E = graph.entities;
	const SEARCH_FACETS = policy.searchFacets;
	const valuesOf = groupBy(graph.edges["facet-has-value"], "from");
	const vocabulary = {};
	const facetMeta = new Map();
	// Facet order of the vocabulary (facets.v0.json), not of the policy list.
	for (const facet of Object.keys(E.facet)) {
		if (!SEARCH_FACETS.includes(facet)) continue;
		vocabulary[facet] = [];
		for (const e of valuesOf.get(facet) ?? []) {
			const value = E.facetValue[e.to];
			facetMeta.set(e.to, { labels: value.label ?? {}, synonyms: Object.values(value.synonyms ?? {}).flat() });
			vocabulary[facet].push({ id: value.value, label: value.label ?? {} });
		}
	}
	const variantsOf = groupBy(graph.edges["block-has-variant"], "from");
	const blockVariants = (label) => (variantsOf.get(`block.${label}`) ?? []).map((e) => E.variant[e.to]);
	const screenTags = groupBy(graph.edges["screen-tagged-facet"], "from");
	const blockVocab = new Map();
	for (const screenId of Object.keys(E.screen)) {
		for (const label of labelsOf(screenTags.get(screenId)).blocks ?? []) {
			if (blockVocab.has(label)) continue;
			const first = blockVariants(label)[0];
			blockVocab.set(label, first ? first.title : label);
		}
	}
	vocabulary.blocks = [...blockVocab.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, title]) => ({ id, label: { en: title } }));

	const add = (map, term, weight) => term && map.set(term, Math.max(map.get(term) ?? 0, weight));
	const addText = (map, text, weight) => {
		for (const t of tokens(text)) add(map, t, weight);
	};
	const screens = {};
	for (const [screenId, screen] of Object.entries(E.screen)) {
		const labels = labelsOf(screenTags.get(screenId));
		const terms = new Map();
		for (const field of screen.fields ?? []) for (const word of field.words ?? []) addText(terms, word, field.w);
		addText(terms, screen.title, 6);
		addText(terms, screen.subtitle, 4);
		addText(terms, screen.spec, 3);
		addText(terms, screen.variant, 4);
		for (const facet of SEARCH_FACETS) {
			for (const value of labels[facet] ?? []) {
				addText(terms, value, 3);
				const meta = facetMeta.get(`${facet}/${value}`);
				if (!meta) continue;
				for (const label of Object.values(meta.labels)) addText(terms, label, 2);
				for (const syn of meta.synonyms) addText(terms, syn, 2);
			}
		}
		for (const label of labels.blocks ?? []) {
			addText(terms, label, 3);
			for (const variant of blockVariants(label)) {
				addText(terms, variant.title, 2);
				addText(terms, variant.subtitle, 1);
				for (const field of variant.fields ?? []) if (field.w >= 3) for (const word of field.words ?? []) addText(terms, word, 1);
			}
		}
		// Packed order must match the pinned index regardless of the host's OS locale.
		screens[screenId] = Object.fromEntries([...terms.entries()].sort(([a], [b]) => a.localeCompare(b, "en")));
	}
	const termList = [...new Set(Object.values(screens).flatMap((terms) => Object.keys(terms)))].sort();
	const termIndex = new Map(termList.map((t, i) => [t, i]));
	const packed = Object.fromEntries(
		Object.entries(screens).map(([id, terms]) => [id, Object.entries(terms).map(([t, w]) => `${termIndex.get(t).toString(36)}:${w}`).join(",")])
	);
	const stock = graph.sources.codegenX;
	return {
		format: "buildy-catalog-search-index",
		schemaVersion: 1,
		repo: stock.repo,
		pinnedCommit: stock.commit,
		sources: {
			assets: { artifact: `${stock.content}/assets.v0.json`, digest: stock.assetsDigest },
			facets: { artifact: `${stock.content}/facets.v0.json`, sha256: `sha256:${stock.files["facets.v0.json"].sha256}` }
		},
		vocabulary,
		terms: termList,
		screens: packed
	};
}

/** Policy problems: every value must name something that exists in the graph or in the Page DTO kinds. */
export function validatePolicy(graph, policy, pageBlockKinds) {
	const problems = [];
	const E = graph.entities;
	for (const kind of policy.pageKinds) if (!pageBlockKinds.includes(kind)) problems.push(`pageKinds: ${kind} is not a Page DTO kind`);
	for (const [blockId, kind] of Object.entries(policy.pageKindOfBlock)) {
		if (!E.block[`block.${blockId}`]) problems.push(`pageKindOfBlock: block.${blockId} is not a Stock block`);
		if (!policy.pageKinds.includes(kind)) problems.push(`pageKindOfBlock.${blockId}: ${kind} is not in pageKinds`);
	}
	for (const type of policy.assetTypes) if (!E.facetValue[`type/${type}`]) problems.push(`assetTypes: ${type} is not a type facet value`);
	for (const facet of policy.searchFacets) if (!E.facet[facet]) problems.push(`searchFacets: ${facet} is not a facet`);
	for (const [name, filter] of Object.entries(policy.ownerFilters)) {
		for (const [facet, value] of Object.entries(filter)) if (!E.facetValue[`${facet}/${value}`]) problems.push(`ownerFilters.${name}.${facet}: ${value} is not a facet value`);
	}
	return problems;
}

/** ASCII-only JSON (repo rule: no non-Latin script outside the ru locale file; \u escapes keep the data). */
export function ascii(text) {
	return text.replace(/[\u007f-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

/** Deterministic JSON: objects/arrays down to `depth` are pretty (tabs), deeper values one line each; ASCII-only. */
export function serialize(value, depth = 3) {
	const write = (node, level) => {
		if (level >= depth || node === null || typeof node !== "object" || (Array.isArray(node) ? node.length === 0 : Object.keys(node).length === 0)) {
			return JSON.stringify(node);
		}
		const pad = "\t".repeat(level + 1);
		const end = "\t".repeat(level);
		if (Array.isArray(node)) return `[\n${node.map((v) => pad + write(v, level + 1)).join(",\n")}\n${end}]`;
		return `{\n${Object.entries(node).map(([k, v]) => `${pad}${JSON.stringify(k)}: ${write(v, level + 1)}`).join(",\n")}\n${end}}`;
	};
	return `${ascii(write(value, 0))}\n`;
}

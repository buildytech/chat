/**
 * Inspector coverage of every registry item + variant (the `buildy` label of Stock, ADR 0036).
 *
 * A combination is covered when the manual Inspector can author it end to end, with no model:
 *   1. the block is added as the Blocks "+" adds it (sample props of the variant);
 *   2. every list gets two rows and every field of the Inspector model is written, through the very operations the
 *      Inspector runs (`applyOp` list_row add, `applyOp` set at the field's JSON Pointer; same gate, same props schema);
 *   3. the registry component, compiled for SSR (api/runtime/_render/blocks.mjs), renders visible content;
 *   4. nothing the props schema defines is out of the Inspector's reach (no read-only widget, no rejected operation).
 *
 * Output: catalog/inspector-coverage.json, keyed `item/variant`, stable (sorted keys, no dates). The inputs are pinned by
 * digest: the props schemas, the registry sources and the Inspector code. `--check` fails when the file is stale.
 * `fixable` marks a gap that a small Inspector change closes (report only); none is open today.
 *
 *   node --experimental-strip-types --import ./packages/builder-core/src/catalog/props-gate.ts scripts/inspector-coverage.mjs [--check]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(repo, "catalog", "inspector-coverage.json");
const BUNDLE = join(repo, "api", "runtime", "_render", "blocks.mjs");
const NOW = "2026-01-01T00:00:00.000Z";
const HIDDEN = new Set(["id", "class", "className"]);

if (!existsSync(BUNDLE)) spawnSync(process.execPath, [join(repo, "scripts", "build-render-bundle.mjs")], { cwd: repo, stdio: "inherit" });
const core = await import(pathToFileURL(join(repo, "packages/builder-core/src/index.ts")).href);
const { allItems, itemInfo, emptyPage, writePage, sampleProps, propsFieldTree, propsSchemaFor, propsEventsFor, propsDigest, inspectorModel, inspectorValue, applyOp, renderBlock, probeFromModule, probeOutcome } = core;
const bundle = await import(pathToFileURL(BUNDLE).href);

// The one render probe (ADR 0038), the same function the runtime and the browser install; here it only classifies, it is not installed.
const probe = probeFromModule(bundle);

const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);
const inspectorFiles = ["packages/builder-core/src/catalog/props-schema.ts", "packages/builder-core/src/page-doc/inspect.ts", "packages/builder-core/src/page-doc/ops.ts", "apps/chat-web/src/app/InspectorFields.svelte", "apps/chat-web/src/lib/inspector/inspector.svelte.ts", "apps/chat-web/src/lib/inspector/fields.ts"];
const inspectorDigest = sha(inspectorFiles.map((f) => readFileSync(join(repo, f), "utf8")).join("\n--\n"));
const config = JSON.parse(readFileSync(join(repo, "catalog", "snapshot.config.json"), "utf8"));

// ---- why a prop is out of reach (mirror of props-schema.ts kindOf / valueOf, used for the reason text only)
function schemaReader(item) {
	const defs = propsSchemaFor(item).$defs ?? {};
	const refName = (n) => (typeof n.$ref === "string" && n.$ref.startsWith("#/$defs/") ? n.$ref.slice(8) : null);
	const deref = (n) => {
		let c = n;
		for (let i = 0; i < 16; i += 1) {
			const r = refName(c);
			if (!r) return c;
			c = defs[r] ?? {};
		}
		return c;
	};
	const isRef = (n) => {
		const t = deref(n);
		if (Array.isArray(t.anyOf)) return t.anyOf.every(isRef);
		const req = t.required ?? [];
		return t.type === "object" && (req.includes("$") || (req.includes("op") && req.includes("args")));
	};
	const valueOf = (n) => {
		const t = deref(n);
		if (Array.isArray(t.anyOf)) {
			const b = t.anyOf.filter((x) => !isRef(x));
			if (b.length === 1) return valueOf(b[0]);
		}
		return t;
	};
	const why = (n) => {
		const t = valueOf(n);
		if (Array.isArray(t.anyOf)) return t.anyOf.every(isRef) ? "reference_only" : "multi_branch";
		if (Array.isArray(t.oneOf)) return "one_of";
		if (Array.isArray(t.type)) return "type_union";
		if (t.const !== undefined) return "const";
		if (t.type === "object") return t.additionalProperties ? "free_form_map" : "object_without_properties";
		if (t.type === "array") return "list_of_primitives";
		return "unsupported_schema";
	};
	return { valueOf, why };
}

/** `fixable`: a gap a small Inspector change closes. None is open: what is left is the contract's own boundary (trusted markup). */
const FIXABLE = new Set();
const gap = (path, reason) => ({ path, reason, fixable: FIXABLE.has(reason) });

/** Schema-level gaps of an item (the same for every variant) and its property counts. */
function staticGaps(item) {
	const tree = propsFieldTree(item);
	const { valueOf, why } = schemaReader(item);
	const { events, slots } = propsEventsFor(item);
	const hide = new Set([...events, ...slots]);
	const counts = { leaves: 0, editable: 0, locked: 0 };
	const gaps = [];
	const walk = (nodes, schema, base, depth) => {
		const props = valueOf(schema).properties ?? {};
		for (const node of nodes) {
			if (depth === 0 && hide.has(node.name)) continue;
			const path = `${base}/${node.name}`;
			const raw = props[node.name] ?? {};
			if (HIDDEN.has(node.name)) {
				counts.leaves += 1;
				counts.locked += 1;
				continue;
			}
			if (node.kind === "object") {
				if (node.fields) walk(node.fields, raw, path, depth + 1);
				else {
					counts.leaves += 1;
					gaps.push(gap(path, "object_too_deep"));
				}
				continue;
			}
			counts.leaves += 1;
			if (node.kind === "enum") counts.editable += 1;
			else if (node.kind === "list") {
				if (node.fields) {
					counts.editable += 1;
					walk(node.fields, valueOf(raw).items ?? {}, `${path}[]`, depth + 1);
				} else if (node.item) counts.editable += 1;
				else gaps.push(gap(path, why(raw)));
			} else if (node.kind === "map") {
				if (node.item) counts.editable += 1;
				else gaps.push(gap(path, "free_form_map"));
			} else if (node.kind === "markup") gaps.push(gap(path, "trusted_markup"));
			else if (node.kind === "other") gaps.push(gap(path, why(raw)));
			else counts.editable += 1;
		}
	};
	walk(tree, propsSchemaFor(item), "", 0);
	return { counts, gaps };
}

// ---- drive the Inspector's own operations
const synth = (f) => {
	const n = String(f.name);
	switch (f.widget) {
		case "boolean":
			return true;
		case "number":
			return 1;
		case "icon":
			return "star";
		case "enum":
			return (f.options ?? []).find((o) => o !== String(f.value ?? "")) ?? (f.options ?? [""])[0];
		default: {
			if (/^(href|url|link|to)$/i.test(n) || /(Href|Url)$/.test(n)) return "https://example.com/page";
			if (/^(src|image|img|logo|avatar|poster|thumbnail)$/i.test(n) || /(Src|Image)$/.test(n)) return "https://example.com/pic.png";
			if (/email/i.test(n)) return "a@example.com";
			if (n === "currency") return "USD";
			if (n === "locale") return "en";
			const text = "Sample text";
			return f.maxLength && f.maxLength < text.length ? text.slice(0, f.maxLength) : text;
		}
	}
};
const lists = (fields, acc = []) => {
	for (const f of fields) {
		if (f.widget === "list") {
			acc.push(f);
			for (const r of f.rows ?? []) lists(r.fields, acc);
		} else if (f.widget === "values" || f.widget === "map") acc.push(f);
		else if (f.widget === "object") lists(f.fields ?? [], acc);
	}
	return acc;
};
const scalars = (fields, acc = []) => {
	for (const f of fields) {
		if (f.widget === "list") for (const r of f.rows ?? []) scalars(r.fields, acc);
		else if (f.widget === "values") acc.push(...(f.items ?? []));
		else if (f.widget === "map") acc.push(...(f.entries ?? []).map((e) => e.field));
		else if (f.widget === "object") scalars(f.fields ?? [], acc);
		else if (f.widget !== "other") acc.push(f);
	}
	return acc;
};
/** `/dishes/0/level` -> `/dishes[]/level`, so an operation failure and a schema gap name the same prop. */
const schemaPath = (pointer) => pointer.replace(/^\/blocks\/\d+\/props/, "").replace(/\/\d+(?=\/|$)/g, "[]");

function opGap(code, message, pointer) {
	const path = schemaPath(pointer);
	if (code === "path_not_found") return gap(path.replace(/\/[^/]*$/, "") || "/", "optional_object_absent");
	if (code === "not_a_list") return gap(path, "optional_list_absent");
	if (code === "props_invalid" && /one of/.test(message)) return gap(path, "non_string_enum");
	return gap(path, `op_rejected_${code}`);
}

const manifest = {};
const gapCache = new Map();
for (const item of allItems()) {
	const info = itemInfo(item);
	if (!gapCache.has(item)) gapCache.set(item, staticGaps(item));
	const { counts, gaps: schemaGaps } = gapCache.get(item);
	for (const variant of info.variants) {
		const record = { leaves: counts.leaves, editable: counts.editable, locked: counts.locked, unsupported: [], rendersSample: "", rendersFilled: "", covered: false };
		const seen = new Set();
		const add = (g) => {
			const key = `${g.path}\u0000${g.reason}`;
			if (!seen.has(key)) {
				seen.add(key);
				record.unsupported.push({ path: g.path, reason: g.reason, fixable: g.fixable });
			}
		};
		schemaGaps.forEach(add);
		let page = emptyPage({ title: "t", now: NOW });
		const first = writePage(page, { patch: [{ op: "add", path: "/blocks/-", value: { item, variant, props: sampleProps(item, variant, "b1") } }] }, { now: NOW });
		if (!first.ok) {
			record.rendersSample = "write_rejected";
			record.rendersFilled = "write_rejected";
			add(gap("/", `op_rejected_${first.issues[0]?.code ?? "write"}`));
			manifest[`${item}/${variant}`] = record;
			continue;
		}
		page = first.page;
		const blockId = page.blocks[0].id;
		const view = () => page.blocks[0];
		const outcome = (block) => {
			const r = renderBlock(block);
			return probeOutcome(probe(r.organism, r.props));
		};
		record.rendersSample = outcome(view());
		// two rows per list, through the list_row operation of the Inspector
		for (let guard = 0; guard < 60; guard += 1) {
			const model = inspectorModel(view());
			if (!model.ok) break;
			const pending = lists(model.fields).filter((l) => (l.rows ?? l.items ?? l.entries ?? []).length < Math.min(2, l.list?.max ?? 0));
			if (!pending.length) break;
			const result = applyOp(page, pending[0].widget === "map" ? { op: "map_entry", blockId, pointer: pending[0].pointer, action: "add" } : { op: "list_row", blockId, pointer: pending[0].pointer, action: "add" });
			if (!result.ok) {
				add(opGap(result.code, result.message, pending[0].pointer));
				break;
			}
			page = result.page;
		}
		// a map: the first key renamed, as the key field does
		for (let guard = 0; guard < 12; guard += 1) {
			const model = inspectorModel(view());
			const map = model.ok ? lists(model.fields).find((l) => l.widget === "map" && (l.entries ?? []).some((e) => !e.key.startsWith("renamed"))) : null;
			if (!map) break;
			const entry = map.entries.find((e) => !e.key.startsWith("renamed"));
			const result = applyOp(page, { op: "map_entry", blockId, pointer: map.pointer, action: "rename", key: entry.key, to: `renamed${entry.key}` });
			if (!result.ok) {
				add(opGap(result.code, result.message, map.pointer));
				break;
			}
			page = result.page;
		}
		// every field of the model, through the set operation of the Inspector
		const model = inspectorModel(view());
		if (model.ok) {
			for (const f of scalars(model.fields)) {
				const result = applyOp(page, { op: "set", blockId, pointer: f.pointer, value: inspectorValue(f, String(synth(f))) });
				if (!result.ok) add(opGap(result.code, result.message, result.pointer ?? f.pointer));
				else page = result.page;
			}
		} else add(gap("/", `no_inspector_model_${model.reason}`));
		record.rendersFilled = outcome(view());
		record.unsupported.sort((a, b) => a.path.localeCompare(b.path) || a.reason.localeCompare(b.reason));
		record.covered = record.unsupported.length === 0 && record.rendersFilled === "content";
		manifest[`${item}/${variant}`] = record;
	}
}

const keys = Object.keys(manifest).sort();
const combos = Object.fromEntries(keys.map((k) => [k, manifest[k]]));
const covered = keys.filter((k) => combos[k].covered).length;
const reasons = {};
for (const k of keys) for (const g of combos[k].unsupported) reasons[g.reason] = (reasons[g.reason] ?? 0) + 1;
const doc = {
	format: "buildy-inspector-coverage",
	version: 1,
	description: "Registry item/variant combinations the BuildY Inspector covers end to end (the `buildy` label of Stock). Generated by scripts/inspector-coverage.mjs; never edit by hand.",
	inputs: {
		propsDigest,
		registrySourceCommit: config.ui8kit?.sourceCommit ?? null,
		stockContentCommit: config.codegenX?.commit ?? null,
		inspectorDigest
	},
	summary: { combos: keys.length, items: allItems().length, covered, notCovered: keys.length - covered, reasons: Object.fromEntries(Object.entries(reasons).sort(([a], [b]) => a.localeCompare(b))) },
	combos
};
const text = `${JSON.stringify(doc, null, "\t")}\n`;
if (process.argv.includes("--check")) {
	const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
	if (current !== text) {
		console.error("catalog/inspector-coverage.json is stale: run npm run inspector:coverage");
		process.exit(1);
	}
	console.log(`inspector coverage current: ${covered}/${keys.length} covered`);
} else {
	writeFileSync(OUT, text);
	console.log(`wrote catalog/inspector-coverage.json: ${covered}/${keys.length} covered`);
}

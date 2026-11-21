/**
 * The registry-side derivations, pure functions over the pinned raw registry files (registry/snapshot.json,
 * variants.v0.json, props.v0.json, svelte/ui8kit.lock.json). Shared by scripts/registry-snapshot.mjs (network
 * capture and its --check) and scripts/snapshot.mjs (the one derive / check of every catalog artifact, ADR 0039).
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const hex = (text) => createHash("sha256").update(text).digest("hex");
export const json = (value) => `${JSON.stringify(value, null, "\t")}\n`;

export const SOURCES_JSON = "packages/builder-core/src/catalog/sources.json";
export const PROPS_JSON = "packages/builder-core/src/catalog/props.json";
export const MONEY_JSON = "packages/builder-core/src/catalog/money.json";
export const BLOCKS_JSON = "packages/builder-core/src/catalog/blocks.json";
export const PICTURES_JSON = "packages/builder-core/src/catalog/pictures.json";

/** Skins (registry:theme items, `add theme-<skin>`; `add --all` leaves them out): skin id -> item, title and CSS file. */
export function themesOf(snapshot) {
	const themes = {};
	let base = null;
	for (const [name, item] of Object.entries(snapshot.items)) {
		if (item.type !== "registry:theme") continue;
		if (name === "theme-base") {
			base = { item: name, files: item.files };
			continue;
		}
		const id = name.slice("theme-".length);
		const file = item.files.find((f) => f.endsWith(`/${id}.css`));
		if (!file) throw new Error(`${name}: no styles/skins/${id}.css`);
		if (!item.registryDependencies.includes("theme-base")) throw new Error(`${name}: does not depend on theme-base`);
		themes[id] = { item: name, title: item.title, file };
	}
	if (Object.keys(themes).length && !base) throw new Error("skins without theme-base");
	return { base, skins: themes };
}

/**
 * Published props schemas (registry.buildy.tw/props/v0.json): `items[item].schema` is a JSON Schema 2020-12 of the
 * block's props with its own `$defs`. The contract shares $defs by name across items (text, uiRef, lucideIcon, ...);
 * a name that maps to two different schemas fails the build. The compact file stores each $def once and each item
 * schema without $defs; packages/builder-core/src/catalog/props-schema.ts rebuilds an item schema with exactly the
 * $defs it reaches, which --check compares byte-for-byte with the pinned file.
 */
export function propsDigest(props) {
	const { digest: _digest, ...rest } = props;
	return `sha256:${hex(JSON.stringify(rest))}`;
}

function defRefs(node, out = new Set()) {
	if (Array.isArray(node)) for (const inner of node) defRefs(inner, out);
	else if (node && typeof node === "object") {
		for (const [key, inner] of Object.entries(node)) {
			if (key === "$ref" && typeof inner === "string" && inner.startsWith("#/$defs/")) out.add(inner.slice("#/$defs/".length));
			else defRefs(inner, out);
		}
	}
	return out;
}

/** The $defs an item schema reaches from its root, in the order of the published `$defs`. */
function reachedDefs(schema, defs) {
	const seen = new Set();
	const queue = [...defRefs({ ...schema, $defs: undefined })];
	while (queue.length) {
		const name = queue.shift();
		if (seen.has(name)) continue;
		if (!defs[name]) throw new Error(`$ref #/$defs/${name} has no $def`);
		seen.add(name);
		queue.push(...defRefs(defs[name]));
	}
	return seen;
}

export function compactProps(props) {
	const defs = {};
	const items = {};
	for (const [item, entry] of Object.entries(props.items)) {
		const { $defs = {}, ...schema } = entry.schema;
		for (const [name, def] of Object.entries($defs)) {
			if (defs[name] && JSON.stringify(defs[name]) !== JSON.stringify(def)) throw new Error(`$defs/${name} differs between items (${item})`);
			defs[name] = def;
		}
		// Key order of the published $defs, so the rebuilt schema serializes byte-for-byte like the pinned one.
		items[item] = { organism: entry.organism, events: entry.events, slots: entry.slots, schema, defs: Object.keys($defs), ...(entry.viewMap ? { viewMap: entry.viewMap } : {}) };
		const reached = reachedDefs(entry.schema, $defs);
		if (reached.size !== Object.keys($defs).length) throw new Error(`${item}: $defs has entries its schema never reaches`);
	}
	return { format: "buildy-props-compact", version: 1, registry: props.registry, propsVersion: props.version, digest: props.digest, defs, items };
}

/** The pinned item schema rebuilt from the compact file (same as props-schema.ts schemaFor). */
export function rebuiltSchema(compact, item) {
	const entry = compact.items[item];
	return { ...entry.schema, $defs: Object.fromEntries(entry.defs.map((name) => [name, compact.defs[name]])) };
}

export function deriveSources({ snapshot, variants, props, lock }) {
	const blocks = {};
	const assets = {};
	for (const [item, entry] of Object.entries(variants.items)) {
		const graph = snapshot.items[item];
		if (!graph || graph.type !== "registry:block") throw new Error(`variants item ${item} is not a block of the snapshot`);
		const organism = graph.files.find((file) => file.startsWith("src/blocks/") && file.endsWith(".svelte"));
		if (!organism) throw new Error(`${item}: no blocks/*.svelte in the snapshot`);
		const schema = props.items[item];
		if (!schema) throw new Error(`${item}: no props schema in the published props file`);
		if (schema.organism !== entry.organism) throw new Error(`${item}: props organism ${schema.organism} != variants organism ${entry.organism}`);
		blocks[item] = {
			spec: entry.spec,
			organism: organism.slice("src/".length),
			organismName: entry.organism,
			defaultVariant: entry.defaultVariant,
			variants: Object.fromEntries(Object.entries(entry.variants).map(([id, variant]) => [id, variant.props]))
		};
		for (const [id, variant] of Object.entries(entry.variants)) {
			if (assets[variant.asset]) throw new Error(`asset ${variant.asset} maps to two items`);
			assets[variant.asset] = { item, variant: id };
		}
	}
	// Catalog block without a variant: the default variant of the first item of its spec (variants file order).
	const specs = {};
	for (const [item, block] of Object.entries(blocks)) specs[block.spec] ??= { item, variant: block.defaultVariant };
	return {
		format: "buildy-catalog-sources",
		version: 3,
		registry: snapshot.registry,
		cli: snapshot.cli,
		lockDigest: `sha256:${hex(JSON.stringify(lock))}`,
		variants: { url: snapshot.variants.url, sha256: snapshot.variants.sha256, digest: variants.digest },
		props: { url: snapshot.props.url, sha256: snapshot.props.sha256, digest: props.digest },
		initItems: snapshot.initItems,
		npmDependencies: snapshot.npmDependencies,
		items: snapshot.items,
		themes: themesOf(snapshot),
		blocks,
		assets,
		specs
	};
}

/** Exact bytes of sources.json and props.json derived from the raw registry files under `root`. */
/** The balanced text of the first argument of a call that starts at `open` (the index of its "("). */
function firstArgument(text, open) {
	let depth = 0;
	for (let i = open; i < text.length; i += 1) {
		const ch = text[i];
		if (ch === "(" || ch === "[" || ch === "{") depth += 1;
		else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
		else if (ch === "," && depth === 1) return text.slice(open + 1, i);
		if (depth === 0) return text.slice(open + 1, i);
	}
	return "";
}

const sourceFiles = (dir) =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : /\.(svelte|ts)$/.test(entry.name) ? [join(dir, entry.name)] : []));

/**
 * Names of the money props of the registry (Codex v0.4: integer minor units, `fmtMoney(minor, currency)`), read from what the
 * registry itself ships and never listed by hand: (1) the property (or bare name) a block hands to `fmtMoney` as its whole
 * first argument, following a local `$derived` to the properties it reads; (2) a number prop whose doc comment in a generated
 * `*.types.ts` says "minor units". A product (`price * qty`) is not a name: its factors are not money by themselves.
 * The chat treats a number prop with one of these names that sits beside a `currency` prop as money.
 */
export function deriveMoneyNames(root) {
	const names = new Set();
	const dir = join(root, "registry/svelte/src");
	for (const file of sourceFiles(dir)) {
		const text = readFileSync(file, "utf8");
		if (file.endsWith(".svelte")) {
			for (const call of text.matchAll(/\bfmtMoney\(/g)) {
				const arg = firstArgument(text, call.index + call[0].length - 1).trim();
				const member = /^[\w$]+\.([\w$]+)$/.exec(arg);
				if (member) names.add(member[1]);
				else if (/^[\w$]+$/.test(arg)) {
					names.add(arg);
					const local = new RegExp(`const ${arg.replace(/\$/g, "\\$")} = \\$derived\\(([^;]*?)\\);?\\s*$`, "m").exec(text);
					for (const read of local?.[1].matchAll(/[\w$]+\.([\w$]+)/g) ?? []) names.add(read[1]);
				}
			}
		} else if (file.endsWith(".types.ts")) {
			for (const doc of text.matchAll(/\/\*\*[^*]*minor units[^*]*\*\/\s*([\w$]+)\??:\s*number/g)) names.add(doc[1]);
		}
	}
	return [...names].sort();
}

/** A string a block computes from one layout prop: a literal, or `(prop as string) === "v" ? "a" : ... : "z"` (a `$derived` chain). */
function stringExpr(text) {
	const literal = /^\s*"([^"]*)"\s*$/.exec(text);
	if (literal) return { value: literal[1] };
	const cases = [];
	const step = /\(*\s*\(?\s*([\w$]+) as string\s*\)?\s*===\s*"([^"]*)"\s*\)*\s*\?\s*"([^"]*)"\s*:/y;
	let rest = text.trim();
	for (;;) {
		step.lastIndex = 0;
		const m = step.exec(rest);
		if (!m) break;
		cases.push({ prop: m[1], eq: m[2], value: m[3] });
		rest = rest.slice(step.lastIndex).trim();
	}
	const last = /^"([^"]*)"$/.exec(rest);
	return cases.length && last ? { cases, else: last[1] } : null;
}

/** The value of an attribute expression in a block: a literal, a `$derived` const of the block, or `cn(...)` of those (joined). */
function attrExpr(text, raw) {
	if (raw === undefined) return { value: "" };
	if (raw.startsWith('"')) return { value: raw.slice(1, -1) };
	const inner = raw.slice(1, -1).trim();
	const derived = (name) => {
		const m = new RegExp(`const ${name.replace(/\$/g, "\\$")} = \\$derived\\(([\\s\\S]*?)\\);\\s*$`, "m").exec(text);
		return m ? stringExpr(m[1]) : null;
	};
	const parts = /^cn\(([\s\S]*)\)$/.exec(inner)?.[1].split(",").map((part) => part.trim()) ?? [inner];
	const exprs = parts.map((part) => (part.startsWith('"') ? { value: part.slice(1, -1) } : derived(part)));
	if (exprs.some((expr) => expr === null)) return null;
	const conds = exprs.filter((expr) => expr.cases);
	const fixed = exprs.filter((expr) => !expr.cases).map((expr) => expr.value).join(" ");
	if (conds.length > 1) return null;
	if (!conds.length) return { value: fixed };
	const join = (value) => `${fixed} ${value}`.trim();
	return { cases: conds[0].cases.map((c) => ({ ...c, value: join(c.value) })), else: join(conds[0].else) };
}

const SMALL = /\bsize-(\d+)\b/;
/** small: an icon-size frame (a fixed `size-N`, N <= 12, i.e. up to 48px); large: every other frame (it follows its column). */
const sizeOf = (cls) => {
	const m = SMALL.exec(cls);
	return m && Number(m[1]) <= 12 ? "small" : "large";
};
const mapExpr = (expr, fn) => (expr.cases ? { cases: expr.cases.map((c) => ({ ...c, value: fn(c.value) })), else: fn(expr.else) } : { value: fn(expr.value) });

/**
 * The pictures each list record of a block draws, read from the registry block itself (every `<MediaFrame>` inside an
 * `{#each <list> as <row>}` whose src is a row field): the list prop, the picture field, the alt field, the frame ratio and
 * its size class (small = icon size, a fixed size-N up to 48px; large = a frame that follows its column; logo = a brand logo,
 * the loop body marks it data-slot="logo"), each a literal or a case of one layout prop. Never listed by hand: Media mode draws the large ones (ADR 0063).
 */
export function derivePictures(root, snapshot) {
	const out = {};
	for (const item of snapshot.blocks ?? []) {
		const text = readFileSync(join(root, "registry/svelte/src/blocks", `${item}.svelte`), "utf8");
		const loops = [...text.matchAll(/\{#each\s+([\w$]+)\s+as\s+([\w$]+)/g)].map((m) => ({ at: m.index, list: m[1], row: m[2] }));
		const records = [];
		for (const frame of text.matchAll(/<MediaFrame\b([^>]*?)\/>/g)) {
			const attrs = Object.fromEntries([...frame[1].matchAll(/([\w-]+)=("[^"]*"|\{[^}]*\}(?:\))?)/g)].map((m) => [m[1], m[2]]));
			const src = /^\{([\w$]+)\.([\w$]+)\}$/.exec(attrs.src ?? "");
			if (!src) continue;
			const loop = loops.filter((l) => l.at < frame.index && l.row === src[1]).at(-1);
			if (!loop) continue;
			const alt = /^\{[\w$]+\.([\w$]+)\}$/.exec(attrs.alt ?? "")?.[1] ?? "title";
			const ratio = attrs.ratio ? attrExpr(text, attrs.ratio) : { value: "16/9" };
			const cls = attrExpr(text, attrs.class) ?? { value: "" };
			if (!ratio) throw new Error(`${item}: MediaFrame ratio ${attrs.ratio} is not a literal or a one-prop case`);
			// a brand logo is the brand's own asset, never drawn: the loop body marks it data-slot="logo"
			const logo = /data-slot="logo"/.test(text.slice(loop.at, frame.index));
			records.push({ list: loop.list, field: src[2], alt, ratio, size: logo ? { value: "logo" } : mapExpr(cls, sizeOf) });
		}
		if (records.length) out[item] = records;
	}
	return { format: "buildy-record-pictures", version: 1, blocks: out };
}

/**
 * The catalog the chat shows (ADR 0059): the configured blocks in config order, each with its registry title and
 * description, its category (the registry `meta.group`), its block-contract/v1 and its content model. Nothing hand-written.
 */
export function deriveBlocks(root, snapshot) {
	const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
	const blocks = (snapshot.blocks ?? []).map((item) => {
		const graph = snapshot.items[item];
		const pins = snapshot.contracts[item];
		const contract = readJson(pins.contract);
		const model = readJson(pins.model);
		if (contract.item !== item) throw new Error(`${pins.contract}: item ${contract.item} != ${item}`);
		return {
			item,
			title: graph.title ?? item,
			description: graph.description ?? "",
			category: graph.meta?.group ?? "content",
			prototype: `${item}.svelte`,
			contract,
			model
		};
	});
	// One digest of everything the catalog pins (registry files, contracts, models, prototypes): traces and the contract fingerprint name it.
	const digest = `sha256:${hex(JSON.stringify({ files: snapshot.files, blocks }))}`;
	return { format: "buildy-catalog-blocks", version: 1, registry: snapshot.registry, prototypes: snapshot.prototypes, digest, blocks };
}

export function deriveRegistryArtifacts(root) {
	const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
	const props = readJson("registry/props.v0.json");
	return {
		[SOURCES_JSON]: json(
			deriveSources({
				snapshot: readJson("registry/snapshot.json"),
				variants: readJson("registry/variants.v0.json"),
				props,
				lock: readJson("registry/svelte/ui8kit.lock.json")
			})
		),
		[PROPS_JSON]: `${JSON.stringify(compactProps(props))}\n`,
		[MONEY_JSON]: json({ format: "buildy-money-names", unit: "minor", names: deriveMoneyNames(root) }),
		[BLOCKS_JSON]: json(deriveBlocks(root, readJson("registry/snapshot.json"))),
		[PICTURES_JSON]: json(derivePictures(root, readJson("registry/snapshot.json")))
	};
}

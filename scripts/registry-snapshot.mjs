/**
 * Pinned UI8Kit registry snapshot: the registry is the single source of UI for the chat (.project/adr/0008-registry-single-source-of-ui.md).
 *
 *   node scripts/registry-snapshot.mjs            network: run the real CLI (`npx ui8kit@CLI init --yes --framework svelte`,
 *                                                 then `add --all`) in a clean temp project, copy its tree to registry/svelte,
 *                                                 pin the registry index and the published variants (sha256-verified),
 *                                                 then regenerate sources.json
 *   node scripts/registry-snapshot.mjs --sources  offline: regenerate packages/builder-core/src/catalog/sources.json
 *   node scripts/registry-snapshot.mjs --check    offline: every file under registry/svelte matches ui8kit.lock.json
 *                                                 (sha256, CRLF as LF, no extra or missing file), variants sha256, sources fresh
 *
 * Outputs (all generated, never edited by hand):
 *   registry/svelte/{ui8kit.config.json,ui8kit.lock.json,src/**}   exactly what the CLI writes in a clean Svelte project
 *   registry/snapshot.json                                         CLI version, index pin, init items, item graph, npm deps
 *   registry/variants.v0.json                                      registry.buildy.tw/variants/v0.json (catalog asset <-> item, variant props)
 *   packages/builder-core/src/catalog/sources.json                 what the chat reads (no Svelte, browser-safe)
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = "ui8kit@3.4.1";
const REGISTRY = "https://registry.buildy.tw";
const RUNTIME = "svelte";
const VARIANTS_URL = `${REGISTRY}/variants/v0.json`;
const KIT = join(ROOT, "registry/svelte");
const SNAPSHOT = join(ROOT, "registry/snapshot.json");
const VARIANTS = join(ROOT, "registry/variants.v0.json");
const SOURCES_JSON = join(ROOT, "packages/builder-core/src/catalog/sources.json");
/** What the CLI writes besides package.json / package-lock.json / node_modules (those belong to the app). */
const KIT_ENTRIES = ["ui8kit.config.json", "ui8kit.lock.json", "src"];

const hex = (text) => createHash("sha256").update(text).digest("hex");
const json = (value) => `${JSON.stringify(value, null, "\t")}\n`;

function write(path, content) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
}

function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) out.push(...walk(path));
		else out.push(path);
	}
	return out;
}

async function fetchText(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	return res.text();
}

function cli(cwd, args) {
	execFileSync("npx", ["--yes", CLI, ...args], { cwd, stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, CI: "1" } });
}

/** Object types declared in the registry sources (`export type X = { ... }` in .ts files and Svelte module scripts). */
function typeTable() {
	const table = {};
	for (const path of walk(join(KIT, "src"))) {
		const text = readFileSync(path, "utf8");
		const indent = path.endsWith(".svelte") ? "  " : "";
		const pattern = new RegExp(`^${indent}export type (\\w+) = \\{\\n([\\s\\S]*?)\\n${indent}\\};`, "gm");
		for (const [, name, body] of text.matchAll(pattern)) {
			const fields = [...body.matchAll(new RegExp(`^${indent}  ([A-Za-z_][A-Za-z0-9_]*)(\\?)?: (.+);$`, "gm"))].map(([, field, optional, type]) => ({
				name: field,
				type,
				required: !optional
			}));
			const key = name;
			if (table[key] && JSON.stringify(table[key]) !== JSON.stringify(fields)) throw new Error(`type ${name} is declared twice with different fields`);
			table[key] = fields;
		}
	}
	return table;
}

/** "addToCart" -> "Add to cart": a readable placeholder for a required label the model content does not fill. */
function humanize(name) {
	const words = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Strings the kit parses (Intl currency code, locale) need a valid value, not a label. */
const STRING_DEFAULTS = { currency: "USD", locale: "en", href: "#", id: "item" };

/** Default value of a required prop by its TS type: the smallest value the organism renders without throwing. */
function defaultOf(type, name, table, depth = 0) {
	const t = type.trim();
	const parts = t.split("|").map((part) => part.trim()).filter((part) => part && part !== "undefined" && part !== "null");
	if (parts.length > 1) {
		const literal = parts.find((part) => /^"[^"]*"$/.test(part) || /^-?\d+(\.\d+)?$/.test(part));
		if (literal) return JSON.parse(literal);
		return defaultOf(parts[0], name, table, depth);
	}
	if (/^"[^"]*"$/.test(t) || /^-?\d+(\.\d+)?$/.test(t)) return JSON.parse(t);
	if (t === "string") return STRING_DEFAULTS[name] ?? humanize(name);
	if (t === "number") return 0;
	if (t === "boolean") return false;
	if (t.endsWith("[]") || t.startsWith("Array<") || t.startsWith("readonly ")) return [];
	if (t.startsWith("Record<")) return {};
	if (table[t] && depth < 4) return objectOf(table[t], table, depth + 1);
	return undefined;
}

function objectOf(fields, table, depth) {
	const out = {};
	for (const field of fields) {
		if (!field.required) continue;
		const value = defaultOf(field.type, field.name, table, depth);
		if (value !== undefined) out[field.name] = value;
	}
	return out;
}

/** `XxxProps` of a registry block: prop name, TS type text, required. */
function propsOf(source, organism) {
	const start = source.indexOf(`export type ${organism}Props = {`);
	if (start < 0) return null;
	const body = source.slice(start, source.indexOf("\n  };", start));
	return [...body.matchAll(/^ {4}([A-Za-z_][A-Za-z0-9_]*)(\?)?: (.+);$/gm)].map(([, name, optional, type]) => ({ name, type, required: !optional }));
}

function sources() {
	const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
	const variantsText = readFileSync(VARIANTS, "utf8");
	const variants = JSON.parse(variantsText);
	const lock = JSON.parse(readFileSync(join(KIT, "ui8kit.lock.json"), "utf8"));
	const blocks = {};
	const assets = {};
	const table = typeTable();
	for (const [item, entry] of Object.entries(variants.items)) {
		const graph = snapshot.items[item];
		if (!graph || graph.type !== "registry:block") throw new Error(`variants item ${item} is not a block of the snapshot`);
		const organism = graph.files.find((file) => file.startsWith("src/blocks/") && file.endsWith(".svelte"));
		if (!organism) throw new Error(`${item}: no blocks/*.svelte in the snapshot`);
		const props = propsOf(readFileSync(join(KIT, organism), "utf8"), entry.organism);
		if (!props) throw new Error(`${item}: no export type ${entry.organism}Props in ${organism}`);
		blocks[item] = {
			spec: entry.spec,
			organism: organism.slice("src/".length),
			organismName: entry.organism,
			defaultVariant: entry.defaultVariant,
			variants: Object.fromEntries(Object.entries(entry.variants).map(([id, variant]) => [id, variant.props])),
			props: props.map((prop) => prop.name),
			// Required props filled with type defaults; page content and variant props are merged over them.
			defaults: objectOf(props, table, 0),
			// Text props by name and the list props whose records the page block's children become.
			lists: Object.fromEntries(
				props.flatMap((prop) => {
					const record = /^(\w+)\[\]$/.exec(prop.type)?.[1];
					if (!record || !table[record]) return [];
					return [[prop.name, { required: prop.required, record: Object.fromEntries(table[record].map((field) => [field.name, field.type])), defaults: objectOf(table[record], table, 1) }]];
				})
			),
			objects: Object.fromEntries(
				props.flatMap((prop) => (table[prop.type] ? [[prop.name, table[prop.type].map((field) => field.name)]] : []))
			)
		};
		for (const [id, variant] of Object.entries(entry.variants)) {
			if (assets[variant.asset]) throw new Error(`asset ${variant.asset} maps to two items`);
			assets[variant.asset] = { item, variant: id };
		}
	}
	// Catalog block without a variant: the default variant of the first item of its spec (variants file order).
	const specs = {};
	for (const [item, block] of Object.entries(blocks)) specs[block.spec] ??= { item, variant: block.defaultVariant };
	const lucide = readFileSync(join(KIT, "src/icons/lucide-icons.ts"), "utf8");
	const icons = [...lucide.matchAll(/^ {2}"([a-z0-9-]+)": \[/gm)].map((match) => match[1]);
	return {
		format: "buildy-catalog-sources",
		version: 2,
		registry: snapshot.registry,
		cli: snapshot.cli,
		lockDigest: `sha256:${hex(JSON.stringify(lock))}`,
		variants: { url: snapshot.variants.url, sha256: snapshot.variants.sha256, digest: variants.digest },
		initItems: snapshot.initItems,
		npmDependencies: snapshot.npmDependencies,
		items: snapshot.items,
		blocks,
		assets,
		specs,
		icons
	};
}

function check() {
	let bad = 0;
	const fail = (message) => {
		console.error(message);
		bad += 1;
	};
	const lock = JSON.parse(readFileSync(join(KIT, "ui8kit.lock.json"), "utf8"));
	const locked = new Map();
	for (const item of Object.values(lock.items)) for (const [path, sha] of Object.entries(item.files)) locked.set(path, sha);
	const disk = walk(join(KIT, "src")).map((path) => relative(KIT, path).split("\\").join("/"));
	for (const path of disk) {
		const sha = locked.get(path);
		if (!sha) fail(`not in ui8kit.lock.json: ${path}`);
		else if (hex(readFileSync(join(KIT, path), "utf8").replace(/\r\n/g, "\n")) !== sha) fail(`modified: ${path}`);
	}
	for (const path of locked.keys()) if (!disk.includes(path)) fail(`missing: ${path}`);
	const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
	if (hex(readFileSync(VARIANTS)) !== snapshot.variants.sha256) fail("variants.v0.json sha256 differs from registry/snapshot.json");
	if (readFileSync(SOURCES_JSON, "utf8") !== json(sources())) fail("sources.json is stale (node scripts/registry-snapshot.mjs --sources)");
	console.log(`${Object.keys(lock.items).length} items, ${locked.size} files: ${bad ? `${bad} problem(s)` : "all sha256 match"}`);
	return bad === 0;
}

async function snapshot() {
	const tmp = mkdtempSync(join(tmpdir(), "ui8kit-snapshot-"));
	try {
		write(join(tmp, "package.json"), json({ name: "registry-snapshot", private: true, type: "module" }));
		cli(tmp, ["init", "--yes", "--framework", RUNTIME]);
		const initLock = JSON.parse(readFileSync(join(tmp, "ui8kit.lock.json"), "utf8"));
		const initItems = Object.values(initLock.items).map((item) => item.name).sort();
		cli(tmp, ["add", "--all"]);
		const pkg = JSON.parse(readFileSync(join(tmp, "package.json"), "utf8"));
		rmSync(KIT, { recursive: true, force: true });
		for (const entry of KIT_ENTRIES) cpSync(join(tmp, entry), join(KIT, entry), { recursive: true });

		const indexUrl = `${REGISTRY}/${RUNTIME}/index.json`;
		const indexText = await fetchText(indexUrl);
		const index = JSON.parse(indexText);
		const lock = JSON.parse(readFileSync(join(KIT, "ui8kit.lock.json"), "utf8"));
		const items = {};
		const npm = new Set(Object.keys(pkg.dependencies ?? {}));
		for (const component of index.components) {
			const locked = Object.values(lock.items).find((item) => item.name === component.name);
			if (!locked) throw new Error(`${component.name} is in the index but was not installed`);
			items[component.name] = {
				type: component.type,
				registryDependencies: component.registryDependencies ?? [],
				dependencies: component.dependencies ?? [],
				files: Object.keys(locked.files).sort()
			};
			for (const dep of component.dependencies ?? []) npm.add(dep);
		}
		const variantsText = await fetchText(VARIANTS_URL);
		const published = (await fetchText(`${VARIANTS_URL}.sha256`)).trim().split(/\s+/)[0];
		if (hex(variantsText) !== published) throw new Error(`${VARIANTS_URL}: sha256 ${hex(variantsText)} != published ${published}`);
		write(VARIANTS, variantsText);
		write(
			SNAPSHOT,
			json({
				format: "buildy-registry-snapshot",
				version: 1,
				cli: CLI,
				registry: `${REGISTRY}/${RUNTIME}`,
				index: { url: indexUrl, sha256: hex(indexText), lastUpdated: index.lastUpdated, version: index.version },
				variants: { url: VARIANTS_URL, sha256: published },
				initItems,
				npmDependencies: [...npm].sort(),
				items
			})
		);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
	write(SOURCES_JSON, json(sources()));
	check();
}

if (process.argv.includes("--check")) process.exit(check() ? 0 : 1);
else if (process.argv.includes("--sources")) write(SOURCES_JSON, json(sources()));
else await snapshot();

/**
 * Pinned UI8Kit registry snapshot: the registry is the single source of UI for the chat (.project/adr/0008-registry-single-source-of-ui.md).
 *
 *   node scripts/registry-snapshot.mjs            network: run the real CLI (`npx ui8kit@CLI init --yes --framework svelte`,
 *                                                 then `add --all`) in a clean temp project, copy its tree to registry/svelte,
 *                                                 pin the registry index, the published variants and the published props
 *                                                 schemas (file sha256 = `.sha256` sidecar = registry manifest, internal
 *                                                 digest recomputed), then regenerate sources.json and props.json
 *   node scripts/registry-snapshot.mjs --sources  offline: regenerate packages/builder-core/src/catalog/{sources,props}.json
 *   node scripts/registry-snapshot.mjs --check    offline: every file under registry/svelte matches ui8kit.lock.json
 *                                                 (sha256, CRLF as LF, no extra or missing file), variants and props sha256,
 *                                                 props digest, a props schema per variants item, sources / props fresh
 *
 * Outputs (all generated, never edited by hand):
 *   registry/svelte/{ui8kit.config.json,ui8kit.lock.json,src/**}   exactly what the CLI writes in a clean Svelte project
 *   registry/snapshot.json                                         CLI version, index pin, init items, item graph, npm deps
 *   registry/variants.v0.json                                      registry.buildy.tw/variants/v0.json (catalog asset <-> item, variant props)
 *   registry/props.v0.json                                         registry.buildy.tw/props/v0.json (JSON Schema 2020-12 of each block's props,
 *                                                                  its events and slots)
 *   packages/builder-core/src/catalog/sources.json                 what the chat reads (no Svelte, browser-safe): item graph, variants and
 *                                                                  the prop shape of each block derived from its props schema
 *   packages/builder-core/src/catalog/props.json                   the props schemas with their shared $defs stored once (lossless; the
 *                                                                  gate rebuilds each schema byte-for-byte); loaded lazily in the browser
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** Pins come from the one catalog config (.project/adr/0012-unified-catalog-snapshot.md). */
const PINS = JSON.parse(readFileSync(join(ROOT, "catalog/snapshot.config.json"), "utf8")).ui8kit;
const CLI = PINS.cli;
const REGISTRY = PINS.registry;
const RUNTIME = PINS.runtime;
const VARIANTS_URL = `${REGISTRY}/variants/v0.json`;
const PROPS_URL = `${REGISTRY}/props/v0.json`;
const MANIFEST_URL = `${REGISTRY}/manifest.json`;
const KIT = join(ROOT, "registry/svelte");
const SNAPSHOT = join(ROOT, "registry/snapshot.json");
const VARIANTS = join(ROOT, "registry/variants.v0.json");
const PROPS = join(ROOT, "registry/props.v0.json");
const SOURCES_JSON = join(ROOT, "packages/builder-core/src/catalog/sources.json");
const PROPS_JSON = join(ROOT, "packages/builder-core/src/catalog/props.json");
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

/**
 * The pinned CLI (`npx ui8kit@<pin>`). UI8KIT_CLI_BIN=<checkout>/dist/index.js runs a local build of the same release
 * instead (when the npm package is not published yet); its `--version` must equal the pin.
 */
function cli(cwd, args) {
	const bin = process.env.UI8KIT_CLI_BIN;
	const env = { ...process.env, CI: "1" };
	if (bin) {
		const version = execFileSync("node", [bin, "--version"], { encoding: "utf8" }).trim();
		if (`ui8kit@${version}` !== CLI) throw new Error(`UI8KIT_CLI_BIN is ui8kit@${version}, the pin is ${CLI}`);
		execFileSync("node", [bin, ...args], { cwd, stdio: ["ignore", "ignore", "inherit"], env });
		return;
	}
	execFileSync("npx", ["--yes", CLI, ...args], { cwd, stdio: ["ignore", "ignore", "inherit"], env });
}

/** Skins (registry:theme items, `add theme-<skin>`; `add --all` leaves them out): skin id -> item, title and CSS file. */
function themesOf(snapshot) {
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
function propsDigest(props) {
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

function compactProps(props) {
	const defs = {};
	const items = {};
	for (const [item, entry] of Object.entries(props.items)) {
		const { $defs = {}, ...schema } = entry.schema;
		for (const [name, def] of Object.entries($defs)) {
			if (defs[name] && JSON.stringify(defs[name]) !== JSON.stringify(def)) throw new Error(`$defs/${name} differs between items (${item})`);
			defs[name] = def;
		}
		// Key order of the published $defs, so the rebuilt schema serializes byte-for-byte like the pinned one.
		items[item] = { organism: entry.organism, events: entry.events, slots: entry.slots, schema, defs: Object.keys($defs) };
		const reached = reachedDefs(entry.schema, $defs);
		if (reached.size !== Object.keys($defs).length) throw new Error(`${item}: $defs has entries its schema never reaches`);
	}
	return { format: "buildy-props-compact", version: 1, registry: props.registry, propsVersion: props.version, digest: props.digest, defs, items };
}

/** The pinned item schema rebuilt from the compact file (same as props-schema.ts schemaFor). */
function rebuiltSchema(compact, item) {
	const entry = compact.items[item];
	return { ...entry.schema, $defs: Object.fromEntries(entry.defs.map((name) => [name, compact.defs[name]])) };
}

function sources() {
	const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
	const variants = JSON.parse(readFileSync(VARIANTS, "utf8"));
	const props = JSON.parse(readFileSync(PROPS, "utf8"));
	const lock = JSON.parse(readFileSync(join(KIT, "ui8kit.lock.json"), "utf8"));
	const blocks = {};
	const assets = {};
	for (const [item, entry] of Object.entries(variants.items)) {
		const graph = snapshot.items[item];
		if (!graph || graph.type !== "registry:block") throw new Error(`variants item ${item} is not a block of the snapshot`);
		const organism = graph.files.find((file) => file.startsWith("src/blocks/") && file.endsWith(".svelte"));
		if (!organism) throw new Error(`${item}: no blocks/*.svelte in the snapshot`);
		const schema = props.items[item];
		if (!schema) throw new Error(`${item}: no props schema in ${PROPS_URL}`);
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

function writeSources() {
	write(SOURCES_JSON, json(sources()));
	write(PROPS_JSON, `${JSON.stringify(compactProps(JSON.parse(readFileSync(PROPS, "utf8"))))}\n`);
}

/** Published props file: sha256 of the bytes, then the internal digest (compact JSON without `digest`). */
function verifyProps(text, expected) {
	const problems = [];
	const props = JSON.parse(text);
	if (hex(text) !== expected.sha256) problems.push(`props sha256 ${hex(text)} != ${expected.sha256}`);
	if (props.digest !== expected.digest) problems.push(`props digest ${props.digest} != ${expected.digest}`);
	if (propsDigest(props) !== props.digest) problems.push(`props digest recomputed ${propsDigest(props)} != published ${props.digest}`);
	if (expected.items !== undefined && Object.keys(props.items).length !== expected.items) problems.push(`props items ${Object.keys(props.items).length} != ${expected.items}`);
	return problems;
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
	if (!snapshot.props) fail("registry/snapshot.json pins no props schemas (node scripts/registry-snapshot.mjs)");
	else {
		const propsText = readFileSync(PROPS, "utf8");
		for (const problem of verifyProps(propsText, snapshot.props)) fail(`props.v0.json: ${problem}`);
		const props = JSON.parse(propsText);
		const variants = JSON.parse(readFileSync(VARIANTS, "utf8"));
		for (const item of Object.keys(variants.items)) if (!props.items[item]) fail(`variants item ${item} has no props schema`);
		const compact = compactProps(props);
		for (const item of Object.keys(props.items)) {
			if (JSON.stringify(rebuiltSchema(compact, item)) !== JSON.stringify(props.items[item].schema)) fail(`props.json does not rebuild the schema of ${item}`);
		}
		if (!existsSync(PROPS_JSON) || readFileSync(PROPS_JSON, "utf8") !== `${JSON.stringify(compact)}\n`) fail("props.json is stale (node scripts/registry-snapshot.mjs --sources)");
	}
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
		// skins are a choice, so `--all` leaves them out: install every theme item of the index explicitly
		const themeNames = JSON.parse(await fetchText(`${REGISTRY}/${RUNTIME}/index.json`)).components.filter((c) => c.type === "registry:theme").map((c) => c.name);
		if (themeNames.length) cli(tmp, ["add", ...themeNames]);
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
				...(component.type === "registry:theme" ? { title: component.title } : {}),
				registryDependencies: component.registryDependencies ?? [],
				dependencies: component.dependencies ?? [],
				files: Object.keys(locked.files).sort()
			};
			for (const dep of component.dependencies ?? []) npm.add(dep);
		}
		const variantsText = await fetchText(VARIANTS_URL);
		const published = (await fetchText(`${VARIANTS_URL}.sha256`)).trim().split(/\s+/)[0];
		if (hex(variantsText) !== published) throw new Error(`${VARIANTS_URL}: sha256 ${hex(variantsText)} != published ${published}`);
		const manifest = JSON.parse(await fetchText(MANIFEST_URL));
		if (manifest.variants?.sha256 !== published) throw new Error(`${MANIFEST_URL}: variants sha256 ${manifest.variants?.sha256} != published ${published}`);
		const propsText = await fetchText(PROPS_URL);
		const propsSidecar = (await fetchText(`${PROPS_URL}.sha256`)).trim().split(/\s+/)[0];
		const propsPin = { url: PROPS_URL, sha256: propsSidecar, digest: manifest.props?.digest, items: manifest.props?.items };
		if (manifest.props?.sha256 !== propsSidecar) throw new Error(`${MANIFEST_URL}: props sha256 ${manifest.props?.sha256} != sidecar ${propsSidecar}`);
		const problems = verifyProps(propsText, propsPin);
		if (problems.length) throw new Error(`${PROPS_URL}: ${problems.join("; ")}`);
		write(VARIANTS, variantsText);
		write(PROPS, propsText);
		write(
			SNAPSHOT,
			json({
				format: "buildy-registry-snapshot",
				version: 1,
				cli: CLI,
				registry: `${REGISTRY}/${RUNTIME}`,
				index: { url: indexUrl, sha256: hex(indexText), lastUpdated: index.lastUpdated, version: index.version },
				variants: { url: VARIANTS_URL, sha256: published },
				props: propsPin,
				manifest: { url: MANIFEST_URL, contractVersion: manifest.contractVersion, version: manifest.version },
				initItems,
				npmDependencies: [...npm].sort(),
				items
			})
		);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
	writeSources();
	if (!check()) process.exitCode = 1;
}

if (process.argv.includes("--check")) process.exit(check() ? 0 : 1);
else if (process.argv.includes("--sources")) writeSources();
else await snapshot();

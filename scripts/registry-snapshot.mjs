/**
 * The pinned catalog (ADR 0059): the UI8Kit registry is the single source of UI (ADR 0008) and the simple-line blocks listed
 * in catalog/snapshot.config.json are the whole catalog. Their prototypes (wireframes, rectangles only) come from
 * ui8kit/prototypes at a pinned commit.
 *
 *   node scripts/registry-snapshot.mjs            network: run the real CLI (`npx ui8kit@CLI init --yes --framework svelte`,
 *                                                 then `add` the kit primitives, lib and utils, the theme items, the
 *                                                 configured components and blocks) in a clean temp project, copy its tree to registry/svelte,
 *                                                 pin the published variants and props (sha256 = sidecar = manifest, then
 *                                                 narrowed to the configured blocks), their contracts and models (sha256 of the
 *                                                 registry manifest) and the prototypes (sha256 of the prototypes manifest),
 *                                                 then derive the browser artifacts
 *   node scripts/registry-snapshot.mjs --derive   offline: rewrite the derived artifacts from the pinned files
 *   node scripts/registry-snapshot.mjs --check    offline: every pinned file matches its sha256 and every derived artifact is fresh
 *
 * Outputs (all generated, never edited by hand):
 *   registry/svelte/{ui8kit.config.json,ui8kit.lock.json,src/**}   exactly what the CLI writes in a clean Svelte project
 *   registry/snapshot.json                                         pins, item graph, the sha256 of every pinned file
 *   registry/variants.v0.json, registry/props.v0.json              the published files narrowed to the configured blocks
 *   registry/contracts/<item>/<n>.json                             block-contract/v1 of each block
 *   registry/models/<id>.schema.json                               the content model of each block (JSON Schema 2020-12)
 *   prototypes/svelte/**, prototypes/tokens.css                    the generated wireframes of ui8kit/prototypes
 *   packages/builder-core/src/catalog/{sources,props,money,blocks}.json   derived (scripts/lib/registry-derive.mjs)
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { compactProps, deriveRegistryArtifacts, hex, json, rebuiltSchema } from "./lib/registry-derive.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = JSON.parse(readFileSync(join(ROOT, "catalog/snapshot.config.json"), "utf8"));
const PINS = CONFIG.ui8kit;
const PROTO = CONFIG.prototypes;
const CLI = PINS.cli;
const REGISTRY = PINS.registry;
const RUNTIME = PINS.runtime;
const BLOCKS = PINS.blocks;
const VARIANTS_URL = `${REGISTRY}/variants/v0.json`;
const PROPS_URL = `${REGISTRY}/props/v0.json`;
const MANIFEST_URL = `${REGISTRY}/manifest.json`;
const KIT = join(ROOT, "registry/svelte");
const SNAPSHOT = join(ROOT, "registry/snapshot.json");
const VARIANTS = join(ROOT, "registry/variants.v0.json");
const PROPS = join(ROOT, "registry/props.v0.json");
const PROTOTYPES = join(ROOT, "prototypes");
/** What the CLI writes besides package.json / package-lock.json / node_modules (those belong to the app). */
const KIT_ENTRIES = ["ui8kit.config.json", "ui8kit.lock.json", "src"];

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

/** A file whose sha256 is published next to it: fetch, compare, return the text. */
async function fetchPinned(url, sha256) {
	const text = await fetchText(url);
	if (hex(text) !== sha256) throw new Error(`${url}: sha256 ${hex(text)} != ${sha256}`);
	return text;
}

/**
 * The pinned CLI (`npx ui8kit@<pin>`). UI8KIT_CLI_BIN=<checkout>/dist/index.js runs a local build of the same release
 * instead; its `--version` must equal the pin.
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

function writeDerived() {
	for (const [path, text] of Object.entries(deriveRegistryArtifacts(ROOT))) write(join(ROOT, path), text);
}

/** Every pinned file (path relative to the repo root) -> sha256, as recorded in registry/snapshot.json. */
function pinnedFiles(snapshot) {
	return { ...snapshot.files };
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
	if (JSON.stringify(snapshot.blocks) !== JSON.stringify(BLOCKS)) fail(`registry/snapshot.json blocks differ from catalog/snapshot.config.json (npm run snapshot)`);
	if (snapshot.cli !== CLI) fail(`registry/snapshot.json cli ${snapshot.cli} != ${CLI}`);
	if (snapshot.prototypes?.commit !== PROTO.commit) fail(`registry/snapshot.json prototypes commit differs from the config (npm run snapshot)`);
	const files = pinnedFiles(snapshot);
	for (const [path, sha] of Object.entries(files)) {
		if (!existsSync(join(ROOT, path))) fail(`missing pinned file: ${path}`);
		else if (hex(readFileSync(join(ROOT, path), "utf8")) !== sha) fail(`modified pinned file: ${path}`);
	}
	const proto = walk(PROTOTYPES).map((path) => relative(ROOT, path).split("\\").join("/"));
	for (const path of proto) if (!files[path]) fail(`not pinned: ${path}`);
	const props = JSON.parse(readFileSync(PROPS, "utf8"));
	const variants = JSON.parse(readFileSync(VARIANTS, "utf8"));
	for (const item of BLOCKS) {
		if (!variants.items[item]) fail(`variants: no item ${item}`);
		if (!props.items[item]) fail(`props: no item ${item}`);
	}
	const compact = compactProps(props);
	for (const item of Object.keys(props.items)) {
		if (JSON.stringify(rebuiltSchema(compact, item)) !== JSON.stringify(props.items[item].schema)) fail(`props.json does not rebuild the schema of ${item}`);
	}
	for (const [path, text] of Object.entries(deriveRegistryArtifacts(ROOT))) {
		if (!existsSync(join(ROOT, path)) || readFileSync(join(ROOT, path), "utf8") !== text) fail(`${path} is stale (npm run snapshot:derive)`);
	}
	console.log(`snapshot --check: ${Object.keys(lock.items).length} kit items, ${BLOCKS.length} blocks, ${Object.keys(files).length} pinned files: ${bad ? `${bad} problem(s)` : "all match"}`);
	return bad === 0;
}

const narrow = (doc, names) => ({ ...doc, items: Object.fromEntries(Object.entries(doc.items).filter(([name]) => names.includes(name))) });

async function snapshot() {
	const tmp = mkdtempSync(join(tmpdir(), "ui8kit-snapshot-"));
	const files = {};
	const pin = (path, text) => {
		write(join(ROOT, path), text);
		files[path] = hex(text);
	};
	try {
		const indexUrl = `${REGISTRY}/${RUNTIME}/index.json`;
		const indexText = await fetchText(indexUrl);
		const index = JSON.parse(indexText);
		const byName = new Map(index.components.map((c) => [c.name, c]));
		for (const block of BLOCKS) if (byName.get(block)?.type !== "registry:block") throw new Error(`${block} is not a block of ${indexUrl}`);
		// the kit (primitives, lib, utils), the skins, the components the app chrome imports and only the configured blocks;
		// the CLI adds what they depend on
		const KIT_TYPES = new Set(["registry:ui", "registry:lib", "registry:utils", "registry:theme"]);
		const wanted = index.components
			.filter((c) => KIT_TYPES.has(c.type) || BLOCKS.includes(c.name) || (PINS.components ?? []).includes(c.name))
			.map((c) => c.name);

		write(join(tmp, "package.json"), json({ name: "registry-snapshot", private: true, type: "module" }));
		cli(tmp, ["init", "--yes", "--framework", RUNTIME]);
		const initLock = JSON.parse(readFileSync(join(tmp, "ui8kit.lock.json"), "utf8"));
		const initItems = Object.values(initLock.items).map((item) => item.name).sort();
		cli(tmp, ["add", ...wanted]);
		const pkg = JSON.parse(readFileSync(join(tmp, "package.json"), "utf8"));
		rmSync(KIT, { recursive: true, force: true });
		for (const entry of KIT_ENTRIES) cpSync(join(tmp, entry), join(KIT, entry), { recursive: true });

		const lock = JSON.parse(readFileSync(join(KIT, "ui8kit.lock.json"), "utf8"));
		const installed = new Map(Object.values(lock.items).map((item) => [item.name, item]));
		const items = {};
		const npm = new Set(Object.keys(pkg.dependencies ?? {}));
		for (const component of index.components) {
			const locked = installed.get(component.name);
			if (!locked) continue;
			items[component.name] = {
				type: component.type,
				...(component.title ? { title: component.title } : {}),
				...(component.description ? { description: component.description } : {}),
				registryDependencies: component.registryDependencies ?? [],
				dependencies: component.dependencies ?? [],
				files: Object.keys(locked.files).sort()
			};
			for (const dep of component.dependencies ?? []) npm.add(dep);
		}
		for (const block of BLOCKS) {
			if (!items[block]) throw new Error(`${block} was not installed`);
			const item = JSON.parse(await fetchText(`${REGISTRY}/${RUNTIME}/blocks/${block}.json`));
			items[block].meta = item.meta ?? {};
		}

		const manifest = JSON.parse(await fetchText(MANIFEST_URL));
		const variantsText = await fetchText(VARIANTS_URL);
		const variantsSha = (await fetchText(`${VARIANTS_URL}.sha256`)).trim().split(/\s+/)[0];
		if (hex(variantsText) !== variantsSha || manifest.variants?.sha256 !== variantsSha) throw new Error(`${VARIANTS_URL}: sha256 does not match its sidecar and the manifest`);
		const propsText = await fetchText(PROPS_URL);
		const propsSha = (await fetchText(`${PROPS_URL}.sha256`)).trim().split(/\s+/)[0];
		if (hex(propsText) !== propsSha || manifest.props?.sha256 !== propsSha) throw new Error(`${PROPS_URL}: sha256 does not match its sidecar and the manifest`);
		pin("registry/variants.v0.json", json(narrow(JSON.parse(variantsText), BLOCKS)));
		pin("registry/props.v0.json", json(narrow(JSON.parse(propsText), BLOCKS)));

		const contracts = {};
		for (const block of BLOCKS) {
			const entry = Object.values(manifest.contracts.items).find((c) => c.path.startsWith(`contracts/${block}/`));
			if (!entry) throw new Error(`${MANIFEST_URL}: no contract for ${block}`);
			const text = await fetchPinned(`${REGISTRY}/${entry.path}`, entry.sha256);
			pin(`registry/${entry.path}`, text);
			const model = manifest.models[entry.model];
			if (!model) throw new Error(`${MANIFEST_URL}: no model ${entry.model}`);
			pin(`registry/${model.path}`, await fetchPinned(`${REGISTRY}/${model.path}`, model.sha256));
			contracts[block] = { contract: `registry/${entry.path}`, model: `registry/${model.path}` };
		}

		const raw = `https://raw.githubusercontent.com/${PROTO.repo}/${PROTO.commit}`;
		const protoManifest = JSON.parse(await fetchText(`${raw}/${PROTO.generated}/manifest.json`));
		rmSync(PROTOTYPES, { recursive: true, force: true });
		for (const [file, sha] of Object.entries(protoManifest.files)) {
			if (!file.startsWith("svelte/blocks/") && !file.startsWith("svelte/shapes/")) continue;
			const owner = protoManifest.items.find((i) => i.svelte === file);
			if (owner && !BLOCKS.includes(owner.item)) continue;
			pin(`prototypes/${file}`, await fetchPinned(`${raw}/${PROTO.generated}/${file}`, sha));
		}
		for (const block of BLOCKS) if (!protoManifest.items.some((i) => i.item === block)) throw new Error(`${PROTO.repo}@${PROTO.commit}: no prototype of ${block}`);
		pin("prototypes/tokens.css", await fetchText(`${raw}/${PROTO.tokens}`));

		write(
			SNAPSHOT,
			json({
				format: "buildy-registry-snapshot",
				version: 2,
				cli: CLI,
				registry: `${REGISTRY}/${RUNTIME}`,
				index: { url: indexUrl, sha256: hex(indexText), lastUpdated: index.lastUpdated, version: index.version },
				variants: { url: VARIANTS_URL, sha256: variantsSha, digest: manifest.variants?.digest },
				props: { url: PROPS_URL, sha256: propsSha, digest: manifest.props?.digest },
				manifest: { url: MANIFEST_URL, contractVersion: manifest.contractVersion, version: manifest.version },
				prototypes: { repo: PROTO.repo, commit: PROTO.commit, generator: protoManifest.generator, inputs: protoManifest.inputs },
				blocks: BLOCKS,
				contracts,
				initItems,
				npmDependencies: [...npm].sort(),
				items,
				files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))
			})
		);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
	writeDerived();
	if (!check()) process.exitCode = 1;
}

if (process.argv.includes("--check")) process.exit(check() ? 0 : 1);
else if (process.argv.includes("--derive")) {
	writeDerived();
	console.log("snapshot --derive: derived artifacts written");
} else await snapshot();

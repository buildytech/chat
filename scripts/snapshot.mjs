/**
 * One catalog snapshot of codegen-x Stock + the UI8Kit registry (.project/adr/0012-unified-catalog-snapshot.md).
 *
 *   npm run snapshot                 network: the pins of catalog/snapshot.config.json ->
 *                                      1. scripts/registry-snapshot.mjs (real `npx ui8kit init` + `add --all`, registry/*)
 *                                      2. fetch every Stock and registry input, sha256 each, cross-check the two sources
 *                                      3. catalog/stock-registry.v0.json (entities + edges), validated
 *                                      4. catalog/coverage.json, snapshot.json, search-index.json (derived from 3 only)
 *                                      5. catalog/snapshot.lock.json (pins, sha256 per input and output), then --check
 *   npm run snapshot -- --skip-cli   same without step 1 (registry/ already current)
 *   npm run snapshot:derive          offline: rewrite EVERY derived artifact (coverage, snapshot, search-index from stock-registry.v0.json
 *                                      + policy; sources, props from the pinned registry files) and the lock
 *   npm run snapshot:check           offline: lock matches every file, graph valid, every derived artifact byte-identical to a
 *                                      fresh derivation (ADR 0039)
 *
 * Generated files are never edited by hand; BuildY policy lives only in catalog/policy.v0.json.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { derived, driftOf } from "./lib/catalog-artifacts.mjs";
import { buildGraph, serialize, sha256, validateGraph } from "./lib/catalog-graph.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = (p) => join(ROOT, p);
const CONFIG = "catalog/snapshot.config.json";
const POLICY = "catalog/policy.v0.json";
const GRAPH = "catalog/stock-registry.v0.json";
const LOCK = "catalog/snapshot.lock.json";
const COVERAGE = "catalog/coverage.json";
const VARIANTS = "registry/variants.v0.json";
const PROPS = "registry/props.v0.json";
const REGISTRY_SNAPSHOT = "registry/snapshot.json";

const read = (p) => readFileSync(path(p), "utf8");
const readJson = (p) => JSON.parse(read(p));
const pretty = (value) => `${JSON.stringify(value, null, "\t")}\n`;

async function fetchText(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	return res.text();
}

/** The codegen-x commit registry.buildy.tw was built from; the Stock commit when the config pins one commit for both. */
const registrySourceCommit = (config) => config.ui8kit.sourceCommit ?? config.codegenX.commit;

/** ahead | identical | behind | diverged: how `head` relates to `base` on GitHub (network mode only). */
async function commitRelation(repo, base, head) {
	const res = await fetch(`https://api.github.com/repos/${repo}/compare/${base}...${head}`, { headers: { accept: "application/vnd.github+json" } });
	if (!res.ok) throw new Error(`compare ${base}...${head}: HTTP ${res.status}`);
	return (await res.json()).status;
}

function lockOf(config, graph, graphText, outputs) {
	const fileSha = (p) => ({ sha256: sha256(read(p)) });
	return {
		format: "buildy-catalog-snapshot-lock",
		version: 0,
		config: { path: CONFIG, sha256: sha256(read(CONFIG)) },
		policy: { path: POLICY, sha256: sha256(read(POLICY)) },
		codegenX: { repo: config.codegenX.repo, commit: config.codegenX.commit, files: graph.sources.codegenX.files },
		ui8kit: {
			cli: config.ui8kit.cli,
			registry: config.ui8kit.registry,
			runtime: config.ui8kit.runtime,
			sourceCommit: graph.sources.ui8kit.sourceCommit,
			files: graph.sources.ui8kit.files,
			pinned: { [VARIANTS]: fileSha(VARIANTS), [PROPS]: fileSha(PROPS), [REGISTRY_SNAPSHOT]: fileSha(REGISTRY_SNAPSHOT) }
		},
		outputs: {
			[GRAPH]: { sha256: sha256(graphText) },
			...Object.fromEntries(Object.entries(outputs).map(([p, text]) => [p, { sha256: sha256(text) }]))
		}
	};
}

async function snapshot() {
	const config = readJson(CONFIG);
	if (!process.argv.includes("--skip-cli")) {
		const run = spawnSync(process.execPath, [path("scripts/registry-snapshot.mjs")], { cwd: ROOT, stdio: "inherit" });
		if (run.status !== 0) throw new Error("scripts/registry-snapshot.mjs failed");
	}
	const { codegenX, ui8kit } = config;
	const texts = { stock: {}, registry: {} };
	await Promise.all([
		...codegenX.files.map(async (file) => {
			texts.stock[file] = await fetchText(`${codegenX.raw}/${codegenX.repo}/${codegenX.commit}/${codegenX.content}/${file}`);
		}),
		...ui8kit.files.map(async (file) => {
			texts.registry[file] = await fetchText(`${ui8kit.registry}/${file}`);
		})
	]);
	const meta = (group) => Object.fromEntries(Object.keys(texts[group]).sort().map((f) => [f, { sha256: sha256(texts[group][f]), bytes: Buffer.byteLength(texts[group][f]) }]));
	const inputs = {
		stock: Object.fromEntries(Object.entries(texts.stock).map(([f, t]) => [f, JSON.parse(t)])),
		registry: Object.fromEntries(Object.entries(texts.registry).map(([f, t]) => [f, JSON.parse(t)]))
	};

	// Cross-checks: the registry was built from the pinned codegen-x commit, both publish the same variants and props,
	// and the CLI snapshot in registry/ pins the same files.
	const problems = [];
	const registryDoc = inputs.registry["registry.json"];
	const manifest = inputs.registry["manifest.json"];
	// Two pins (ADR 0012 addendum): Stock content may run ahead of the registry build when it descends from the registry's
	// source commit and publishes the same variants and props (checked below); anything else is a disagreement.
	const registrySource = registrySourceCommit(config);
	if (registryDoc.sourceCommit !== registrySource) problems.push(`registry.json sourceCommit ${registryDoc.sourceCommit} != ui8kit.sourceCommit ${registrySource} (bump ${CONFIG})`);
	if (registrySource !== codegenX.commit) {
		const relation = await commitRelation(codegenX.repo, registrySource, codegenX.commit);
		if (relation !== "ahead") problems.push(`codegenX.commit ${codegenX.commit} is ${relation} of ui8kit.sourceCommit ${registrySource}; Stock content must descend from the registry build`);
	}
	for (const [stockFile, registryFile, pinned, key] of [
		["variants.v0.json", "variants/v0.json", VARIANTS, "variants"],
		["props.v0.json", "props/v0.json", PROPS, "props"]
	]) {
		const a = sha256(texts.stock[stockFile]);
		const b = sha256(texts.registry[registryFile]);
		if (a !== b) problems.push(`Stock ${stockFile} ${a} != registry ${registryFile} ${b}`);
		if (manifest[key]?.sha256 !== b) problems.push(`manifest.json ${key}.sha256 != ${registryFile}`);
		if (!existsSync(path(pinned)) || sha256(read(pinned)) !== b) problems.push(`${pinned} is not the published ${registryFile} (npm run registry:snapshot)`);
	}
	const cliSnapshot = readJson(REGISTRY_SNAPSHOT);
	if (cliSnapshot.cli !== ui8kit.cli) problems.push(`${REGISTRY_SNAPSHOT} cli ${cliSnapshot.cli} != ${ui8kit.cli}`);
	if (cliSnapshot.index.sha256 !== sha256(texts.registry[`${ui8kit.runtime}/index.json`])) problems.push(`${REGISTRY_SNAPSHOT} index sha256 != live ${ui8kit.runtime}/index.json (npm run registry:snapshot)`);
	if (problems.length) throw new Error(`sources disagree:\n  ${problems.join("\n  ")}`);

	const assets = inputs.stock["assets.v0.json"];
	const pins = {
		runtime: ui8kit.runtime,
		sources: {
			codegenX: { repo: codegenX.repo, commit: codegenX.commit, content: codegenX.content, assetsDigest: assets.digest, assetsVersion: assets.version, files: meta("stock") },
			ui8kit: {
				cli: ui8kit.cli,
				registry: ui8kit.registry,
				runtime: ui8kit.runtime,
				version: registryDoc.version,
				contractVersion: registryDoc.contractVersion,
				lastUpdated: registryDoc.lastUpdated,
				sourceCommit: registryDoc.sourceCommit,
				files: meta("registry")
			}
		}
	};
	const graph = buildGraph(inputs, pins);
	const graphProblems = validateGraph(graph, inputs.registry["props/v0.json"]);
	if (graphProblems.length) throw new Error(`graph invalid:\n  ${graphProblems.slice(0, 40).join("\n  ")}`);
	const graphText = serialize(graph, 3);
	writeFileSync(path(GRAPH), graphText);
	const outputs = derived(ROOT, graph, readJson(POLICY));
	for (const [p, text] of Object.entries(outputs)) writeFileSync(path(p), text);
	writeFileSync(path(LOCK), pretty(lockOf(config, graph, graphText, outputs)));
	report(graph, JSON.parse(outputs[COVERAGE]));
	if (!check()) process.exitCode = 1;
}

function report(graph, cov) {
	const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(", ");
	console.log(`entities: ${fmt(graph.counts.entities)}`);
	console.log(`edges: ${fmt(graph.counts.edges)}`);
	console.log(`coverage: ${fmt(cov.summary)}`);
}

/** Write the derived artifacts again from the committed graph (policy edits); the lock follows. */
function derive() {
	const config = readJson(CONFIG);
	const graphText = read(GRAPH);
	const graph = JSON.parse(graphText);
	const outputs = derived(ROOT, graph, readJson(POLICY));
	for (const [p, text] of Object.entries(outputs)) writeFileSync(path(p), text);
	writeFileSync(path(LOCK), pretty(lockOf(config, graph, graphText, outputs)));
	report(graph, JSON.parse(outputs[COVERAGE]));
}

/** Offline: every pinned file matches the lock, the graph is valid and every derived artifact regenerates byte-identically. */
export function check() {
	const fails = [];
	const fail = (message) => fails.push(message);
	if (!existsSync(path(LOCK))) {
		console.error(`${LOCK} missing (npm run snapshot)`);
		return false;
	}
	const lock = readJson(LOCK);
	const config = readJson(CONFIG);
	if (sha256(read(CONFIG)) !== lock.config.sha256) fail(`${CONFIG} changed since the snapshot (npm run snapshot)`);
	if (sha256(read(POLICY)) !== lock.policy.sha256) fail(`${POLICY} changed since the snapshot (npm run snapshot:derive)`);
	if (lock.codegenX.commit !== config.codegenX.commit || lock.ui8kit.cli !== config.ui8kit.cli) fail("lock pins differ from the config");
	if (lock.ui8kit.sourceCommit !== registrySourceCommit(config)) fail(`lock ui8kit.sourceCommit ${lock.ui8kit.sourceCommit} != ${CONFIG} ui8kit.sourceCommit`);
	for (const [p, { sha256: want }] of Object.entries({ ...lock.ui8kit.pinned, ...lock.outputs })) {
		if (!existsSync(path(p))) fail(`${p} missing`);
		else if (sha256(read(p)) !== want) fail(`${p} sha256 differs from ${LOCK}`);
	}
	const graph = JSON.parse(read(GRAPH));
	if (graph.format !== "buildy-stock-registry") fail(`${GRAPH}: unknown format`);
	if (graph.sources.codegenX.commit !== config.codegenX.commit) fail(`${GRAPH} is not from codegenX.commit`);
	if (graph.sources.ui8kit.files["props/v0.json"].sha256 !== sha256(read(PROPS))) fail(`${GRAPH} pins other props than ${PROPS}`);
	if (graph.sources.ui8kit.files["variants/v0.json"].sha256 !== sha256(read(VARIANTS))) fail(`${GRAPH} pins other variants than ${VARIANTS}`);
	if (serialize(graph, 3) !== read(GRAPH)) fail(`${GRAPH} is not in canonical form`);
	for (const problem of validateGraph(graph, readJson(PROPS)).slice(0, 40)) fail(`${GRAPH}: ${problem}`);
	try {
		for (const p of driftOf(ROOT, graph, readJson(POLICY))) fail(`${p} is stale (npm run snapshot:derive)`);
	} catch (err) {
		fail(String(err.message ?? err));
	}
	const registry = spawnSync(process.execPath, [path("scripts/registry-snapshot.mjs"), "--check"], { cwd: ROOT, encoding: "utf8" });
	if (registry.status !== 0) fail(`registry-snapshot --check: ${registry.stdout}${registry.stderr}`.trim());
	for (const message of fails) console.error(`snapshot --check: ${message}`);
	const n = (o) => Object.values(o).reduce((a, b) => a + b, 0);
	if (!fails.length) console.log(`snapshot --check: ${n(graph.counts.entities)} entities, ${n(graph.counts.edges)} edges, lock and derived artifacts match`);
	return fails.length === 0;
}

if (process.argv.includes("--check")) process.exit(check() ? 0 : 1);
else if (process.argv.includes("--derive")) derive();
else await snapshot();

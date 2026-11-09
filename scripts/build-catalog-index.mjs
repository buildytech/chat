// Build packages/builder-core/src/catalog/search-index.json from the pinned codegen-x Stock artifacts.
// Only catalog data is used (asset titles, subtitles, labels, search words, facet value labels and
// synonyms). No hand-written keyword lists: new catalog terms reach search without code changes.
//
// Also lists every block asset of a spec in snapshot.json blockIndex (catalogIds, variants), without a cap.
// Usage: node scripts/build-catalog-index.mjs [--assets path] [--facets path]
// Without paths the files are fetched from raw.githubusercontent.com at the snapshot's pinned commit.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = new URL("..", import.meta.url);
const snapshotPath = new URL("packages/builder-core/src/catalog/snapshot.json", root);
const outPath = new URL("packages/builder-core/src/catalog/search-index.json", root);
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
const ASSETS = "apps/stock/content/assets.v0.json";
const FACETS = "apps/stock/content/facets.v0.json";

function arg(name) {
	const i = process.argv.indexOf(name);
	return i > 0 ? process.argv[i + 1] : undefined;
}

async function load(localPath, artifact) {
	if (localPath) return readFileSync(localPath, "utf8");
	const url = `https://raw.githubusercontent.com/${snapshot.repo}/${snapshot.pinnedCommit}/${artifact}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
	return res.text();
}

const assetsText = await load(arg("--assets"), ASSETS);
const facetsText = await load(arg("--facets"), FACETS);
const assets = JSON.parse(assetsText);
const facets = JSON.parse(facetsText);
if (assets.digest !== snapshot.sourceDigest) {
	throw new Error(`assets digest ${assets.digest} does not match snapshot ${snapshot.sourceDigest}`);
}

/** Unicode word tokens, lower-case. */
function tokens(text) {
	return String(text ?? "")
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		// Run-together phrase keys (e.g. "chartbesidetheactivity") are search-engine artefacts; skip them.
		.filter((t) => t.length >= 2 && t.length <= 20);
}

const SEARCH_FACETS = ["section", "job", "industry", "role", "composition", "character", "density", "media", "slots", "tone"];
const facetValues = new Map(); // `${facet}:${value}` -> { labels: {locale: text}, synonyms: string[] }
const vocabulary = {};
for (const facet of facets.facets) {
	if (!SEARCH_FACETS.includes(facet.id)) continue;
	vocabulary[facet.id] = [];
	for (const value of facet.values ?? []) {
		const synonyms = Object.values(value.synonyms ?? {}).flat();
		facetValues.set(`${facet.id}:${value.id}`, { labels: value.label ?? {}, synonyms });
		vocabulary[facet.id].push({ id: value.id, label: value.label ?? {} });
	}
}

const blockAssets = assets.assets.filter((a) => a.type === "block");
const blocksBySpec = new Map();
for (const asset of blockAssets) {
	const list = blocksBySpec.get(asset.spec) ?? [];
	list.push(asset);
	blocksBySpec.set(asset.spec, list);
}

// Every catalog asset of a block spec (no cap): blockIndex catalogIds and variants of snapshot.json follow the assets.
let lifted = 0;
for (const entry of snapshot.blockIndex) {
	const list = blocksBySpec.get(entry.spec) ?? [];
	if (!list.length) continue;
	const catalogIds = list.map((asset) => asset.id);
	const variants = list.map((asset) => asset.variant ?? asset.id.slice(entry.spec.length + 1));
	if (catalogIds.length !== entry.catalogIds.length) lifted += catalogIds.length - entry.catalogIds.length;
	entry.catalogIds = catalogIds;
	entry.variants = variants;
}
writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);

// Block labels used by screens, titled from their block assets.
const blockVocab = new Map();
for (const screen of assets.assets.filter((a) => a.type === "screen")) {
	for (const label of screen.labels.blocks ?? []) {
		if (blockVocab.has(label)) continue;
		const first = (blocksBySpec.get(`block.${label}`) ?? [])[0];
		blockVocab.set(label, first ? first.title : label);
	}
}
vocabulary.blocks = [...blockVocab.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, title]) => ({ id, label: { en: title } }));

function add(map, term, weight) {
	if (!term) return;
	map.set(term, Math.max(map.get(term) ?? 0, weight));
}

function addText(map, text, weight) {
	for (const t of tokens(text)) add(map, t, weight);
}

const screens = {};
for (const screen of assets.assets.filter((a) => a.type === "screen")) {
	const terms = new Map();
	for (const field of screen.fields ?? []) for (const word of field.words ?? []) addText(terms, word, field.w);
	addText(terms, screen.title, 6);
	addText(terms, screen.subtitle, 4);
	addText(terms, screen.spec, 3);
	addText(terms, screen.variant, 4);
	for (const facet of SEARCH_FACETS) {
		for (const value of screen.labels[facet] ?? []) {
			addText(terms, value, 3);
			const meta = facetValues.get(`${facet}:${value}`);
			if (!meta) continue;
			for (const label of Object.values(meta.labels)) addText(terms, label, 2);
			for (const syn of meta.synonyms) addText(terms, syn, 2);
		}
	}
	for (const label of screen.labels.blocks ?? []) {
		addText(terms, label, 3);
		for (const block of blocksBySpec.get(`block.${label}`) ?? []) {
			addText(terms, block.title, 2);
			addText(terms, block.subtitle, 1);
			for (const field of block.fields ?? []) if (field.w >= 3) for (const word of field.words ?? []) addText(terms, word, 1);
		}
	}
	screens[screen.id] = Object.fromEntries([...terms.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

// Compact form: one term table, each screen as "termIndex:weight" pairs.
const termList = [...new Set(Object.values(screens).flatMap((terms) => Object.keys(terms)))].sort();
const termIndex = new Map(termList.map((t, i) => [t, i]));
const packed = Object.fromEntries(
	Object.entries(screens).map(([id, terms]) => [id, Object.entries(terms).map(([t, w]) => `${termIndex.get(t).toString(36)}:${w}`).join(",")])
);

const index = {
	format: "buildy-catalog-search-index",
	schemaVersion: 1,
	repo: snapshot.repo,
	pinnedCommit: snapshot.pinnedCommit,
	sources: {
		assets: { artifact: ASSETS, digest: assets.digest },
		facets: { artifact: FACETS, sha256: `sha256:${createHash("sha256").update(facetsText).digest("hex")}` }
	},
	vocabulary,
	terms: termList,
	screens: packed
};
// ASCII only (repo rule: no non-Latin script outside the ru locale file); JSON \u escapes keep the data.
const ascii = JSON.stringify(index).replace(/[\u007f-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
writeFileSync(outPath, ascii + "\n");
console.log(`snapshot.json blockIndex: ${snapshot.blockIndex.reduce((n, entry) => n + entry.catalogIds.length, 0)} catalog ids (+${lifted})`);
console.log(`search-index: ${Object.keys(packed).length} screens, ${termList.length} terms, ${vocabulary.blocks.length} block labels, ${(JSON.stringify(index).length / 1024).toFixed(1)} KB`);

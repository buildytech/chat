/**
 * The catalog of the simple line (ADR 0059): the blocks of catalog/snapshot.config.json from the pinned registry, each with
 * its block-contract/v1, content model and prototype (ui8kit/prototypes), every pinned file sha-checked; the Blocks feed
 * cards are the block variants; a prototype renders from its variant's settings and axes. No Stock snapshot is left.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { catalogBlocks, catalogDigest, catalogSearch, itemInfo, prototypeProps } from "../../packages/builder-core/src/index.ts";
import { deriveBlocks } from "../lib/registry-derive.mjs";

const ROOT = join(import.meta.dirname, "../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const config = JSON.parse(read("catalog/snapshot.config.json")) as { ui8kit: { blocks: string[] }; prototypes: { repo: string; commit: string } };
const snapshot = JSON.parse(read("registry/snapshot.json")) as { files: Record<string, string>; blocks: string[]; prototypes: { repo: string; commit: string } };

test("the catalog is exactly the configured blocks, in config order, with contract, model and prototype", () => {
	assert.deepEqual(config.ui8kit.blocks, ["hero-simple", "team-simple"]);
	assert.deepEqual(catalogBlocks().map((block) => block.item), config.ui8kit.blocks);
	for (const block of catalogBlocks()) {
		assert.equal(block.contract.item, block.item);
		assert.ok(block.contract.variants.length > 0, block.item);
		assert.ok(block.contract.variants.some((v) => v.id === block.contract.defaultVariant), block.item);
		assert.equal(block.model.$schema, "https://json-schema.org/draft/2020-12/schema", block.item);
		assert.ok(existsSync(join(ROOT, "prototypes/svelte/blocks", block.prototype)), block.prototype);
		assert.deepEqual(itemInfo(block.item)?.variants, block.contract.variants.map((v) => v.id), "the registry variants are the contract's");
	}
	assert.deepEqual(readdirSync(join(ROOT, "registry/svelte/src/blocks")).filter((name) => name.endsWith(".svelte")).sort(), ["hero-simple.svelte", "team-simple.svelte"], "the registry tree has only the catalog blocks");
	for (const gone of ["catalog/coverage.json", "catalog/stock-registry.v0.json", "packages/builder-core/src/catalog/snapshot.json", "packages/builder-core/src/catalog/search-index.json"]) assert.ok(!existsSync(join(ROOT, gone)), `${gone} is gone`);
});

test("every pinned file matches its sha256, the prototypes come from the configured commit, blocks.json is derived", () => {
	for (const [file, sha] of Object.entries(snapshot.files)) {
		assert.equal(createHash("sha256").update(readFileSync(join(ROOT, file))).digest("hex"), sha.replace(/^sha256:/, ""), file);
	}
	assert.equal(snapshot.prototypes.repo, config.prototypes.repo);
	assert.equal(snapshot.prototypes.commit, config.prototypes.commit);
	assert.deepEqual(JSON.parse(read("packages/builder-core/src/catalog/blocks.json")), JSON.parse(JSON.stringify(deriveBlocks(ROOT, snapshot))));
	assert.match(catalogDigest(), /^sha256:[0-9a-f]{64}$/);
});

test("feed cards: one per block variant, free text and category filters, counts per category", () => {
	const all = catalogSearch();
	assert.deepEqual(all.items.map((card) => card.id), ["hero-simple/mediaEnd", "hero-simple/mediaStart", "hero-simple/mediaTop", "hero-simple/splitEnd", "hero-simple/splitStart", "team-simple/cols3", "team-simple/cols2", "team-simple/cols4", "team-simple/cards3"]);
	assert.deepEqual(all.categories, [{ value: "hero", count: 5 }, { value: "company", count: 4 }]);
	assert.deepEqual(all.items.filter((card) => card.isDefault).map((card) => card.id), ["hero-simple/mediaEnd", "team-simple/cols3"]);
	assert.deepEqual(catalogSearch({ category: "company" }).items.map((card) => card.variant), ["cols3", "cols2", "cols4", "cards3"]);
	assert.deepEqual(catalogSearch({ q: "cards" }).items.map((card) => card.id), ["team-simple/cards3"]);
	assert.deepEqual(catalogSearch({ q: "picture top" }).items.map((card) => card.id), ["hero-simple/mediaTop"]);
	assert.deepEqual(catalogSearch({ q: "split" }).items.map((card) => card.id), ["hero-simple/splitEnd", "hero-simple/splitStart"]);
	assert.equal(catalogSearch({ q: "pricing" }).total, 0);
});

test("prototype props: the contract's setting defaults, then the variant's settings and axes", () => {
	assert.deepEqual(prototypeProps("hero-simple", "mediaEnd"), { level: 2, padding: "standard", align: "start", media: "end", frame: "box" });
	assert.deepEqual(prototypeProps("hero-simple", "mediaTop"), { level: 2, padding: "standard", align: "center", media: "top", frame: "box" });
	assert.deepEqual(prototypeProps("hero-simple", "splitStart"), { level: 2, padding: "standard", align: "start", media: "start", frame: "split" });
	assert.deepEqual(prototypeProps("team-simple", "cards3"), { level: 2, padding: "standard", align: "center", cols: "3", surface: "cards" });
	assert.deepEqual(prototypeProps("team-simple", "nosuch"), {});
	assert.deepEqual(prototypeProps("nosuch", "x"), {});
});

test("prototypes are wireframes: rectangles only, no text, every shape names its place and field", () => {
	for (const block of catalogBlocks()) {
		const source = read(`prototypes/svelte/blocks/${block.prototype}`);
		assert.match(source, /DO NOT EDIT/);
		assert.match(source, /from "@ui8kit\/kit\//, "the prototype imports the kit as the package does (aliased to registry/svelte/src/kit)");
		for (const place of block.contract.places) assert.ok(source.includes(`place="${place.place}"`), `${block.item}: place ${place.place}`);
	}
});

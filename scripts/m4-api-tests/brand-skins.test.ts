/**
 * Per-project Brand Skins (ADR 0070): the legacy shared slot migrates without leaking across projects, and both
 * Svelte and templ exports pick up the chosen Brand Skin (templ: :root in ui/styles/theme.css, fonts in the manifest).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { importThemeConfig } from "../../apps/chat-web/src/lib/theme/custom-skin.ts";
import {
	IMPORTED_BRAND_SKIN_ID,
	brandSkinOf,
	brandSkinsOf,
	migrateLegacyCustomSkin,
	newBrandSkinId,
	packSkinOptionsFor,
	upsertBrandSkin,
	type BrandSkinRecord
} from "../../apps/chat-web/src/lib/theme/brand-skins.ts";
import { packFilesFromPage, THEME_FILE, CUSTOM_SKIN_CSS } from "../../apps/chat-web/src/lib/page-store/pack.ts";
import { packTemplZipFiles } from "../../apps/chat-web/src/lib/page-store/templ-pack.ts";
import type { Project } from "../../apps/chat-web/src/lib/project/types.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";
import type { PackEntry } from "../../apps/chat-web/src/lib/page-store/pack.ts";
import type { TemplSnapshot } from "../../apps/chat-web/src/lib/page-store/templ-code.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const STOCK = readFileSync(new URL("./fixtures/stock-theme-export.json", import.meta.url), "utf8");
const fixturePage = JSON.parse(readFileSync(path.join(ROOT, "scripts/m4-api-tests/fixtures/north-harbor-v2.json"), "utf8")) as PageV2;
const STARTER = path.join(ROOT, "registry/templ/starter");
const snapshot = JSON.parse(readFileSync(path.join(ROOT, "registry/templ/snapshot.json"), "utf8")) as TemplSnapshot;
const NOW = "2026-11-27T00:00:00.000Z";

function theme() {
	const r = importThemeConfig(STOCK);
	assert.ok(r.ok);
	return r.config;
}

function project(over: Partial<Project> & Pick<Project, "id" | "title">): Project {
	return {
		projectId: over.id,
		updatedAt: NOW,
		ext: {},
		...over
	};
}

function record(over: Partial<BrandSkinRecord> = {}): BrandSkinRecord {
	return {
		id: "brand-rye",
		name: "Rye & Coal",
		createdAt: NOW,
		source: "design",
		brief: {
			name: "Rye & Coal",
			thesis: { summary: "Fire and grain as craft.", positioning: "Everyday bread.", antiPersonality: ["precious"] }
		},
		theme: theme(),
		contract: { schemaVersion: "1.0.0", meta: { name: "Rye & Coal", slug: "rye-coal" } },
		...over
	};
}

function text(zip: PackEntry[], p: string): string {
	const entry = zip.find((e) => e.path === p);
	assert.ok(entry && "content" in entry, `no text file ${p}`);
	return entry.content;
}

test("new Brand Skin ids are brand-<slug> and suffix on collision", () => {
	assert.equal(newBrandSkinId("Rye & Coal", new Set()), "brand-rye-coal");
	assert.equal(newBrandSkinId("Rye & Coal", new Set(["brand-rye-coal"])), "brand-rye-coal-2");
});

test("legacy customSkin slot copies into a project on skin=custom and does not leak into a neighbour", () => {
	const a = project({ id: "a", title: "Bakery", skin: "custom" });
	const b = project({ id: "b", title: "Harbor", skin: "claude" });
	const { projects, clearLegacy } = migrateLegacyCustomSkin([a, b], theme(), "a", NOW);
	const [nextA, nextB] = projects;
	assert.ok(nextA && nextB);
	assert.ok(brandSkinOf(nextA, IMPORTED_BRAND_SKIN_ID));
	assert.equal(brandSkinOf(nextB, IMPORTED_BRAND_SKIN_ID), null);
	assert.equal(nextA.skin, "custom");
	assert.equal(nextB.skin, "claude");
	assert.equal(brandSkinsOf(nextB).length, 0);
	assert.equal(clearLegacy, true);
	assert.equal(packSkinOptionsFor(nextB.skin ?? null, nextB).theme, undefined);
	assert.ok(packSkinOptionsFor(nextA.skin ?? null, nextA).theme);
});

test("the selected project without Brand Skins also receives the legacy import; a non-selected neighbour does not", () => {
	const a = project({ id: "a", title: "Bakery", skin: null });
	const b = project({ id: "b", title: "Harbor", skin: null });
	const { projects } = migrateLegacyCustomSkin([a, b], theme(), "b", NOW);
	assert.equal(brandSkinOf(projects[0]!, IMPORTED_BRAND_SKIN_ID), null);
	assert.ok(brandSkinOf(projects[1]!, IMPORTED_BRAND_SKIN_ID));
	assert.equal(projects[1]!.skin, null, "import is stored, not auto-selected, when the project was not on custom");
});

test("two projects keep distinct Brand Skins; pack options of one do not include the other", () => {
	const rye = record();
	const ink = record({ id: "brand-ink", name: "Ink", contract: { schemaVersion: "1.0.0", meta: { name: "Ink", slug: "ink" } } });
	const a = upsertBrandSkin(project({ id: "a", title: "A" }), rye, true);
	const b = upsertBrandSkin(project({ id: "b", title: "B" }), ink, true);
	assert.equal(a.skin, "brand-rye");
	assert.equal(b.skin, "brand-ink");
	assert.equal(brandSkinOf(a, "brand-ink"), null);
	assert.equal(brandSkinOf(b, "brand-rye"), null);
	const packA = packSkinOptionsFor(a.skin ?? null, a);
	const packB = packSkinOptionsFor(b.skin ?? null, b);
	assert.deepEqual((packA.contract as { meta?: { slug?: string } } | undefined)?.meta, { name: "Rye & Coal", slug: "rye-coal" });
	assert.deepEqual((packB.contract as { meta?: { slug?: string } } | undefined)?.meta, { name: "Ink", slug: "ink" });
	assert.equal(packSkinOptionsFor(a.skin ?? null, b).theme, undefined, "B does not recognise A's id");
});

test("Svelte pack of a Brand Skin includes theme.json, custom-skin.css and brand.contract.json", () => {
	const skin = record();
	const options = packSkinOptionsFor(skin.id, upsertBrandSkin(project({ id: "a", title: "A" }), skin, true));
	const files = packFilesFromPage(fixturePage, options);
	const paths = files.map((file) => file.path);
	assert.ok(paths.includes(THEME_FILE));
	assert.ok(paths.includes(CUSTOM_SKIN_CSS));
	assert.ok(paths.includes("brand.contract.json"));
	const contract = JSON.parse(text(files, "brand.contract.json"));
	assert.equal(contract.schemaVersion, "1.0.0");
	assert.equal(contract.meta.slug, "rye-coal");
	const manifest = JSON.parse(text(files, "manifest.json"));
	assert.ok(manifest.files.includes("brand.contract.json"));
});

test("templ pack of a Brand Skin writes tokens on :root in theme.css, names fonts in the manifest, and adds brand.contract.json", async () => {
	const skin = record();
	const options = packSkinOptionsFor(skin.id, upsertBrandSkin(project({ id: "a", title: "A" }), skin, true));
	const readStarter = async (paths: string[]) =>
		Object.fromEntries(paths.map((p) => [p, p.endsWith(".woff2") ? new Uint8Array(readFileSync(path.join(STARTER, p))) : readFileSync(path.join(STARTER, p), "utf8")]));
	const readRegistry = async (paths: string[]) => Object.fromEntries(paths.map((p) => [p, readFileSync(path.join(ROOT, "registry/svelte", p), "utf8")]));
	const zip = await packTemplZipFiles(fixturePage, snapshot, readStarter, readRegistry, { preset: "blog", ...options });
	const themeCss = text(zip, "ui/styles/theme.css");
	assert.match(themeCss, /:root \{/);
	assert.match(themeCss, /--primary:/);
	assert.doesNotMatch(themeCss, /fonts\.googleapis/, "fonts are not linked from the CSS");
	assert.doesNotMatch(themeCss, /style="/, "no inline style attributes");
	assert.ok(zip.some((e) => e.path === "brand.contract.json"));
	const manifest = JSON.parse(text(zip, "manifest.json"));
	assert.ok(manifest.customSkin?.fonts?.length >= 1, "font names (and self-host note) live on the manifest");
	assert.match(String(manifest.customSkin.note), /self-host/);
	assert.equal(JSON.parse(text(zip, "brand.contract.json")).schemaVersion, "1.0.0");
});

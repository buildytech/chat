/**
 * Go templ export (ADR 0069): the pinned starter of registry/templ with the page as internal/page/page.json. Offline: the
 * snapshot matches its pins, the ZIP keeps only the page's catalog blocks, page.json carries the props renderBlock gives,
 * sections_gen.go lists the kept registry blocks, the skin becomes :root rules, the preset reaches the Makefile and both
 * exports share the pack format. The Go build itself runs in templ-pack-go.test.ts (live: Go and the module proxy).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { type PageV2 } from "../../packages/page-contract/src/index.ts";
import { emptyPage, registrySkins, renderBlock, writePage } from "../../packages/builder-core/src/index.ts";
import { packZipFiles, type PackEntry } from "../../apps/chat-web/src/lib/page-store/pack.ts";
import { packTemplZipFiles } from "../../apps/chat-web/src/lib/page-store/templ-pack.ts";
import { TEMPL_PRESETS, rootSkinCss, sectionsGo, type TemplSnapshot } from "../../apps/chat-web/src/lib/page-store/templ-code.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const STARTER = path.join(ROOT, "registry/templ/starter");
const NOW = "2026-11-09T00:00:00.000Z";
const snapshot = JSON.parse(readFileSync(path.join(ROOT, "registry/templ/snapshot.json"), "utf8")) as TemplSnapshot;
const fill = JSON.parse(readFileSync(path.join(ROOT, "scripts/m4-api-tests/fixtures/studio-fill.json"), "utf8")) as PageV2;

function page(extra: PageV2["blocks"] = []): PageV2 {
	const r = writePage(emptyPage({ title: fill.title, locale: "en", now: NOW }), { page: { ...fill, blocks: [...extra, ...fill.blocks] } }, { now: NOW });
	assert.ok(r.ok, JSON.stringify(!r.ok && r.issues));
	return r.page;
}
const readStarter = async (paths: string[]) => Object.fromEntries(paths.map((p) => [p, p.endsWith(".woff2") ? new Uint8Array(readFileSync(path.join(STARTER, p))) : readFileSync(path.join(STARTER, p), "utf8")]));
const readRegistry = async (paths: string[]) => Object.fromEntries(paths.map((p) => [p, readFileSync(path.join(ROOT, "registry/svelte", p), "utf8")]));
const content = (zip: PackEntry[], p: string): string => {
	const entry = zip.find((e) => e.path === p);
	assert.ok(entry && "content" in entry, `no text file ${p}`);
	return entry.content;
};

test("registry/templ matches its pins (snapshot --check)", () => {
	const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/templ-snapshot.mjs"), "--check"], { encoding: "utf8" });
	assert.equal(r.status, 0, r.stdout + r.stderr);
});

for (const preset of TEMPL_PRESETS) {
	test(`templ ZIP of the studio page, preset ${preset}`, async () => {
		const p = page();
		const zip = await packTemplZipFiles(p, snapshot, readStarter, readRegistry, { preset });
		const paths = zip.map((e) => e.path);
		assert.equal(new Set(paths).size, paths.length, "no path twice");
		const manifest = JSON.parse(content(zip, "manifest.json"));
		assert.deepEqual([manifest.format, manifest.schemaVersion, manifest.framework, manifest.preset], ["buildy.pack.v1", 1, "templ", preset]);
		assert.deepEqual(manifest.files, paths);
		assert.equal(paths.at(-1), "manifest.json");
		const generator = JSON.parse(content(zip, "GENERATOR.json"));
		assert.deepEqual([generator.format, generator.schemaVersion, generator.framework, generator.preset], ["buildy.pack.v1", 1, "templ", preset]);
		assert.deepEqual(generator.registryItems, ["hero-simple", "team-simple"]);
		const blocks = paths.filter((f) => /^ui\/kit\/blocks\/[^/]+\.templ$/.test(f)).map((f) => f.slice(14, -6)).filter((b) => snapshot.blocks.includes(b));
		assert.deepEqual(blocks.sort(), ["hero-simple", "team-simple"]);
		for (const b of snapshot.starterBlocks) assert.ok(paths.includes(`ui/kit/blocks/${b}.templ`), `starter block ${b} kept`);
		const doc = JSON.parse(content(zip, "internal/page/page.json"));
		assert.equal(doc.format, "buildy.templ-page.v1");
		assert.equal(doc.preset, preset);
		assert.equal(doc.blocks.length, p.blocks.length);
		for (const [i, block] of p.blocks.entries()) {
			const want = renderBlock(block)!.props as Record<string, unknown>;
			// remote pictures (not downloaded here) become "": the CSP serves pictures from the site only
			const expected = JSON.parse(JSON.stringify(want).replace(/"https:\/\/[^"]+"/g, '""'));
			assert.deepEqual(doc.blocks[i].props, expected, `${block.id}: props of renderBlock`);
		}
		const lock = content(zip, "ui/kit/ui8kit.lock.json");
		const items = Object.values(JSON.parse(lock).items as Record<string, { name: string }>).map((i) => i.name);
		assert.ok(items.includes("hero-simple") && !items.includes("faq-simple"));
		assert.equal(content(zip, "internal/page/sections_gen.go"), sectionsGo(lock, (item) => readFileSync(path.join(STARTER, `ui/kit/blocks/${item}.templ`), "utf8")));
		assert.match(content(zip, "internal/page/sections_gen.go"), /case "hero-simple":\n\t\tvar p blocks\.HeroSimpleProps/);
		assert.match(content(zip, "Makefile"), new RegExp(`^PRESET \\?= ${preset}$`, "m"));
		assert.match(content(zip, "internal/web/static/app.css"), /\.aspect-4\\\/3\{/, "the built CSS covers the blocks' recipes (media frame ratios)");
		assert.equal(content(zip, "ui/styles/theme.css"), readFileSync(path.join(STARTER, "ui/styles/theme.css"), "utf8"), "no skin: theme.css unchanged");
		assert.deepEqual(zip.filter((e) => "executable" in e).map((e) => e.path), ["scripts/privacy-check.sh", "scripts/verify.sh"], "the starter's scripts stay executable");
		const font = zip.find((e) => e.path.endsWith(".woff2"));
		assert.ok(font && "bytes" in font && font.bytes.length > 1000, "fonts are bytes");
	});
}

test("templ ZIP: the starter's Layout replaces the page's header and footer", async () => {
	const header = { id: "top", item: "header-simple", props: {} } as unknown as PageV2["blocks"][number];
	const zip = await packTemplZipFiles(page([header]), snapshot, readStarter, readRegistry, { preset: "corporate" });
	const manifest = JSON.parse(content(zip, "manifest.json"));
	assert.deepEqual(manifest.skipped.map((s: { item: string }) => s.item), ["header-simple"]);
	assert.ok(!JSON.parse(content(zip, "internal/page/page.json")).blocks.some((b: { item: string }) => b.item === "header-simple"));
	assert.ok(!zip.some((e) => e.path === "ui/kit/blocks/header-simple.templ"));
});

test("templ ZIP: a registry skin is :root rules in theme.css and the built app.css", async () => {
	const skin = registrySkins()[0]!;
	const zip = await packTemplZipFiles(page(), snapshot, readStarter, readRegistry, { preset: "shop", skin: skin.id });
	const theme = content(zip, "ui/styles/theme.css");
	const css = rootSkinCss(readFileSync(path.join(ROOT, "registry/svelte", skin.file), "utf8")).trimEnd();
	assert.ok(theme.includes(css), "the skin's rules");
	assert.doesNotMatch(theme, /data-skin|\) :root/, "every rule on :root, none under another element");
	assert.ok(content(zip, "internal/web/static/app.css").endsWith(theme.slice(theme.indexOf("\n/* ---- BuildY Chat skin"))));
	assert.equal(JSON.parse(content(zip, "manifest.json")).skin, skin.id);
	assert.doesNotMatch(theme, /fonts\.googleapis/, "no font CDN (the starter's privacy check)");
});

test("Svelte ZIP: the same pack format, the project itself unchanged", async () => {
	const zip = await packZipFiles(page(), async (paths) => readRegistry(paths));
	const manifest = JSON.parse(content(zip, "manifest.json"));
	assert.deepEqual([manifest.format, manifest.schemaVersion, manifest.framework], ["buildy.pack.v1", 1, "svelte"]);
	const generator = JSON.parse(content(zip, "GENERATOR.json"));
	assert.deepEqual([generator.format, generator.schemaVersion, generator.framework, generator.name], ["buildy.pack.v1", 1, "svelte", "@buildytech/chat-web/svelte-pack"]);
	assert.equal(manifest.preset, undefined);
});

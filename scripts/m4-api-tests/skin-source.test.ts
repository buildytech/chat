/**
 * One skin source (ADR 0074). The owner switched to a new custom skin and the simple blocks of the side catalog kept the old
 * colours: the catalog's cards re-read the skin only when the registry skin under the Brand Skin changed, and two Brand Skins
 * usually sit on the same one. Every consumer now takes a SkinSource and asks skinSheets for the rules.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { importThemeConfig, type ThemeConfig } from "../../apps/chat-web/src/lib/theme/custom-skin.ts";
import { skinSheets, skinSource } from "../../apps/chat-web/src/lib/theme/skin-source.ts";
import { packFilesFromPage } from "../../apps/chat-web/src/lib/page-store/pack.ts";
import { studioPage } from "./studio-page.ts";

const STOCK = readFileSync(new URL("./fixtures/stock-theme-export.json", import.meta.url), "utf8");
const web = (path: string): string => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");

function brand(h: number, over: Partial<ThemeConfig> = {}): ThemeConfig {
	const read = importThemeConfig(STOCK);
	assert.ok(read.ok);
	return { ...read.config, skin: "modern-minimal", palette: { harmony: "complementary", h, s: 85, l: 52, contrast: "AAA" }, ...over };
}

const colour = (css: string, selectorPart: string, prop: string): string => {
	const rule = css.split("\n}\n").find((block) => block.startsWith(selectorPart)) ?? "";
	return rule.match(new RegExp(`${prop}: ([^;]+);`))?.[1] ?? "";
};

test("two Brand Skins on the same registry skin have different keys; the same skin has the same key", () => {
	const blue = skinSource("brand-a", brand(210));
	const orange = skinSource("brand-b", brand(25));
	assert.equal(blue.registry, orange.registry, "they share the registry skin the old reader looked at");
	assert.notEqual(blue.key, orange.key);
	assert.equal(skinSource("brand-a", brand(210)).key, blue.key);
	assert.notEqual(skinSource("brand-a", brand(211)).key, blue.key, "an edit (new palette, same id) changes the key too");
	assert.notEqual(skinSource(null, null).key, blue.key);
});

test("skinSheets writes both modes for the document and for a scope, from the same palette", () => {
	const source = skinSource("brand-a", brand(210));
	const doc = skinSheets(source, "document");
	const scope = skinSheets(source, "scope");
	for (const sheets of [doc, scope]) {
		assert.equal((sheets.modes.match(/--background:/g) ?? []).length, 2, "one background per mode");
		assert.match(sheets.modes, /color-scheme: light/);
		assert.match(sheets.modes, /color-scheme: dark/);
	}
	assert.match(doc.modes, /^:root:root \{/);
	assert.match(scope.modes, /^\[data-page-skin\]\[data-page-skin\] \{/);
	assert.ok("data-page-skin" in scope.attrs && !("data-page-skin" in doc.attrs));
	const light = colour(scope.modes, "[data-page-skin][data-page-skin] {", "--background");
	const dark = colour(scope.modes, ":is(.dark", "--background");
	assert.ok(light && dark && light !== dark, "light and dark differ");
	// the document rules carry the very same values
	assert.equal(colour(doc.modes, ":root:root {", "--background"), light);
	assert.equal(colour(doc.modes, ":root:root:is(", "--background"), dark);
});

test("a registry skin or the default has no palette sheet, only its attribute", () => {
	assert.equal(skinSheets(skinSource(null, null), "scope").modes, "");
	assert.deepEqual(skinSheets(skinSource(null, null), "scope").attrs, { "data-page-skin": "" });
	assert.equal(skinSheets(skinSource("modern-minimal", null), "scope").attrs["data-skin"], "modern-minimal");
});

test("the ZIP's custom-skin.css carries the very rules the preview writes", () => {
	const theme = brand(25);
	const files = packFilesFromPage(studioPage({ title: "Coffee", now: "2026-11-10T12:00:00.000Z" }), { theme });
	const css = files.find((file) => file.path.endsWith("custom-skin.css"))?.content ?? "";
	assert.ok(css.includes(skinSheets(skinSource(null, theme), "document").modes));
});

test("the preview pane, the catalog thumbnails and the preview window read the one source", () => {
	assert.match(web("app/PreviewPane.svelte"), /activeSkinSource\(\)/);
	assert.match(web("app/PrototypeThumb.svelte"), /pageSkinScope\(\)/);
	assert.match(web("app/PrototypeThumb.svelte"), /syncPageSkinStyle\(scope\.source\)/);
	assert.match(web("lib/feed/page-skin.svelte.ts"), /activeSkinSource/);
	assert.doesNotMatch(web("lib/feed/page-skin.svelte.ts"), /renderCustomSkin|modeCss|projectBrandTheme/, "no second renderer in the feed");
	assert.match(web("lib/theme/skins.ts"), /createSkinApplier\(doc, \{ target: "document"/);
	assert.match(web("lib/theme/skins.ts"), /applyScopeSkin/);
	assert.doesNotMatch(web("lib/theme/skins.ts"), /renderCustomSkin|modeCss/, "applySkin renders through skinSheets only");
	assert.match(web("lib/page-store/pack.ts"), /skinSheets\(skinSource\(null, options\.theme\), "document"\)\.modes/);
	assert.match(web("app/StandalonePreview.svelte"), /applySkin\(document, /, "the preview window applies through the same function as the pane");
});

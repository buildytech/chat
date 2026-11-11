/**
 * Custom Skin (ADR 0025): Settings > Theme import of the Stock theme editor's config (codegen-x/ui8kit app.codegen-x.com,
 * format magazine-theme v2), the one slot, the preview render (Stock's root attributes and variables), the ZIP and the
 * round trip Stock export -> chat import -> chat export. The fixture is a real export from app.codegen-x.com Stock.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { registrySkins } from "../../packages/builder-core/src/index.ts";
import { configText, CUSTOM_SKIN_BASE_CSS, CUSTOM_SKIN_ID, importThemeConfig, parseCustomSkinSlot, renderCustomSkin, serializeCustomSkinSlot } from "../../apps/chat-web/src/lib/theme/custom-skin.ts";
import { SKIN_IDS } from "../../apps/chat-web/src/lib/theme/magazine/ids.ts";
import { CUSTOM_SKIN_CSS, packFilesFromPage, THEME_FILE } from "../../apps/chat-web/src/lib/page-store/pack.ts";
import { parsePage } from "../../packages/page-contract/src/index.ts";
// @ts-expect-error plain ESM script without types
import { build as buildNeutrals } from "../skin-neutrals.mjs";

const root = (path: string) => new URL(`../../${path}`, import.meta.url);
const web = (path: string) => readFileSync(root(`apps/chat-web/src/${path}`), "utf8");
const STOCK = readFileSync(new URL("./fixtures/stock-theme-export.json", import.meta.url), "utf8");
const fixturePage = parsePage(JSON.parse(readFileSync(root("packages/page-contract/fixtures/north-harbor-kitchen.json"), "utf8")));

test("import: a real Stock export passes and exports back byte for byte", () => {
	const r = importThemeConfig(STOCK);
	assert.ok(r.ok, JSON.stringify(r));
	assert.equal(r.text, STOCK, "Stock's Export text (JSON.stringify(config, null, 2)) comes back unchanged");
	assert.equal(configText(r.config), STOCK);
	assert.equal(r.config.skin, "claude");
	assert.deepEqual(importThemeConfig(JSON.parse(STOCK)), r, "text or a parsed value read the same");
});

test("import: anything else fails with a reason and a JSON Pointer", () => {
	const base = JSON.parse(STOCK);
	const issue = (input: unknown) => {
		const r = importThemeConfig(input);
		assert.ok(!r.ok, JSON.stringify(input));
		return r.issues;
	};
	assert.equal(issue("{ nope")[0]!.code, "not_json");
	assert.equal(issue("[1]")[0]!.code, "not_object");
	assert.deepEqual(issue({ ...base, format: "other" })[0], { code: "format", path: "/format", allowed: ["magazine-theme"] });
	assert.equal(issue({ ...base, version: 1 })[0]!.code, "version");
	assert.equal(issue({ v: 1, theme: { skin: "claude" } })[0]!.code, "format", "Stock's stored shape is not this format");
	assert.deepEqual(issue({ ...base, extra: 1 })[0], { code: "unknown_key", path: "/extra" });
	const skin = issue({ ...base, skin: "neon" })[0]!;
	assert.equal(skin.code, "invalid_value");
	assert.equal(skin.path, "/skin");
	assert.ok(skin.allowed?.includes("claude") && skin.allowed.includes("null"));
	assert.equal(issue({ ...base, radius: 10 })[0]!.path, "/radius");
	assert.equal(issue({ ...base, tokens: { "radius-card": 3 } })[0]!.path, "/tokens/radius-card");
	assert.equal(issue({ ...base, tokens: { "glow-card": 1 } })[0]!.code, "unknown_key");
	assert.equal(issue({ ...base, palette: { harmony: "triadic", h: 400, s: 1, l: 1 } })[0]!.path, "/palette/h");
	assert.equal(issue({ ...base, palette: { harmony: "triadic", h: 1, s: 1 } })[0]!.code, "required");
	assert.equal(issue({ ...base, mode: "sepia" })[0]!.path, "/mode");
	// Valid by the schema but dropped by Stock's reader: Manrope has no width axis.
	assert.deepEqual(issue({ ...base, fontWidth: 80 })[0], { code: "not_kept", path: "/fontWidth" });
	// Minimal and default-only configs are fine (absent fields are unset).
	const min = importThemeConfig({ format: "magazine-theme", version: 2 });
	assert.ok(min.ok && min.config.skin === null && min.config.mode === "light");
});

test("render: Stock's root attributes, variables (as Stock applied them live), mode and fonts", () => {
	const r = importThemeConfig(STOCK);
	assert.ok(r.ok);
	const render = renderCustomSkin(r.config);
	assert.equal(render.skin, "claude");
	assert.equal(render.mode, "light");
	assert.deepEqual(render.attrs, { "data-skin": "claude", "data-density-button": "comfortable" });
	const style = Object.fromEntries(render.style);
	// Values read from document.documentElement on app.codegen-x.com/#/frame/block.herosplit/miniCards with this theme.
	assert.equal(style["--radius"], "12px");
	assert.equal(style["--radius-button"], "8px");
	assert.equal(style["--radius-card"], "16px");
	assert.equal(style["--shadow-card"], "var(--shadow-md)");
	assert.equal(style["--primary"], "hsl(160 70% 38%)");
	assert.equal(style["--primary-foreground"], "hsl(160 40% 10%)");
	assert.equal(style["--background"], "hsl(160 8% 97%)");
	assert.equal(style["--muted-foreground"], "hsl(160 10% 37%)");
	assert.equal(style["--text-base"], "1.05rem");
	assert.equal(style["font-weight"], "500");
	assert.equal(style["--tracking-normal"], "0.025em");
	assert.equal(style["--taste-heading"], "Merriweather,sans-serif");
	assert.equal(style["--font-sans"], "Manrope,sans-serif", "Stock self-hosts Manrope as taste-manrope; the chat loads the same face from Google");
	assert.equal(style["color-scheme"], "light");
	assert.deepEqual(render.fonts, [
		"https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&display=swap",
		"https://fonts.googleapis.com/css2?family=Merriweather:wght@400;500;600;700&display=swap"
	]);
	const dark = renderCustomSkin({ ...r.config, mode: "dark" });
	assert.notEqual(Object.fromEntries(dark.style)["--primary"], style["--primary"], "the palette is computed for the config's mode");
	assert.match(CUSTOM_SKIN_BASE_CSS, /:is\(h1, h2, h3\) \{ font-family: var\(--taste-heading, var\(--font-sans\)\)/);
});

test("slot: one stored config `{ v: 1, config }`; bad values are reported, not loaded", () => {
	const r = importThemeConfig(STOCK);
	assert.ok(r.ok);
	const raw = serializeCustomSkinSlot(r.config);
	assert.deepEqual(parseCustomSkinSlot(raw), { config: r.config });
	assert.equal(parseCustomSkinSlot(null), null);
	assert.deepEqual(parseCustomSkinSlot("{"), { error: "custom_skin_corrupt" });
	assert.deepEqual(parseCustomSkinSlot(JSON.stringify({ v: 2, config: r.config })), { error: "custom_skin_version" });
	assert.match((parseCustomSkinSlot(JSON.stringify({ v: 1, config: { format: "x" } })) as { error: string }).error, /custom_skin_invalid format/);
	assert.equal(CUSTOM_SKIN_ID, "custom");
});

test("zip: base skin from the registry, Stock's root on <html>, base rules, theme.json re-imports to the same text", () => {
	const r = importThemeConfig(STOCK);
	assert.ok(r.ok);
	const files = packFilesFromPage(fixturePage, { skin: "claude", theme: r.config });
	const file = (path: string) => files.find((entry) => entry.path === path)?.content ?? "";
	const html = file("index.html");
	assert.match(html, /<html lang="en" data-skin="claude" data-density-button="comfortable" data-theme="light" style="--radius:12px;/);
	assert.match(html, /--primary:hsl\(160 70% 38%\)/);
	assert.match(html, /color-scheme:light"/);
	assert.match(html, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Manrope/);
	assert.doesNotMatch(html, /prefers-color-scheme/, "the config fixes its mode");
	const main = file("src/main.ts");
	assert.match(main, /import "\.\/styles\/skins\/claude\.css";/);
	assert.match(main, /import "\.\/custom-skin\.css";/);
	assert.equal(file(CUSTOM_SKIN_CSS), CUSTOM_SKIN_BASE_CSS);
	assert.equal(file(THEME_FILE), `${STOCK}\n`);
	const again = importThemeConfig(file(THEME_FILE));
	assert.ok(again.ok && again.text === STOCK, "chat export -> import -> export is lossless");
	const manifest = JSON.parse(file("manifest.json"));
	assert.equal(manifest.skin, "claude");
	assert.deepEqual(manifest.customSkin, { file: "theme.json", format: "magazine-theme", version: 2 });
	assert.ok(JSON.parse(file("GENERATOR.json")).registryItems.includes("theme-claude"), "npx ui8kit add theme-claude");
	assert.ok(manifest.files.includes("src/styles/skins/claude.css"));
	// Without a Custom Skin nothing changes.
	const plain = packFilesFromPage(fixturePage, { skin: "claude" });
	assert.equal(plain.some((entry) => entry.path === THEME_FILE), false);
	assert.match(plain.find((entry) => entry.path === "index.html")!.content, /<html lang="en" data-skin="claude">/);
});

test("port: the skins, the neutral table and the stock reader stay in step with the registry", () => {
	assert.deepEqual([...SKIN_IDS].sort(), registrySkins().map((skin) => skin.id).sort(), "Stock's skins are the registry's theme-<skin> items");
	assert.equal(buildNeutrals(), readFileSync(root("apps/chat-web/src/lib/theme/magazine/skin-neutrals.ts"), "utf8"), "npm run theme:neutrals");
});

test("chat UI untouched: the skin goes on the preview document only; settings scroll on their own; en + ru", () => {
	const skins = web("lib/theme/skins.ts");
	assert.doesNotMatch(skins, /\bdocument\./, "skins.ts only writes the document it is given (the preview frame)");
	const pane = web("app/PreviewPane.svelte");
	assert.match(pane, /if \(doc\) void applySkin\(doc, id, config\)/);
	assert.match(pane, /data-slot="preview-skin-custom"/);
	assert.match(pane, /const forced = forcedPreviewMode\(doc\)/);
	assert.doesNotMatch(web("lib/theme/custom-skin.svelte.ts"), /documentElement/);
	const sidebar = web("app/ChatSidebar.svelte");
	assert.match(sidebar, /id="creator-settings"\s+class="min-h-0 shrink gap-2 overflow-y-auto overscroll-contain/);
	assert.match(sidebar, /max-h-\[75%\] min-h-0 shrink-0/);
	assert.match(sidebar, /<SettingsThemeImport \/>/);
	const view = web("app/SettingsThemeImport.svelte");
	assert.doesNotMatch(view, /<(input|textarea|select|div|span|button)\b/, "registry primitives only");
	for (const locale of ["en", "ru"]) {
		const messages = JSON.parse(web(`lib/i18n/${locale}.json`)).messages;
		for (const key of Object.keys(JSON.parse(web("lib/i18n/en.json")).messages).filter((k) => k.startsWith("themeImport.") || k === "preview.skinCustom")) {
			assert.ok(messages[key], `${locale}: ${key}`);
		}
	}
});

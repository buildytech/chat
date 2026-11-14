/**
 * Chat UI skin (ADR 0026): the chat shell's own dark and light ladders, the system / dark / light choice, and the
 * boundary with the preview (the skin's tokens live only in the chat document's stylesheet).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseLocale, UI_LOCALES } from "../../apps/chat-web/src/lib/i18n/locale-pref.ts";
import { parseThemePref, resolveThemeMode, THEME_PREFS } from "../../apps/chat-web/src/lib/theme/theme-pref.ts";
import { STORAGE_KEYS } from "../../apps/chat-web/src/lib/browser/storage-v1.ts";

const root = (path: string) => new URL(`../../${path}`, import.meta.url);
const web = (path: string) => readFileSync(root(`apps/chat-web/src/${path}`), "utf8");
const SKIN = web("styles/chat-skin.css");

function ladder(selector: string): Record<string, string> {
	const start = SKIN.indexOf(`${selector} {`);
	assert.ok(start >= 0, selector);
	const body = SKIN.slice(start, SKIN.indexOf("\n}", start));
	return Object.fromEntries([...body.matchAll(/--ui-([a-z-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
}
const LIGHT = ladder(":root:root");
const DARK = ladder(':root:is(.dark, [data-theme="dark"])');

function luminance(hex: string): number {
	const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

test("theme choice: system by default, explicit dark / light win over the system", () => {
	assert.deepEqual([...THEME_PREFS], ["system", "dark", "light"]);
	assert.equal(parseThemePref(null), "system");
	assert.equal(parseThemePref("sepia"), "system");
	assert.equal(parseThemePref("dark"), "dark");
	assert.equal(resolveThemeMode("system", true), "dark");
	assert.equal(resolveThemeMode("system", false), "light");
	assert.equal(resolveThemeMode("light", true), "light");
	assert.equal(resolveThemeMode("dark", false), "dark");
	assert.equal(STORAGE_KEYS.themePref, "buildy:v1:themePref");
	const store = web("lib/theme/theme.svelte.ts");
	assert.match(store, /addEventListener\("change"/, "system follows prefers-color-scheme live");
	assert.match(store, /writeKey\(THEME_KEY, mode\)/, "the resolved mode stays in buildy:v1:theme (session file, /preview)");
});

test("both ladders: same token names, tones step up from sidebar to active", () => {
	const names = ["sidebar", "canvas", "surface", "raised", "hover", "active", "popover", "text", "text-muted", "icon", "on-primary", "hairline", "edge", "field-edge", "focus", "danger", "danger-hover", "on-danger", "success", "warning"];
	for (const n of names) {
		assert.ok(LIGHT[n], `light --ui-${n}`);
		assert.ok(DARK[n], `dark --ui-${n}`);
	}
	const darkSteps = ["sidebar", "canvas", "surface", "raised", "hover", "active"].map((n) => luminance(DARK[n]));
	assert.deepEqual([...darkSteps].sort((a, b) => a - b), darkSteps, "dark: each surface a step lighter");
	const lightSteps = ["surface", "hover", "active"].map((n) => luminance(LIGHT[n]));
	assert.deepEqual([...lightSteps].sort((a, b) => b - a), lightSteps, "light: surface > hover > active");
});

test("contrast: text and focus floors; quiet default field outlines are separate from emphasis", () => {
	for (const [name, p] of [["light", LIGHT], ["dark", DARK]] as const) {
		const surfaces = ["sidebar", "canvas", "surface", "raised", "hover", "active", "popover"];
		for (const s of surfaces) {
			assert.ok(contrast(p.text, p[s]) >= 7, `${name} text on ${s}`);
			assert.ok(contrast(p["text-muted"], p[s]) >= 4.5, `${name} muted text on ${s}: ${contrast(p["text-muted"], p[s]).toFixed(2)}`);
		}
		for (const s of ["sidebar", "canvas", "surface", "raised"]) {
			assert.ok(contrast(p.danger, p[s]) >= 4.5, `${name} danger text on ${s}: ${contrast(p.danger, p[s]).toFixed(2)}`);
			assert.ok(contrast(p.success, p[s]) >= 4.5, `${name} success text on ${s}`);
			assert.ok(contrast(p.warning, p[s]) >= 4.5, `${name} warning text on ${s}`);
			assert.ok(contrast(p.edge, p[s]) >= 3, `${name} emphasis edge on ${s}: ${contrast(p.edge, p[s]).toFixed(2)}`);
			assert.ok(contrast(p["field-edge"], p[s]) >= 1.2, `${name} resting outline remains visible on ${s}`);
			assert.ok(contrast(p["field-edge"], p[s]) < contrast(p.edge, p[s]), `${name} resting outline is quieter than focus emphasis`);
			assert.ok(contrast(p.focus, p[s]) >= 3, `${name} focus ring on ${s}`);
		}
		for (const s of ["sidebar", "canvas", "surface", "hover"]) assert.ok(contrast(p.icon, p[s]) >= 3, `${name} icon on ${s}`);
		assert.ok(contrast(p.text, p["on-primary"]) >= 7, `${name} primary button label`);
		assert.ok(contrast(p.danger, p["on-danger"]) >= 4.5, `${name} destructive button label`);
		assert.ok(contrast(p["danger-hover"], p["on-danger"]) >= 4.5, `${name} destructive hover label`);
		assert.ok(contrast(p.hairline, p.canvas) < 1.5, `${name} hairline stays a hairline`);
		assert.notEqual(p.danger, p.success);
	}
});

test("radii: 8+4 grid, concentric scopes, controls 8", () => {
	const app = web("app.css");
	assert.match(app, /--radius: 8px;/);
	for (const m of app.matchAll(/--radius-[a-z0-9]+: (\d+)px/g)) assert.equal(Number(m[1]) % 4, 0, m[0]);
	for (const m of SKIN.matchAll(/--radius: (\d+)px/g)) assert.equal(Number(m[1]) % 4, 0, m[0]);
	assert.match(SKIN, /\[data-slot="feed-card"\][^{]*\{ --radius: 12px; \}/);
	assert.match(SKIN, /\* \{ --radius: 4px; \}/, "8px padding inside a 12px card: 4px inside");
	assert.match(SKIN, /\* \{ --radius: 8px; \}/, "4px padding inside a 12px row: 8px inside");
	assert.doesNotMatch(SKIN, /backdrop-filter|blur\(|text-shadow/, "no glass, no glow");
});

test("isolation: the skin is the chat document's only; the preview frame and /preview never load it", () => {
	assert.match(web("app.css"), /@import "\.\/styles\/chat-skin\.css";/);
	assert.doesNotMatch(web("preview-frame.css"), /chat-skin|app\.css/);
	assert.doesNotMatch(web("routes/preview/+page.svelte"), /app\.css|chat-skin/);
	const registryTheme = readFileSync(root("registry/svelte/src/styles/theme.css"), "utf8");
	assert.doesNotMatch(registryTheme, /--ui-/, "the registry (preview, export) has no chat UI token");
	assert.doesNotMatch(web("lib/theme/skins.ts"), /--ui-|chat-skin/);
	assert.doesNotMatch(web("lib/page-store/pack.ts"), /chat-skin|--ui-/, "the ZIP never carries the chat skin");
});

test("locale choice: English by default, Russian is the only other stored value", () => {
	assert.deepEqual([...UI_LOCALES], ["en", "ru"]);
	assert.equal(parseLocale(null), "en");
	assert.equal(parseLocale("ru"), "ru");
	assert.equal(parseLocale("de"), "en");
	assert.equal(STORAGE_KEYS.locale, "buildy:v1:locale");
});

test("Settings: theme choice, en+ru; secondary row actions stay keyboard reachable", () => {
	const sidebar = web("app/ProjectSidebar.svelte");
	assert.match(sidebar, /\{#each THEME_PREFS as option/);
	assert.match(sidebar, /pressed=\{theme\.pref === option\}/);
	assert.match(sidebar, /data-slot="recent-row"/);
	assert.match(sidebar, /data-slot="settings-locale"/);
	assert.match(sidebar, /uiLocale\.set\(option\)/);
	for (const lang of ["en", "ru"]) {
		const m = JSON.parse(web(`lib/i18n/${lang}.json`)).messages;
		for (const k of ["settings.theme", "settings.theme.system", "settings.theme.dark", "settings.theme.light", "settings.locale", "settings.locale.en", "settings.locale.ru"]) assert.ok(m[k], `${lang} ${k}`);
		const en = JSON.parse(web("lib/i18n/en.json")).messages;
		for (const k of Object.keys(en)) {
			assert.ok(m[k], `${lang} missing ${k}`);
			for (const token of String(en[k]).match(/\{[a-z]+\}/g) ?? []) assert.ok(String(m[k]).includes(token), `${lang} ${k} ${token}`);
		}
	}
	// hidden by opacity only (still in the tab order), shown on hover, focus-within and own focus; touch keeps them
	assert.match(SKIN, /@media \(hover: hover\) and \(pointer: fine\)/);
	assert.match(SKIN, /:is\(:hover, :focus-within\)/);
	assert.doesNotMatch(SKIN, /display:\s*none|visibility:\s*hidden/);
});

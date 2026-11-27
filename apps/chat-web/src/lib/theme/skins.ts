/**
 * Skins in the preview (ADR 0016): the registry items `theme-<skin>` of the pinned snapshot, the same CSS files
 * `npx ui8kit add theme-<skin>` writes (registry/svelte/src/styles/skins/). The preview document gets theme-base plus
 * the chosen skin and `data-skin` on its <html>, as the exported project does; the chat UI itself never wears a skin.
 */
import { registrySkin, registrySkinBaseCss, registrySkins, type RegistrySkin } from "@buildytech/builder-core";
import { loadSessionsJson } from "$lib/browser/persist";
import { CUSTOM_SKIN_BASE_CSS, CUSTOM_SKIN_ID, renderCustomSkin, type CustomSkinRender, type ThemeConfig } from "./custom-skin";

const SKIN_FILES = import.meta.glob<string>("../../../../../registry/svelte/src/styles/skins/*.css", {
	query: "?inline",
	import: "default"
});
const STYLE_ID = "buildy-skin";

export type { RegistrySkin };
export const skins = (): RegistrySkin[] => registrySkins();

function loaderFor(file: string): (() => Promise<string>) | null {
	const name = file.slice(file.lastIndexOf("/") + 1);
	const key = Object.keys(SKIN_FILES).find((path) => path.endsWith(`/${name}`));
	return key ? SKIN_FILES[key]! : null;
}

/** theme-base + the skin's CSS, or "" for the default theme (or a skin the snapshot does not carry). */
async function skinCss(id: string | null): Promise<string> {
	const skin = registrySkin(id);
	if (!skin) return "";
	const parts = await Promise.all([...registrySkinBaseCss(), skin.file].map((file) => loaderFor(file)?.() ?? Promise.resolve("")));
	return parts.join("\n");
}

const applied = new WeakMap<Document, string | null>();
/** What the last Custom Skin put on a document (removed before the next skin): attributes, inline properties, font links. */
const customApplied = new WeakMap<Document, { attrs: string[]; props: string[]; mode: CustomSkinRender["mode"] }>();
const FONT_LINK = "data-buildy-skin-font";

function clearCustom(doc: Document): void {
	const before = customApplied.get(doc);
	if (!before) return;
	const root = doc.documentElement;
	for (const name of before.attrs) root.removeAttribute(name);
	for (const prop of before.props) root.style.removeProperty(prop);
	for (const link of doc.head.querySelectorAll(`link[${FONT_LINK}]`)) link.remove();
	customApplied.delete(doc);
}

/**
 * The light / dark mode a Custom Skin fixes on a preview document (null: none, the preview follows the chat's mode).
 * The config carries its mode (Stock exports it), and its palette is computed for that mode.
 */
export function forcedPreviewMode(doc: Document): CustomSkinRender["mode"] | null {
	return customApplied.get(doc)?.mode ?? null;
}

function setMode(doc: Document, mode: CustomSkinRender["mode"]): void {
	const root = doc.documentElement;
	root.classList.toggle("dark", mode === "dark");
	root.dataset.theme = mode;
}

/** Put a Brand Skin on a document: base skin CSS, then Stock's root attributes and inline variables, mode and fonts. */
async function applyCustom(doc: Document, config: ThemeConfig, token: string): Promise<void> {
	const render = renderCustomSkin(config);
	const css = `${await skinCss(render.skin)}\n${CUSTOM_SKIN_BASE_CSS}`;
	if (applied.get(doc) !== token) return;
	clearCustom(doc);
	const el = doc.getElementById(STYLE_ID);
	let style = el instanceof HTMLStyleElement ? el : null;
	if (css) {
		if (!style) {
			style = doc.createElement("style");
			style.id = STYLE_ID;
			doc.head.appendChild(style);
		}
		style.textContent = css;
	} else style?.remove();
	const root = doc.documentElement;
	if (!render.skin) delete root.dataset.skin;
	for (const [name, value] of Object.entries(render.attrs)) root.setAttribute(name, value);
	for (const [prop, value] of render.style) root.style.setProperty(prop, value);
	for (const href of render.fonts) {
		const link = doc.createElement("link");
		link.rel = "stylesheet";
		link.href = href;
		link.setAttribute(FONT_LINK, "");
		doc.head.appendChild(link);
	}
	customApplied.set(doc, { attrs: Object.keys(render.attrs).filter((name) => name !== "data-skin"), props: render.style.map(([prop]) => prop), mode: render.mode });
	setMode(doc, render.mode);
}

/**
 * Put the skin on a document: its CSS in one <style id="buildy-skin"> and data-skin on <html> (none for the default).
 * `custom` (CUSTOM_SKIN_ID) renders the imported config (`custom`, null: none imported, the default theme).
 */
export async function applySkin(doc: Document, id: string | null, custom: ThemeConfig | null = null): Promise<void> {
	// A Brand Skin (per-project magazine-theme config) carries its own theme; the id may be `custom` or `brand-*`.
	if (custom) {
		const token = id ?? CUSTOM_SKIN_ID;
		applied.set(doc, token);
		await applyCustom(doc, custom, token);
		return;
	}
	const hadCustom = customApplied.has(doc);
	clearCustom(doc);
	if (hadCustom) doc.documentElement.style.removeProperty("color-scheme");
	const skin = registrySkin(id)?.id ?? null;
	applied.set(doc, skin);
	const css = await skinCss(skin);
	if (applied.get(doc) !== skin) return;
	const el = doc.getElementById(STYLE_ID);
	let style = el instanceof HTMLStyleElement ? el : null;
	if (!css) {
		style?.remove();
		delete doc.documentElement.dataset.skin;
		return;
	}
	if (!style) {
		style = doc.createElement("style");
		style.id = STYLE_ID;
		doc.head.appendChild(style);
	}
	style.textContent = css;
	doc.documentElement.dataset.skin = skin!;
}

/** Skin of a stored chat (standalone preview window reads it from the chat store, read-only). */
export function readSessionSkin(sessionId: string | null | undefined): string | null {
	if (!sessionId) return null;
	const chat = loadSessionsJson().find((item) => (item as { id?: unknown })?.id === sessionId) as { skin?: unknown } | undefined;
	return typeof chat?.skin === "string" ? chat.skin : null;
}

// ---- the page skin on a scope inside the app (the Blocks feed prototypes, ADR 0059) ---------------------------------

const KIT_THEME = import.meta.glob<string>("../../../../../registry/svelte/src/styles/theme.css", { query: "?raw", import: "default", eager: true });
const PROTOTYPE_TOKENS = import.meta.glob<string>("../../../../../prototypes/tokens.css", { query: "?raw", import: "default", eager: true });

/** Attribute of an element that wears the page's skin inside the app document (never the app chrome). */
export const PAGE_SKIN_SCOPE = "data-page-skin";
const SCOPE = `[${PAGE_SKIN_SCOPE}]`;

/** The body of the first top-level rule of `css` whose selector is exactly `selector` ("" when none). */
function ruleBody(css: string, selector: string): string {
	const at = css.indexOf(`\n${selector} {`);
	if (at < 0) return "";
	const open = css.indexOf("{", at);
	return css.slice(open + 1, css.indexOf("\n}", open));
}

/** Every selector of plain top-level rules prefixed with the scope (the prototype tokens have no at-rules). */
function scoped(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/([^{}]+)\{([^{}]*)\}/g, (_rule, selectors: string, body: string) => {
		const list = selectors
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => `${SCOPE} ${part}`);
		return `${list.join(", ")} {${body}}\n`;
	});
}

/**
 * CSS that dresses a scope element (PAGE_SKIN_SCOPE plus data-skin) in the page's skin: the kit's default theme
 * variables (light and dark, from the registry theme.css) so nothing of the app's own skin leaks in, theme-base and
 * the skin (they match any element with data-skin), and the prototype shape tokens scoped to it.
 */
export async function pageSkinScopeCss(id: string | null): Promise<string> {
	const theme = Object.values(KIT_THEME)[0] ?? "";
	const tokens = Object.values(PROTOTYPE_TOKENS)[0] ?? "";
	const light = ruleBody(theme, ":root");
	const dark = ruleBody(theme, ':is(.dark, [data-theme="dark"])');
	const base = `${SCOPE} {${light}\n  background-color: var(--background);\n  color: var(--foreground);\n}\n:is(.dark, [data-theme="dark"]) ${SCOPE}, ${SCOPE}:is(.dark, [data-theme="dark"]) {${dark}\n}\n`;
	return `${base}${await skinCss(registrySkin(id)?.id ?? null)}\n${scoped(tokens)}`;
}

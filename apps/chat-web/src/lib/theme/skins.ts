/**
 * Skins in the preview (ADR 0016): the registry items `theme-<skin>` of the pinned snapshot, the same CSS files
 * `npx ui8kit add theme-<skin>` writes (registry/svelte/src/styles/skins/). The preview document gets theme-base plus
 * the chosen skin and `data-skin` on its <html>, as the exported project does; the chat UI itself never wears a skin.
 */
import { registrySkin, registrySkinBaseCss, registrySkins, type RegistrySkin } from "@buildytech/builder-core";
import { loadSessionsJson } from "$lib/browser/persist";
import { CUSTOM_SKIN_BASE_CSS, type ThemeConfig } from "./custom-skin";
import { createSkinApplier, type SkinApplier } from "./skin-apply";
import { skinSource, type SkinSource } from "./skin-source";

const SKIN_FILES = import.meta.glob<string>("../../../../../registry/svelte/src/styles/skins/*.css", {
	query: "?inline",
	import: "default"
});
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

/** The CSS under a Brand Skin's palette or a registry skin on a whole document: theme-base, the skin, and Stock's base rules for a Brand Skin. */
async function documentBaseCss(source: SkinSource): Promise<string> {
	const css = await skinCss(source.registry);
	return source.config ? `${css}\n${CUSTOM_SKIN_BASE_CSS}` : css;
}

const appliers = new WeakMap<Document, SkinApplier>();

/** The applier of a document: the only writer of its skin (ADR 0074). */
function applierOf(doc: Document): SkinApplier {
	let applier = appliers.get(doc);
	if (!applier) {
		applier = createSkinApplier(doc, { target: "document", baseCss: documentBaseCss });
		appliers.set(doc, applier);
	}
	return applier;
}

/**
 * Put the skin on a document: the registry skin's CSS in one <style id="buildy-skin">, a Brand Skin's palette of both modes
 * in <style id="buildy-skin-modes">, and the root attributes (data-skin, ...). `custom` is the Brand Skin's theme (null: a
 * registry skin or the default theme). Rapid calls are last-write-wins (theme/skin-apply); resolves when this call is done
 * or superseded.
 */
export async function applySkin(doc: Document, id: string | null, custom: ThemeConfig | null = null): Promise<void> {
	await applierOf(doc).apply(skinSource(id, custom));
}

let scopeApplier: SkinApplier | null = null;

/** Put the skin on the scope elements of the app document (the Blocks feed cards): the same applier, the scope target. */
export function applyScopeSkin(source: SkinSource): Promise<boolean> {
	scopeApplier ??= createSkinApplier(document, { target: "scope", baseCss: (item) => pageSkinScopeCss(item.registry) });
	return scopeApplier.apply(source);
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
const PAGE_SKIN_SCOPE = "data-page-skin";
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
async function pageSkinScopeCss(id: string | null): Promise<string> {
	const theme = Object.values(KIT_THEME)[0] ?? "";
	const tokens = Object.values(PROTOTYPE_TOKENS)[0] ?? "";
	const light = ruleBody(theme, ":root");
	const dark = ruleBody(theme, ':is(.dark, [data-theme="dark"])');
	const base = `${SCOPE} {${light}\n  background-color: var(--background);\n  color: var(--foreground);\n}\n:is(.dark, [data-theme="dark"]) ${SCOPE}, ${SCOPE}:is(.dark, [data-theme="dark"]) {${dark}\n}\n`;
	return `${base}${await skinCss(registrySkin(id)?.id ?? null)}\n${scoped(tokens)}`;
}

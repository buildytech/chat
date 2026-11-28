/**
 * The page's skin on the Blocks feed prototypes (ADR 0059, 0074): the cards show the blocks in the theme of the page being
 * built, isolated from the app's own skin. The skin is the project's SkinSource (theme/skin-source), the same one the
 * preview frame wears; this file only places it on scope elements. Two <style> elements in the app document carry the
 * scope CSS (registry rules, palette of both modes); the one SkinApplier writes both atomically, last write wins, and
 * rewrites them whenever the source's key changes (a switch to, or an edit of, a Brand Skin on the same registry skin too).
 */
import { applyScopeSkin } from "../theme/skins.ts";
import { activeSkinSource } from "../theme/skin-source.svelte.ts";
import { skinSheets, type SkinSource } from "../theme/skin-source.ts";

type PageSkinScope = { attrs: Record<string, string>; style: string; source: SkinSource };

/** Attributes and inline style of a scope element for the skin in force (reactive: reads the project's skin and its content). */
export function pageSkinScope(source: SkinSource = activeSkinSource()): PageSkinScope {
	const sheets = skinSheets(source, "scope");
	return { attrs: sheets.attrs, style: sheets.style, source };
}

/** Keep the scope CSS of the skin in the app document: the one applier (theme/skin-apply), last write wins. */
export function syncPageSkinStyle(source: SkinSource): void {
	if (typeof document !== "undefined") void applyScopeSkin(source);
}

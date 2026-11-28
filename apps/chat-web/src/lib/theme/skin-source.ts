/**
 * The one description of "the skin in force" (ADR 0074). Pure: no DOM, no store. Every place that draws a page in a skin
 * (the preview frame, the standalone preview window, the Blocks feed thumbnails, the ZIP export) takes a SkinSource and
 * asks `skinSheets` for the rules, so a switch of skin, or an edit of one (new revision), reaches all of them alike.
 *
 * `key` changes whenever anything the skin draws with changes (the id, the registry skin under it, any value of the
 * theme config). Consumers react to the key, never to the registry skin alone: two Brand Skins share one registry skin.
 */
import { registrySkin } from "@buildytech/builder-core";
import { modeCss, renderCustomSkin, renderStyleText, ROOT_MODE_SELECTORS, SCOPE_MODE_SELECTORS, type ThemeConfig } from "./custom-skin.ts";

export type SkinTarget = "document" | "scope";

export type SkinSource = {
	/** Stable identity of what is drawn; equal keys draw equally. */
	key: string;
	/** The id the project stores (`brand-*`, `custom`, a registry skin or null). */
	id: string | null;
	/** The registry skin whose CSS sits under the palette (null: the default theme). */
	registry: string | null;
	/** The Brand Skin's theme, when the id is one. */
	config: ThemeConfig | null;
};

export function skinSource(id: string | null, config: ThemeConfig | null): SkinSource {
	const registry = config ? renderCustomSkin(config).skin : (registrySkin(id)?.id ?? null);
	return { key: `${id ?? ""}|${registry ?? ""}|${config ? JSON.stringify(config) : ""}`, id, registry, config };
}

export type SkinSheets = {
	/** The palette of both modes, one rule each (light, then dark); "" for a registry skin or the default. */
	modes: string;
	/** Attributes of the element that wears the skin (<html>, or the scope element). */
	attrs: Record<string, string>;
	/** Inline declarations of the mode-independent values (radius, fonts, per-element tokens), as a style attribute. */
	style: string;
	/** The same declarations as name/value pairs (for setting them on <html> one by one). */
	decls: Array<[string, string]>;
	/** Stylesheet URLs of the skin's fonts. */
	fonts: string[];
};

export const SCOPE_ATTR = "data-page-skin";

/** What a skin needs on a document (`document`: <html>, selectors on the root) or on a scope element inside the app. */
export function skinSheets(source: SkinSource, target: SkinTarget): SkinSheets {
	const scope = target === "scope";
	if (!source.config) {
		const attrs: Record<string, string> = scope ? { [SCOPE_ATTR]: "" } : {};
		if (source.registry) attrs["data-skin"] = source.registry;
		return { modes: "", attrs, style: "", decls: [], fonts: [] };
	}
	const render = renderCustomSkin(source.config);
	return {
		modes: modeCss(render, scope ? SCOPE_MODE_SELECTORS : ROOT_MODE_SELECTORS),
		attrs: scope ? { ...render.attrs, [SCOPE_ATTR]: "" } : { ...render.attrs },
		style: renderStyleText(render),
		decls: render.style,
		fonts: render.fonts
	};
}

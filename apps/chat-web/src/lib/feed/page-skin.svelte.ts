/**
 * The page's skin on the Blocks feed prototypes (ADR 0059): the cards show the blocks in the theme of the page being
 * built, isolated from the app's own skin. One <style> in the app document carries the scope CSS (theme/skins.ts
 * `pageSkinScopeCss`); a scope element gets the attributes below. A Custom Skin adds its inline variables.
 */
import { getProjectSkin } from "../project/index.ts";
import { customSkin } from "../theme/custom-skin.svelte.ts";
import { CUSTOM_SKIN_ID, renderCustomSkin } from "../theme/custom-skin.ts";
import { PAGE_SKIN_SCOPE, pageSkinScopeCss } from "../theme/skins.ts";

const STYLE_ID = "buildy-page-skin-scope";

type PageSkinScope = { attrs: Record<string, string>; style: string; skin: string | null };

/** Attributes and inline style of a scope element for the selected project's skin. */
export function pageSkinScope(): PageSkinScope {
	const skin = getProjectSkin();
	const config = customSkin.config;
	if (skin === CUSTOM_SKIN_ID && config) {
		const render = renderCustomSkin(config);
		const style = render.style.filter(([prop]) => prop !== "color-scheme").map(([prop, value]) => `${prop}:${value}`).join(";");
		return { attrs: { ...render.attrs, [PAGE_SKIN_SCOPE]: "" }, style, skin: render.skin };
	}
	const id = skin === CUSTOM_SKIN_ID ? null : skin;
	return { attrs: { [PAGE_SKIN_SCOPE]: "", ...(id ? { "data-skin": id } : {}) }, style: "", skin: id };
}

let written: string | null | undefined;

/** Keep the scope CSS of `skin` in the app document (idempotent; the last call wins). */
export function syncPageSkinStyle(skin: string | null): void {
	if (typeof document === "undefined" || written === skin) return;
	written = skin;
	void pageSkinScopeCss(skin).then((css) => {
		if (written !== skin) return;
		let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
		if (!style) {
			style = document.createElement("style");
			style.id = STYLE_ID;
			document.head.appendChild(style);
		}
		style.textContent = css;
	});
}

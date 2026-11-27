/**
 * The page's skin on the Blocks feed prototypes (ADR 0059): the cards show the blocks in the theme of the page being
 * built, isolated from the app's own skin. One <style> in the app document carries the scope CSS (theme/skins.ts
 * `pageSkinScopeCss`); a scope element gets the attributes below. A Brand Skin adds its inline variables.
 */
import { getProjectSkin } from "../project/index.ts";
import { projectBrandTheme } from "../theme/brand-skins.svelte.ts";
import { renderCustomSkin } from "../theme/custom-skin.ts";
import { PAGE_SKIN_SCOPE, pageSkinScopeCss } from "../theme/skins.ts";

const STYLE_ID = "buildy-page-skin-scope";

type PageSkinScope = { attrs: Record<string, string>; style: string; skin: string | null };

/** Attributes and inline style of a scope element for the selected project's skin. */
export function pageSkinScope(): PageSkinScope {
	const skin = getProjectSkin();
	const config = projectBrandTheme(skin);
	if (config) {
		const render = renderCustomSkin(config);
		const style = render.style.filter(([prop]) => prop !== "color-scheme").map(([prop, value]) => `${prop}:${value}`).join(";");
		return { attrs: { ...render.attrs, [PAGE_SKIN_SCOPE]: "" }, style, skin: render.skin };
	}
	return { attrs: { [PAGE_SKIN_SCOPE]: "", ...(skin ? { "data-skin": skin } : {}) }, style: "", skin: skin };
}

let written: string | null | undefined;

/** Keep the scope CSS of `skin` in the app document (idempotent; the last call wins). */
export function syncPageSkinStyle(skin: string | null): void {
	const config = projectBrandTheme(skin);
	const scope = config ? renderCustomSkin(config).skin : skin;
	if (typeof document === "undefined" || written === scope) return;
	written = scope;
	void pageSkinScopeCss(scope).then((css) => {
		if (written !== scope) return;
		const el = document.getElementById(STYLE_ID);
		let style = el instanceof HTMLStyleElement ? el : null;
		if (!style) {
			style = document.createElement("style");
			style.id = STYLE_ID;
			document.head.appendChild(style);
		}
		style.textContent = css;
	});
}

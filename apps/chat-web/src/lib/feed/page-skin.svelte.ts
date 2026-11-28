/**
 * The page's skin on the Blocks feed prototypes (ADR 0059): the cards show the blocks in the theme of the page being
 * built, isolated from the app's own skin. One <style> in the app document carries the scope CSS (theme/skins.ts
 * `pageSkinScopeCss`); a scope element gets the attributes below. A Brand Skin adds its inline variables.
 */
import { getProjectSkin } from "../project/index.ts";
import { projectBrandTheme } from "../theme/brand-skins.svelte.ts";
import { modeCss, renderCustomSkin, SCOPE_MODE_SELECTORS } from "../theme/custom-skin.ts";
import { PAGE_SKIN_SCOPE, pageSkinScopeCss } from "../theme/skins.ts";

const STYLE_ID = "buildy-page-skin-scope";
const MODES_ID = "buildy-page-skin-modes";

type PageSkinScope = { attrs: Record<string, string>; style: string; skin: string | null };

/** Attributes and inline style of a scope element for the selected project's skin. */
export function pageSkinScope(): PageSkinScope {
	const skin = getProjectSkin();
	const config = projectBrandTheme(skin);
	if (config) {
		const render = renderCustomSkin(config);
		const style = render.style.map(([prop, value]) => `${prop}:${value}`).join(";");
		return { attrs: { ...render.attrs, [PAGE_SKIN_SCOPE]: "" }, style, skin: render.skin };
	}
	return { attrs: { [PAGE_SKIN_SCOPE]: "", ...(skin ? { "data-skin": skin } : {}) }, style: "", skin: skin };
}

let written: string | null | undefined;
let writtenModes = "";

/** The Brand Skin's palette for both modes on the scope elements (light, and dark under a dark ancestor or scope). */
function syncModeStyle(config: ReturnType<typeof projectBrandTheme>): void {
	if (typeof document === "undefined") return;
	const css = config ? modeCss(renderCustomSkin(config), SCOPE_MODE_SELECTORS) : "";
	if (css === writtenModes) return;
	writtenModes = css;
	const el = document.getElementById(MODES_ID);
	if (!css) {
		el?.remove();
		return;
	}
	const style = el instanceof HTMLStyleElement ? el : document.createElement("style");
	style.id = MODES_ID;
	style.textContent = css;
	if (!style.isConnected) document.head.appendChild(style);
}

/** Keep the scope CSS of `skin` in the app document (idempotent; the last call wins). */
export function syncPageSkinStyle(skin: string | null): void {
	const config = projectBrandTheme(skin);
	syncModeStyle(config);
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

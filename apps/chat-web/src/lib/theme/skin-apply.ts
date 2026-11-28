/**
 * The one way a skin is put on a document (ADR 0074). A SkinApplier owns the skin of one document (the preview frame's, the
 * standalone preview window's) or of the scopes inside the app document (the Blocks feed cards), and is the only code that
 * writes it. It is deterministic by construction:
 *
 * - last write wins: every `apply` takes a version, the registry skin's CSS is loaded asynchronously, and a call whose version
 *   is no longer the latest drops its result, so out-of-order loads (a slow skin finishing after a fast one) never paint;
 * - atomic: after the load, the base CSS, the palette of both modes, the root attributes, the inline variables and the font
 *   links are written in one synchronous step, so a document never wears half of one skin and half of another;
 * - fixed order: the base `<style>` and the palette `<style>` are created together, base first, and only their text changes
 *   (never removed and re-added), so cascade order never depends on timing;
 * - idempotent and cached: applying the skin already worn writes nothing, and a base CSS loaded once commits synchronously.
 *
 * A fresh document (an iframe that loaded) starts with a fresh applier, so the skin in force is applied on load as on any switch.
 * No vite, no store: the CSS loader is injected, so this runs under node tests with a stand-in document.
 */
import { skinSheets, type SkinSource, type SkinTarget } from "./skin-source.ts";

export type SkinApplier = {
	/** Put `source` on the document. Resolves true when, afterwards, the document wears this skin (false: a later call superseded it). */
	apply(source: SkinSource): Promise<boolean>;
	/** Key of the skin last written, null before the first write. */
	readonly worn: string | null;
};

type Options = {
	target: SkinTarget;
	/** The CSS under the palette: the registry skin's rules (the loader may be slow and may answer out of order). */
	baseCss: (source: SkinSource) => Promise<string>;
};

const IDS: Record<SkinTarget, { base: string; modes: string }> = {
	document: { base: "buildy-skin", modes: "buildy-skin-modes" },
	scope: { base: "buildy-page-skin-scope", modes: "buildy-page-skin-modes" }
};
const FONT_ATTR = "data-buildy-skin-font";

const isStyle = (el: Element | null): el is HTMLStyleElement => el?.localName === "style";

function style(doc: Document, id: string): HTMLStyleElement | null {
	const el = doc.getElementById(id);
	return isStyle(el) ? el : null;
}

/** Both style elements, created together with the base first (or found, with the base put back before the palette). */
function ensureStyles(doc: Document, target: SkinTarget): { base: HTMLStyleElement; modes: HTMLStyleElement } {
	const ids = IDS[target];
	let base = style(doc, ids.base);
	let modes = style(doc, ids.modes);
	if (!base) {
		base = doc.createElement("style");
		base.id = ids.base;
		if (modes) doc.head.insertBefore(base, modes);
		else doc.head.appendChild(base);
	}
	if (!modes) {
		modes = doc.createElement("style");
		modes.id = ids.modes;
		doc.head.appendChild(modes);
	}
	return { base, modes };
}

export function createSkinApplier(doc: Document, options: Options): SkinApplier {
	const { target } = options;
	let latest = 0;
	let worn: string | null = null;
	let wornAttrs: string[] = [];
	let wornProps: string[] = [];
	let wornFonts = "";
	const loaded = new Map<string, string>();
	const baseKey = (source: SkinSource): string => `${source.registry ?? ""}|${source.config ? "palette" : "plain"}`;

	function commit(source: SkinSource, css: string): void {
		const sheets = skinSheets(source, target);
		const { base, modes } = ensureStyles(doc, target);
		base.textContent = css;
		modes.textContent = sheets.modes;
		if (target === "document") {
			const root = doc.documentElement;
			for (const name of wornAttrs) root.removeAttribute(name);
			for (const prop of wornProps) root.style.removeProperty(prop);
			for (const [name, value] of Object.entries(sheets.attrs)) root.setAttribute(name, value);
			for (const [prop, value] of sheets.decls) root.style.setProperty(prop, value);
			wornAttrs = Object.keys(sheets.attrs);
			wornProps = sheets.decls.map(([prop]) => prop);
		}
		const fonts = sheets.fonts.join(" ");
		if (fonts !== wornFonts) {
			for (const link of doc.head.querySelectorAll(`link[${FONT_ATTR}]`)) link.remove();
			for (const href of sheets.fonts) {
				const link = doc.createElement("link");
				link.rel = "stylesheet";
				link.href = href;
				link.setAttribute(FONT_ATTR, "");
				doc.head.appendChild(link);
			}
			wornFonts = fonts;
		}
		worn = source.key;
	}

	return {
		get worn() {
			return worn;
		},
		async apply(source) {
			const mine = ++latest;
			if (worn === source.key) return true;
			const key = baseKey(source);
			let css = loaded.get(key);
			if (css === undefined) {
				try {
					css = await options.baseCss(source);
				} catch {
					css = "";
				}
				loaded.set(key, css);
			}
			if (mine !== latest) return false;
			commit(source, css);
			return true;
		}
	};
}

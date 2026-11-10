/**
 * Skins in the preview (ADR 0016): the registry items `theme-<skin>` of the pinned snapshot, the same CSS files
 * `npx ui8kit add theme-<skin>` writes (registry/svelte/src/styles/skins/). The preview document gets theme-base plus
 * the chosen skin and `data-skin` on its <html>, as the exported project does; the chat UI itself never wears a skin.
 */
import { registrySkin, registrySkinBaseCss, registrySkins, type RegistrySkin } from "@buildytech/builder-core";
import { loadSessionsJson } from "$lib/browser/persist";

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
export async function skinCss(id: string | null): Promise<string> {
	const skin = registrySkin(id);
	if (!skin) return "";
	const parts = await Promise.all([...registrySkinBaseCss(), skin.file].map((file) => loaderFor(file)?.() ?? Promise.resolve("")));
	return parts.join("\n");
}

const applied = new WeakMap<Document, string | null>();

/** Put the skin on a document: its CSS in one <style id="buildy-skin"> and data-skin on <html> (none for the default). */
export async function applySkin(doc: Document, id: string | null): Promise<void> {
	const skin = registrySkin(id)?.id ?? null;
	applied.set(doc, skin);
	const css = await skinCss(skin);
	if (applied.get(doc) !== skin) return;
	let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
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

/**
 * The skin in force for the selected project as a reactive SkinSource (ADR 0074): the single read the preview pane and the
 * catalog thumbnails share. Reading it inside `$derived` / `$effect` tracks the project's skin choice and the content of
 * the chosen Brand Skin (so an edit of it, or a switch to another one, re-runs the reader).
 */
import { getProjectSkin } from "../project/index.ts";
import { projectBrandTheme } from "./brand-skins.svelte.ts";
import type { ThemeConfig } from "./custom-skin.ts";
import { skinSource, type SkinSource } from "./skin-source.ts";

let last: { id: string | null; config: ThemeConfig | null; source: SkinSource } | null = null;

/** The same object while the id and the theme object are the same, so a feed of cards builds the source once, not per card. */
export function activeSkinSource(): SkinSource {
	const id = getProjectSkin();
	const config = projectBrandTheme(id);
	if (last && last.id === id && last.config === config) return last.source;
	last = { id, config, source: skinSource(id, config) };
	return last.source;
}

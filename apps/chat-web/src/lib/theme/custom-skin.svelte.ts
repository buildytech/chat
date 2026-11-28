/**
 * Compatibility surface for Brand Skins (ADR 0070): Settings import and ZIP helpers read the
 * current project's Brand Skin list (plus a one-time migration of the legacy shared slot).
 */
import { configText, type ThemeConfig, type ThemeImport } from "./custom-skin";
import {
	importedBrandSkin,
	importBrandTheme,
	migrateLegacyBrandSkins,
	packSkinOptions,
	projectBrandTheme,
	removeImportedBrandTheme
} from "./brand-skins.svelte.ts";
import { getProject, getSelectedProject } from "../project/store.svelte.ts";
import { readStoredProject } from "../project/stored.ts";
import { themeOfProjectSkin } from "./brand-skins.ts";

export { packSkinOptions };

export const customSkin = {
	get config(): ThemeConfig | null {
		migrateLegacyBrandSkins();
		return importedBrandSkin()?.theme ?? null;
	},
	import(input: unknown): ThemeImport {
		return importBrandTheme(input);
	},
	remove(): void {
		removeImportedBrandTheme();
	},
	exportText(): string | null {
		const theme = importedBrandSkin()?.theme;
		return theme ? configText(theme) : null;
	}
};

/** Theme of a stored project's chosen Brand Skin (standalone preview); the selected project when no id is given. */
export function storedCustomSkin(sessionId?: string | null): ThemeConfig | null {
	migrateLegacyBrandSkins();
	if (sessionId) {
		// The preview window never hydrates the project store: its session's record comes from storage (ADR 0073).
		const project = getProject(sessionId) ?? readStoredProject(sessionId);
		return themeOfProjectSkin(project, project?.skin ?? null);
	}
	const project = getSelectedProject();
	return themeOfProjectSkin(project, project?.skin ?? null) ?? projectBrandTheme(project?.skin ?? null);
}

/**
 * Brand Skins of the selected project (ADR 0070), plus a one-time migration of the legacy
 * `buildy:v1:customSkin` browser slot into that project (and any project still on skin=custom).
 */
import { getSelectedProject, getSelectedProjectId, getProjects, putProject } from "../project/store.svelte.ts";
import { browserStorage, readKey, STORAGE_KEYS, writeKey } from "$lib/browser/storage-v1";
import { importThemeConfig, parseCustomSkinSlot, type ThemeConfig, type ThemeImport } from "./custom-skin";
import {
	IMPORTED_BRAND_SKIN_ID,
	importedThemeBrief,
	migrateLegacyCustomSkin,
	packSkinOptionsFor,
	removeBrandSkin,
	upsertBrandSkin,
	brandSkinOf,
	brandSkinsOf,
	themeOfProjectSkin,
	type BrandSkinRecord
} from "./brand-skins.ts";

let generation = $state(0);

function bump(): void {
	generation += 1;
}

function legacyConfig(): ThemeConfig | null {
	const slot = parseCustomSkinSlot(readKey(STORAGE_KEYS.customSkin));
	return slot && "config" in slot ? slot.config : null;
}

let migrated = false;

/** Apply the legacy shared slot to stored projects once (idempotent). */
export function migrateLegacyBrandSkins(): void {
	if (migrated || !browserStorage()) return;
	migrated = true;
	const legacy = legacyConfig();
	if (!legacy) return;
	const { projects, clearLegacy } = migrateLegacyCustomSkin(getProjects(), legacy, getSelectedProjectId());
	const changed = projects.some((project, i) => project !== getProjects()[i]);
	if (changed) {
		// replaceProjects unbinds the page; only rewrite the list in place.
		for (const project of projects) {
			const prev = getProjects().find((item) => item.id === project.id);
			if (prev !== project) putProject(project);
		}
	}
	if (clearLegacy && !projects.some((project) => project.skin === IMPORTED_BRAND_SKIN_ID && !brandSkinOf(project, IMPORTED_BRAND_SKIN_ID))) {
		writeKey(STORAGE_KEYS.customSkin, null);
	}
	bump();
}

export function projectBrandSkins(): BrandSkinRecord[] {
	void generation;
	migrateLegacyBrandSkins();
	return brandSkinsOf(getSelectedProject());
}

export function projectBrandTheme(skin: string | null | undefined): ThemeConfig | null {
	void generation;
	migrateLegacyBrandSkins();
	return themeOfProjectSkin(getSelectedProject(), skin);
}

export function importedBrandSkin(): BrandSkinRecord | null {
	return brandSkinOf(getSelectedProject(), IMPORTED_BRAND_SKIN_ID) ?? (legacyConfig() && !getSelectedProject() ? {
		id: IMPORTED_BRAND_SKIN_ID,
		name: importedThemeBrief().name,
		createdAt: "",
		source: "import",
		brief: importedThemeBrief(),
		theme: legacyConfig()!
	} : null);
}

/** Settings import: write a Brand Skin onto the current project (id `custom`); no shared slot. */
export function importBrandTheme(input: unknown): ThemeImport {
	const result = importThemeConfig(input);
	if (!result.ok) return result;
	const project = getSelectedProject();
	const record: BrandSkinRecord = {
		id: IMPORTED_BRAND_SKIN_ID,
		name: importedThemeBrief().name,
		createdAt: new Date().toISOString(),
		source: "import",
		brief: importedThemeBrief(),
		theme: result.config
	};
	if (project) putProject(upsertBrandSkin(project, record, false));
	else writeKey(STORAGE_KEYS.customSkin, JSON.stringify({ v: 1, config: result.config }));
	bump();
	return result;
}

export function removeImportedBrandTheme(): void {
	const project = getSelectedProject();
	if (project && brandSkinOf(project, IMPORTED_BRAND_SKIN_ID)) putProject(removeBrandSkin(project, IMPORTED_BRAND_SKIN_ID));
	writeKey(STORAGE_KEYS.customSkin, null);
	bump();
}

export function saveBrandSkin(record: BrandSkinRecord, select: boolean): BrandSkinRecord {
	const project = getSelectedProject();
	if (project) putProject(upsertBrandSkin(project, record, select));
	bump();
	return record;
}

/** Export options of this project's chosen skin (Brand Skin theme, or a registry skin id). */
export function packSkinOptions(skin: string | null): { skin: string | null; theme?: ThemeConfig; contract?: Record<string, unknown> } {
	void generation;
	migrateLegacyBrandSkins();
	return packSkinOptionsFor(skin, getSelectedProject());
}

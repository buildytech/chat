/**
 * The Custom Skin slot of this browser (ADR 0025): one imported magazine-theme v2 config under `buildy:v1:customSkin`.
 * A stored value that fails its check goes to quarantine (ADR 0015) and the slot reads empty. Reactive, so the preview
 * and the skin selector follow an import or a removal at once.
 */
import { browserStorage, quarantine, readKey, STORAGE_KEYS, writeKey } from "$lib/browser/storage-v1";
import { configText, CUSTOM_SKIN_ID, importThemeConfig, parseCustomSkinSlot, renderCustomSkin, serializeCustomSkinSlot, type ThemeConfig, type ThemeImport } from "./custom-skin";

function load(): ThemeConfig | null {
	const raw = readKey(STORAGE_KEYS.customSkin);
	const slot = parseCustomSkinSlot(raw);
	if (!slot) return null;
	if ("config" in slot) return slot.config;
	const store = browserStorage();
	if (store && raw != null && quarantine(store, { key: STORAGE_KEYS.customSkin, reason: slot.error, raw })) writeKey(STORAGE_KEYS.customSkin, null);
	return null;
}

let config = $state.raw<ThemeConfig | null>(typeof localStorage === "undefined" ? null : load());

export const customSkin = {
	get config(): ThemeConfig | null {
		return config;
	},
	/** Import one config: replaces the slot when it passes, changes nothing when it does not. */
	import(input: unknown): ThemeImport {
		const result = importThemeConfig(input);
		if (result.ok) {
			config = result.config;
			writeKey(STORAGE_KEYS.customSkin, serializeCustomSkinSlot(result.config));
		}
		return result;
	},
	remove(): void {
		config = null;
		writeKey(STORAGE_KEYS.customSkin, null);
	},
	/** The slot as Stock's Export writes it (null: empty). */
	exportText(): string | null {
		return config ? configText(config) : null;
	}
};

/** The slot as stored now, read again (the standalone preview window follows imports made in the chat tab). */
export function storedCustomSkin(): ThemeConfig | null {
	const slot = parseCustomSkinSlot(readKey(STORAGE_KEYS.customSkin));
	return slot && "config" in slot ? slot.config : null;
}

/** Export options of a chat skin id: the Custom Skin exports its base skin plus the config; others as before. */
export function packSkinOptions(skin: string | null): { skin: string | null; theme?: ThemeConfig } {
	if (skin !== CUSTOM_SKIN_ID) return { skin };
	if (!config) return { skin: null };
	return { skin: renderCustomSkin(config).skin, theme: config };
}

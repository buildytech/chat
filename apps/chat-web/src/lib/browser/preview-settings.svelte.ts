import { PREVIEW_CLEAN_KEY, parsePreviewClean, serializePreviewClean } from "./preview-settings";

function read(): boolean {
	if (typeof localStorage === "undefined") return false;
	try {
		return parsePreviewClean(localStorage.getItem(PREVIEW_CLEAN_KEY));
	} catch {
		return false;
	}
}

let clean = $state(read());

/** "Hide service labels in Preview" (Settings), kept in this browser. */
export const previewSettings = {
	get hideServiceLabels(): boolean {
		return clean;
	},
	setHideServiceLabels(on: boolean): void {
		clean = on;
		try {
			localStorage.setItem(PREVIEW_CLEAN_KEY, serializePreviewClean(on));
		} catch {
			/* storage unavailable: the choice lasts for this tab */
		}
	}
};

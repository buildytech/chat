import { PREVIEW_CLEAN_KEY, parsePreviewClean, serializePreviewClean } from "./preview-settings";
import { readKey, writeKey } from "./storage-v1.ts";

function read(): boolean {
	return parsePreviewClean(readKey(PREVIEW_CLEAN_KEY));
}

let clean = $state(read());

/** "Hide service labels in Preview" (Settings), kept in this browser. */
export const previewSettings = {
	get hideServiceLabels(): boolean {
		return clean;
	},
	setHideServiceLabels(on: boolean): void {
		clean = on;
		writeKey(PREVIEW_CLEAN_KEY, serializePreviewClean(on));
	}
};

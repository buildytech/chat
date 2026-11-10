/**
 * Preview settings (pure, no runes): the "Hide service labels in Preview" choice and the URL of the standalone preview
 * window. Persisted under the buildy:v1 key space in this browser.
 */
import { STORAGE_KEYS } from "./storage-v1.ts";

export const PREVIEW_CLEAN_KEY = STORAGE_KEYS.previewHideServiceLabels;

export function parsePreviewClean(raw: string | null | undefined): boolean {
	return raw === "1";
}

export function serializePreviewClean(on: boolean): string {
	return on ? "1" : "0";
}

/** The standalone preview of a chat's page: the /preview route renders the same registry blocks, no chat UI, no labels. */
export function previewWindowUrl(sessionId: string | null | undefined, base = ""): string {
	const query = sessionId ? `?session=${encodeURIComponent(sessionId)}` : "";
	return `${base}/preview${query}`;
}

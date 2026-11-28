/**
 * A project read straight from storage, read-only: no project store, no page binding, no URL change, nothing written.
 * The standalone preview window (/preview, /home?preview&session=...) is a separate document of the same origin; it
 * does not hydrate the project store, so it reads the Brand Skin of its session from here.
 */
import { loadSessionsJson } from "../browser/persist.ts";
import { projectOfDoc, type SessionDoc } from "./doc.ts";
import type { Project } from "./types.ts";

export function readStoredProject(id: string | null | undefined): Project | null {
	if (!id) return null;
	const doc = loadSessionsJson().find((item) => typeof item === "object" && item !== null && (item as { id?: unknown }).id === id);
	return doc ? projectOfDoc(doc as SessionDoc) : null;
}

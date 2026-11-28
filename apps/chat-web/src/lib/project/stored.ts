/**
 * A project read straight from storage, read-only: no project store, no page binding, no URL change, nothing written.
 * The standalone preview window (/preview, /home?preview&session=...) is a separate document of the same origin; it
 * does not hydrate the project store, so it reads the Brand Skin of its session from here.
 */
import { loadSessionsJson } from "../browser/persist.ts";
import { projectOfDoc, type SessionDoc } from "./doc.ts";
import type { Project } from "./types.ts";

const isDoc = (value: unknown): value is SessionDoc => typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";

export function readStoredProject(id: string | null | undefined): Project | null {
	if (!id) return null;
	const doc = loadSessionsJson().find((item) => isDoc(item) && item.id === id);
	return isDoc(doc) ? projectOfDoc(doc) : null;
}

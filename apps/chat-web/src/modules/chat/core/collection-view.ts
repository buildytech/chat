import { getSelectedProject } from "../../../lib/project/store.svelte.ts";
import type { ChatCollection } from "./collection";

/** The selected project's Stock collection (session 1.3.0), or null. */
export function getChatCollection(): ChatCollection | null {
	return getSelectedProject()?.collection ?? null;
}

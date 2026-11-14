/** Export and import of the session file for the chat: the project module does the file, the chat aborts a run and selects. */
import { exportProjects, importProjects, type ImportResult } from "../project/file.svelte.ts";
import type { SessionApp, SessionFile, SessionPins, SessionPrefs, SessionSettings } from "../browser/session-file";
import { abortInflight, selectSession } from "./chat.svelte";

export type { ImportResult };

/** The session file buildy:v1 of this browser (every chat, its page record, revisions and history). Writes nothing. */
export function exportSessions(meta: { app: SessionApp; pins: SessionPins; settings?: SessionSettings; prefs?: SessionPrefs }): SessionFile {
	return exportProjects(meta);
}

/** Load a session file (see `importProjects`); on success the file's selected chat (else the first imported) is selected. */
export async function importSessions(input: unknown): Promise<ImportResult> {
	const result = importProjects(input, abortInflight);
	if (result.ok && result.selected) await selectSession(result.selected, { history: "replace" });
	return result;
}

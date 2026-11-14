/**
 * The session file buildy:v1 of this browser (export) and its import: every project, its page record, revisions and
 * history. No chat code: the chat part of a project is `ext.chat`, carried through unchanged.
 */
import { SESSIONS_KEY, deleteProjectPage, quarantineValue, readProjectPage, writeAllProjectPages, type StoredPageRecord } from "../browser/persist";
import { buildSessionFile, parseSessionFile, splitSessionFile, type ParsedSessionFile, type SessionApp, type SessionFile, type SessionPins, type SessionPrefs, type SessionSettings, type StoredChat } from "../browser/session-file";
import { noteMigration } from "../browser/storage-v1.ts";
import { docOfProject, projectOfDoc, type SessionDoc } from "./doc.ts";
import { getProjects, getSelectedProjectId, normalizeProject, replaceProjects, saveProjects } from "./store.svelte.ts";
import type { Project } from "./types.ts";

export type ImportResult =
	| { ok: true; added: string[]; replaced: string[]; selected: string | null }
	| (Extract<ParsedSessionFile, { ok: false }> & { added?: never })
	| { ok: false; code: "storage_refused"; issues: { path: string; keyword: string }[] };

/** The session file of this browser. Writes nothing the author did not already have (it saves the list first). */
export function exportProjects(meta: { app: SessionApp; pins: SessionPins; settings?: SessionSettings; prefs?: SessionPrefs }): SessionFile {
	const projects = getProjects();
	if (getSelectedProjectId()) saveProjects();
	const pages: Record<string, StoredPageRecord | null> = {};
	for (const project of projects) pages[project.projectId] = readProjectPage(project.projectId);
	return buildSessionFile({ chats: projects.map(docOfProject) as unknown as StoredChat[], pages, selectedSessionId: getSelectedProjectId(), ...meta });
}

/**
 * Load a session file: checked against session.schema.json and its program checks first (nothing is written when it
 * fails). A project with an id that already exists here is replaced; the replaced one and its page record are kept in
 * quarantine first, so an import never loses data. `selected` is the id to select next (the caller selects it).
 */
export function importProjects(input: unknown, beforeWrite?: () => void): ImportResult {
	const parsed = parseSessionFile(input);
	if (!parsed.ok) return parsed;
	noteMigration("pageV1", parsed.legacy.pageV1);
	const { chats, pages } = splitSessionFile(parsed.file);
	const incoming = new Set(chats.map((c) => c.id));
	const replaced: string[] = [];
	for (const project of getProjects()) {
		if (!incoming.has(project.id)) continue;
		const page = readProjectPage(project.projectId);
		if (!quarantineValue(SESSIONS_KEY, "replaced_by_import", JSON.stringify({ ...docOfProject(project), page }))) {
			return { ok: false, code: "storage_refused", issues: [{ path: `$.sessions.${project.id}`, keyword: "quarantine" }] };
		}
		replaced.push(project.id);
	}
	beforeWrite?.();
	const imported: Project[] = (chats as unknown as SessionDoc[]).map((doc) => normalizeProject(projectOfDoc(doc)));
	const kept = getProjects().filter((p) => !incoming.has(p.id));
	replaceProjects([...imported, ...kept]);
	// A page record is keyed by the project id; a file without one for a project drops the local record.
	for (const project of imported) if (!(project.projectId in pages)) deleteProjectPage(project.projectId);
	writeAllProjectPages(pages);
	return { ok: true, added: chats.map((c) => c.id).filter((id) => !replaced.includes(id)), replaced, selected: parsed.file.selectedSessionId ?? imported[0]?.id ?? null };
}

/**
 * The stored session document (`session.schema.json#/$defs/session`, session 1.9.0) as a project plus its extensions.
 * Pure. `projectOfDoc` and `docOfProject` are inverse for every valid document: a document without `messages` (a
 * project with no chat) has no `ext.chat` and is written back without one; a document with `messages` keeps them.
 * `projectId` is written only when it differs from `id`, so every 1:1 document stays byte-compatible with files and
 * stores written before 1.9.0 (and with the previous app version).
 */
import type { Project } from "./types.ts";

/** Keys of the session schema that belong to the project, in schema order. */
export const PROJECT_KEYS = ["title", "createdAt", "updatedAt", "scenarioId", "screenId", "pageId", "pageBound", "pageRevision", "skin", "collection", "history"] as const;

/**
 * Extensions (`ext.<name>`) the loaded modules own: the schema keys each one keeps in the session document. A module
 * registers its keys before the first load (`registerModule`); the project store reads none of them. Keys no module
 * claims are carried through untouched (`Project.extra`), so a document written with a module on survives a load and
 * a save with that module off.
 */
const extensions = new Map<string, readonly string[]>();
export function registerProjectExtension(name: string, keys: readonly string[]): void {
	extensions.set(name, keys);
}
const claimed = (): Set<string> => new Set([...extensions.values()].flat());

/** Schema order of the whole session def (session.schema.json), so a written document always has the same key order. */
const SESSION_KEY_ORDER = ["id", "projectId", "title", "createdAt", "updatedAt", "mode", "scenarioId", "screenId", "selectedModelId", "pageId", "pageBound", "pageRevision", "skin", "collection", "usage", "messages", "page", "history"];

export type SessionDoc = { id: string; title: string; updatedAt: string; projectId?: string; [key: string]: unknown };

export function projectOfDoc(doc: SessionDoc): Project {
	const project: Record<string, unknown> = { id: doc.id, projectId: doc.projectId ?? doc.id };
	for (const key of PROJECT_KEYS) if (doc[key] !== undefined) project[key] = doc[key];
	const ext: Record<string, Record<string, unknown>> = {};
	for (const [name, keys] of extensions) {
		const present = keys.filter((key) => doc[key] !== undefined);
		// An extension exists when its payload does: a chat exists when the document has messages (or a mode picked before the first one).
		if (present.length) ext[name] = Object.fromEntries(present.map((key) => [key, doc[key]]));
	}
	project.ext = ext;
	const known = new Set<string>(["id", "projectId", "page", ...PROJECT_KEYS, ...claimed()]);
	const extra = Object.entries(doc).filter(([key, value]) => !known.has(key) && value !== undefined);
	if (extra.length) project.extra = Object.fromEntries(extra);
	return project as Project;
}

export function docOfProject(project: Project): SessionDoc {
	const flat: Record<string, unknown> = { ...project.extra, id: project.id };
	if (project.projectId !== project.id) flat.projectId = project.projectId;
	for (const key of PROJECT_KEYS) if (project[key] !== undefined) flat[key] = project[key];
	for (const [name, keys] of extensions) {
		const payload = project.ext[name];
		if (payload) for (const key of keys) if (payload[key] !== undefined) flat[key] = payload[key];
	}
	const ordered = SESSION_KEY_ORDER.filter((key) => flat[key] !== undefined);
	const rest = Object.keys(flat).filter((key) => !SESSION_KEY_ORDER.includes(key) && flat[key] !== undefined);
	return Object.fromEntries([...ordered, ...rest].map((key) => [key, flat[key]])) as SessionDoc;
}

/**
 * The stored session document (`session.schema.json#/$defs/session`, session 1.10.0) as a project plus its extensions.
 * Pure. `projectOfDoc` and `docOfProject` are inverse for every document this app writes: the extensions of a project
 * (`ext.<name>`, the chat is `ext.chat`) are stored under `ext` as they are, a project with no extension has no `ext`.
 * `projectId` is written only when it differs from `id`.
 */
import type { Project } from "./types.ts";

/** Keys of the session schema that belong to the project, in schema order. */
export const PROJECT_KEYS = ["title", "createdAt", "updatedAt", "scenarioId", "screenId", "pageId", "pageBound", "pageRevision", "skin", "collection", "history"] as const;

/**
 * Flat session keys older documents (before 1.10.0) kept for a module: a module that registers them gets the keys it
 * finds at the top of a document as its `ext.<name>` when the document has none (a read, never a write: documents are
 * always written with `ext`). Keys no module claims are carried through untouched (`Project.extra`).
 */
const legacy = new Map<string, readonly string[]>();
export function registerLegacyKeys(name: string, keys: readonly string[]): void {
	legacy.set(name, keys);
}
const claimed = (): Set<string> => new Set([...legacy.values()].flat());

/** Schema order of the whole session def (session.schema.json), so a written document always has the same key order. */
const SESSION_KEY_ORDER = ["id", "projectId", "title", "createdAt", "updatedAt", "scenarioId", "screenId", "pageId", "pageBound", "pageRevision", "skin", "collection", "page", "history", "ext"];

export type SessionDoc = { id: string; title: string; updatedAt: string; projectId?: string; [key: string]: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function projectOfDoc(doc: SessionDoc): Project {
	const project: Record<string, unknown> = { id: doc.id, projectId: doc.projectId ?? doc.id };
	for (const key of PROJECT_KEYS) if (doc[key] !== undefined) project[key] = doc[key];
	const ext: Record<string, Record<string, unknown>> = {};
	if (isRecord(doc.ext)) for (const [name, payload] of Object.entries(doc.ext)) if (isRecord(payload)) ext[name] = payload;
	for (const [name, keys] of legacy) {
		const present = keys.filter((key) => doc[key] !== undefined);
		if (present.length && !ext[name]) ext[name] = Object.fromEntries(present.map((key) => [key, doc[key]]));
	}
	project.ext = ext;
	const known = new Set<string>(["id", "projectId", "page", "ext", ...PROJECT_KEYS, ...claimed()]);
	const extra = Object.entries(doc).filter(([key, value]) => !known.has(key) && value !== undefined);
	if (extra.length) project.extra = Object.fromEntries(extra);
	return project as Project;
}

export function docOfProject(project: Project): SessionDoc {
	const flat: Record<string, unknown> = { ...project.extra, id: project.id };
	if (project.projectId !== project.id) flat.projectId = project.projectId;
	for (const key of PROJECT_KEYS) if (project[key] !== undefined) flat[key] = project[key];
	if (Object.keys(project.ext).length) flat.ext = project.ext;
	const ordered = SESSION_KEY_ORDER.filter((key) => flat[key] !== undefined);
	const rest = Object.keys(flat).filter((key) => !SESSION_KEY_ORDER.includes(key) && flat[key] !== undefined);
	return Object.fromEntries([...ordered, ...rest].map((key) => [key, flat[key]])) as SessionDoc;
}

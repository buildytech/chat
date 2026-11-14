/**
 * Pure transitions of a project (no storage, no runes, no chat): the store applies them and saves. Each returns a new
 * project and leaves the argument alone.
 */
import { recordRevision, type StoredChat } from "../browser/session-file.ts";
import type { SessionRevisionEntry } from "@buildytech/page-contract/session";
import type { Project } from "./types.ts";
import { withoutItem } from "./collection.ts";

export function newProject(input: { id: string; title: string; now: string; skin?: string | null; ext?: Project["ext"] }): Project {
	return {
		id: input.id,
		projectId: input.id,
		title: input.title,
		updatedAt: input.now,
		...(input.skin ? { skin: input.skin } : {}),
		ext: input.ext ?? {}
	};
}

/** One page revision recorded on the project: pageRevision, pageId and one history entry (ADR 0015). */
export function withRevision(project: Project, entry: SessionRevisionEntry): Project {
	const next = recordRevision(project as unknown as StoredChat, entry) as unknown as Project;
	return { ...project, pageRevision: next.pageRevision, pageId: next.pageId, history: next.history };
}

export function withSkin(project: Project, skin: string | null): Project {
	if ((project.skin ?? null) === skin) return project;
	const { skin: _drop, ...rest } = project;
	return skin ? { ...rest, skin } : rest;
}

export function withExt(project: Project, name: string, payload: Record<string, unknown> | null): Project {
	const { [name]: _drop, ...others } = project.ext;
	return { ...project, ext: payload ? { ...others, [name]: payload } : others };
}

export function withoutCollectionItem(project: Project, index: number): Project {
	return project.collection ? { ...project, collection: withoutItem(project.collection, index) } : project;
}

/** After a pending proposal became the applied page: the page id, its revision and the screen it came from. */
export function withApplied(project: Project, applied: { pageId?: string; revision: number | null; screenId: string | null; now: string }): Project {
	return { ...project, updatedAt: applied.now, pageId: applied.pageId, pageRevision: applied.revision, screenId: applied.screenId };
}

export const bySavedAt = (a: Project, b: Project): number => b.updatedAt.localeCompare(a.updatedAt);

/** Page id of a project that has no page yet: stable per project (`page-<uuid>`). */
export function draftPageId(project: Pick<Project, "projectId"> | null): string {
	return project ? `page-${project.projectId.replace(/^(session|project)-/, "")}`.slice(0, 64) : "page-draft";
}

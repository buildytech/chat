import type { ScenarioId } from "@buildytech/builder-core";
import type { SessionRevisionEntry } from "@buildytech/page-contract/session";
import type { ProjectCollection } from "./collection.ts";

/**
 * A project: the page, its skin, collection and revision history (session buildy:v1 1.9.0). It exists without a chat.
 * Extensions (`ext`, by name) hold what other modules keep with the project: the chat module keeps `ext.chat`
 * (messages, mode, selected model, usage). The project store never reads an extension; it stores and returns it.
 */
export type Project = {
	/** The session id: the selection key (`?session=`) and the id in the stored session list. */
	id: string;
	/** The key of the page record in the pages blob. Equal to `id` unless a session file said otherwise (1.9.0 `projectId`). */
	projectId: string;
	title: string;
	createdAt?: string;
	updatedAt: string;
	scenarioId?: ScenarioId | null;
	screenId?: string | null;
	pageId?: string;
	pageBound?: boolean;
	pageRevision?: number | null;
	/** Skin of the page (registry item `theme-<skin>`); null or absent is the default theme. */
	skin?: string | null;
	/** Revisions of the applied page, oldest first (ADR 0015). Last entry <= pageRevision. */
	history?: SessionRevisionEntry[];
	collection?: ProjectCollection;
	ext: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
};

export type ProjectSummary = Pick<Project, "id" | "title" | "updatedAt">;

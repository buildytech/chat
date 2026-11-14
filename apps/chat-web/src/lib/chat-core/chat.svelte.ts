/**
 * The chat module (ADR 0040): the chat view of the selected project, the composer mode, the run state and the
 * selection wrappers that abort a run and reload the workspace context. The project (page, skin, collection, history,
 * persistence) lives in `../project`; the chat keeps only `project.ext.chat` (messages, mode, selected model, usage).
 */
import type { AgentMode } from "@buildytech/chat-agent";
import { t } from "../i18n/dictionary";
import { getPersistError } from "../browser/persist";
import { hydrateSessionContext } from "../browser/onboarding.svelte";
import { noteMigration } from "../browser/storage-v1.ts";
import { createProject, deleteAllProjects, deleteProject, getSelectedProject, getProjects, hydrateProjects, listProjects, putProject, registerProjectNormalizer, saveProjects, selectProject, sessionToSelectFromUrl } from "../project/store.svelte.ts";
import type { Project } from "../project/types.ts";
import { chatModeOf } from "./modes";
import { normalizeChatExt, projectOfView, viewOf } from "./view";
import type { ChatSession, CreatorRuntimeStatus, ServerCapabilities, SessionSummary } from "./types";

/** Run state shared by the chat modules. `lastRequestId` and `lastFailedText` stay null until a transport sets them. */
export const run = $state({
	lastError: null as string | null,
	lastRequestId: null as string | null,
	lastFailedText: null as string | null,
	capabilities: null as ServerCapabilities | null,
	connectionMode: "booting" as "live" | "mock" | "booting",
	canDeleteSessions: true,
	/** Mode picked before the chat exists (home composer); the first send stores it on the new chat. */
	pendingMode: "build" as AgentMode
});
const control = { epoch: 0, inflight: null as AbortController | null, hydrated: false, hydrating: false };

export const currentEpoch = (): number => control.epoch;
export const bumpEpoch = (): number => ++control.epoch;
export function abortInflight(): void {
	control.inflight?.abort();
	control.inflight = null;
}
/** Register the controller of the run that starts now; `release` clears it when that run is still the current one. */
export function startRun(controller: AbortController): () => void {
	control.inflight = controller;
	return () => {
		if (control.inflight === controller) control.inflight = null;
	};
}

// ---- the chat view of a project --------------------------------------------------------------------------------

/** Old proposal shape (applied boolean only) -> status, on every load and import; each rewrite is counted for migrationReport. */
registerProjectNormalizer(normalizeChatExt(noteMigration));

export function getSelectedSession(): ChatSession | null {
	const project = getSelectedProject();
	return project ? viewOf(project) : null;
}

/** Put a chat view back into its project (memory only). `commitSession` also saves. */
export function putSession(view: ChatSession): void {
	putProject(projectOfView(view, getProjects().find((p) => p.id === view.id) ?? null), { save: false });
}
export function commitSession(view: ChatSession): void {
	putSession(view);
	saveProjects();
}

export function listSessions(): SessionSummary[] {
	return listProjects();
}

// ---- mode, skin, status ---------------------------------------------------------------------------------------

/** Ask or Build for the selected chat (composer toggle, kept per chat). */
export function getChatMode(): AgentMode {
	return chatModeOf(getSelectedSession(), run.pendingMode);
}

export function setChatMode(mode: AgentMode): void {
	run.pendingMode = mode;
	const session = getSelectedSession();
	if (!session || session.mode === mode) return;
	commitSession({ ...session, mode });
}

export function getRuntimeStatus(): CreatorRuntimeStatus {
	const persist = getPersistError();
	return { mode: run.connectionMode, capabilities: run.capabilities, error: persist?.message ?? run.lastError, canDelete: run.canDeleteSessions, lastRequestId: run.lastRequestId };
}

export function abortInflightRun(): void {
	abortInflight();
	run.lastError = t("runtime.cancelled");
}

// ---- selection ----------------------------------------------------------------------------------------------

const notFound = (id: string): string => t("runtime.sessionNotFound").replace("{id}", id);

/** The scenario and screen of the selected project become the workspace context. */
export function restoreWorkspace(project: Project | null): void {
	hydrateSessionContext({ scenarioId: project?.scenarioId ?? null, screenId: project?.screenId ?? null });
}

/** Load the projects from this browser. Safe for onMount, not for $derived. */
export async function hydrateSessions(): Promise<void> {
	if (control.hydrated || control.hydrating) return;
	control.hydrating = true;
	bumpEpoch();
	try {
		run.connectionMode = "mock";
		// Live Grok is probed on Send (runConstructor), not while the SPA boots.
		run.capabilities = { runtime: "xai-grok", mode: "localStorage", liveModel: false, tools: [], note: "runtime.liveOnSend" };
		const { missing } = hydrateProjects();
		restoreWorkspace(getSelectedProject());
		if (missing) run.lastError = notFound(missing);
		control.hydrated = true;
	} finally {
		control.hydrating = false;
	}
}

export async function selectSession(id: string, opts?: { history?: "push" | "replace" | "none" }): Promise<void> {
	abortInflight();
	bumpEpoch();
	const project = selectProject(id, opts);
	restoreWorkspace(project);
	run.lastError = project ? null : notFound(id);
}

/** Chats created in this tab (not restored from storage): the left panel keeps its tab for a chat made in place. */
const createdHere = new Set<string>();
export const createdInThisTab = (id: string | null | undefined): boolean => Boolean(id && createdHere.has(id));

export async function createSession(): Promise<ChatSession> {
	abortInflight();
	const project = createProject({ title: t("thread.untitled"), ext: { chat: { messages: [], mode: run.pendingMode } } });
	createdHere.add(project.id);
	restoreWorkspace(null);
	return viewOf(project);
}

/** Apply the current URL ?session= (popstate / shared deep-link). */
export async function applySessionFromUrl(): Promise<void> {
	const id = sessionToSelectFromUrl();
	if (id) await selectSession(id, { history: "none" });
}

/** Browser-local delete. Removes the chat and its pages from this browser. */
export function deleteSession(id: string): void {
	abortInflight();
	run.lastError = null;
	const wasSelected = getSelectedProject()?.id === id;
	const next = deleteProject(id);
	if (wasSelected) restoreWorkspace(next);
}

export function deleteAllSessions(): void {
	abortInflight();
	run.lastError = null;
	deleteAllProjects();
	restoreWorkspace(null);
}

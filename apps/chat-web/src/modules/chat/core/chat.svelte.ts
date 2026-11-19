/**
 * The chat module (ADR 0040): the chat view of the selected project, the composer mode, the run state and the
 * selection wrappers that abort a run and reload the workspace context. The project (page, skin, history,
 * persistence) lives in `../project`; the chat keeps only `project.ext.chat` (messages, mode, selected model, usage).
 */
import { endAttempt, usageOfAttempts, readRunAttempts } from "@buildytech/chat-agent";
import type { AgentMode } from "@buildytech/chat-agent";
import { t } from "../../../lib/i18n/dictionary";
import { getPersistError } from "../../../lib/browser/persist";
import { hydrateSessionContext } from "../browser/onboarding.svelte.ts";
import { getSelectedProject, getProjects, listProjects, putProject, saveProjects } from "../../../lib/project/store.svelte.ts";
import { applyUrlSelection, createWorkspaceProject, openProject, removeAllProjects, removeProject, startWorkspace } from "../../../lib/modules/workspace.svelte.ts";
import type { ProjectOpenedEvent } from "../../../lib/modules/types.ts";
import { chatModeOf } from "./modes";
import { projectOfView, viewOf } from "./view";
import type { ChatSession, CreatorRuntimeStatus, ServerCapabilities, SessionSummary } from "./types";

/** Run state shared by the chat modules. `lastRequestId` identifies the host attempt; failed sends retain their text for an explicit retry. */
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
const control = { epoch: 0, inflight: null as AbortController | null };

export const currentEpoch = (): number => control.epoch;
const bumpEpoch = (): number => ++control.epoch;
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

export function canRunSession(id: string): boolean {
	const project = getProjects().find((project) => project.id === id);
	return Boolean(project && (project.ext["agent-runs"] === undefined || readRunAttempts(project.ext["agent-runs"]) !== null));
}

export function getSession(id: string): ChatSession | null {
	const project = getProjects().find((project) => project.id === id);
	return project ? viewOf(project) : null;
}

export function recoverInterruptedRuns(): void {
	for (const project of getProjects()) {
		const session = viewOf(project);
		if (!Object.values(session.runAttempts ?? {}).some((attempt) => attempt.status === "running")) continue;
		const runAttempts = Object.fromEntries(Object.entries(session.runAttempts ?? {}).map(([id, attempt]) => [id, attempt.status === "running" ? endAttempt(attempt, "interrupted", new Date().toISOString(), { code: "host_interrupted" }) : attempt]));
		commitSession({ ...session, runAttempts, usage: usageOfAttempts(runAttempts, session.messages) });
	}
}

export function getSelectedSession(): ChatSession | null {
	const project = getSelectedProject();
	return project ? viewOf(project) : null;
}

/** Put a chat view back into its project (memory only). `commitSession` also saves. */
function putSession(view: ChatSession): void {
	putProject(projectOfView(view, getProjects().find((p) => p.id === view.id) ?? null), { save: false });
}
export function commitSession(view: ChatSession): boolean {
	putSession(view);
	return saveProjects();
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
// The project operations (open, new, delete, URL) are the workspace controller's (core); the chat answers its hooks.

const notFound = (id: string): string => t("runtime.sessionNotFound").replace("{id}", id);

/** Hook: the selected project is about to change; a run of the old one stops and its late results are dropped. */
export function beforeProjectChange(): void {
	abortInflight();
	bumpEpoch();
}

/** Hook: the selected project changed; the workspace context follows it and a missing project is said. */
export function projectOpened(event: ProjectOpenedEvent): void {
	// A project keeps no scenario or screen (buildy:v2): the workspace context starts empty.
	hydrateSessionContext({ scenarioId: null, screenId: null });
	if (event.reason === "select" || event.reason === "delete") run.lastError = event.missing ? notFound(event.missing) : null;
	else if (event.reason === "hydrate" && event.missing) run.lastError = notFound(event.missing);
}

/** Hook: the projects are about to load (the home state of the chat). */
export function beforeHydrate(): void {
	bumpEpoch();
	run.connectionMode = "mock";
	// Live Grok is probed on Send (runConstructor), not while the SPA boots.
	run.capabilities = { runtime: "xai-grok", mode: "localStorage", liveModel: false, tools: [], note: "runtime.liveOnSend" };
}

/** Load the projects from this browser. Safe for onMount, not for $derived. */
export const hydrateSessions = startWorkspace;

export const selectSession = openProject;
export const applySessionFromUrl = applyUrlSelection;
export const deleteSession = removeProject;
export const deleteAllSessions = removeAllProjects;

export async function createSession(): Promise<ChatSession> {
	return viewOf(createWorkspaceProject());
}

/**
 * The workspace controller (ADR 0041): the projects of this browser as the shell shows them, and the operations that
 * change the selected project (open, new, delete, import, URL). It calls the project store and tells the loaded modules
 * (hooks) before and after, so a module can stop its work and reload its context; it knows no module by name.
 */
import { t } from "../i18n/dictionary.ts";
import { createProject, deleteAllProjects, deleteProject, getSelectedProject, hydrateProjects, listProjects, selectProject, sessionToSelectFromUrl, startEmptyProject } from "../project/store.svelte.ts";
import type { Project, ProjectSummary } from "../project/types.ts";
import { collectBeforeHydrate, emit, newProjectDefaults, runAfterHydrate } from "./registry.svelte.ts";

let hydrated = false;
let hydrating = false;
/** Projects made in this tab (not restored from storage): the left panel keeps its tab for a project made in place. */
const createdHere = new Set<string>();

export const createdInThisTab = (id: string | null | undefined): boolean => Boolean(id && createdHere.has(id));
export const listWorkspaceProjects = (): ProjectSummary[] => listProjects();
export const getWorkspaceProject = (): Project | null => getSelectedProject();

/** Load the projects from this browser and select one (URL, remembered, newest). Safe for onMount, not for $derived. */
export async function startWorkspace(): Promise<void> {
	if (hydrated || hydrating) return;
	hydrating = true;
	try {
		const tokens = collectBeforeHydrate();
		const { missing } = hydrateProjects();
		emit("projectOpened", { project: getSelectedProject(), reason: "hydrate", missing });
		hydrated = true;
		await runAfterHydrate(tokens);
	} finally {
		hydrating = false;
	}
}

export async function openProject(id: string, opts?: { history?: "push" | "replace" | "none" }): Promise<void> {
	emit("beforeProjectChange");
	const project = selectProject(id, opts);
	emit("projectOpened", { project, reason: "select", missing: project ? null : id });
}

/** A new project, selected and bound (synchronous: the Inspector starts a page in it in the same step). */
export function createWorkspaceProject(): Project {
	emit("beforeProjectChange");
	const defaults = newProjectDefaults(t("page.untitled"));
	const project = createProject({ title: defaults.title, ext: defaults.ext });
	createdHere.add(project.id);
	emit("projectOpened", { project: null, reason: "create" });
	return project;
}
export async function newProject(): Promise<Project> {
	return createWorkspaceProject();
}

/** Apply the current URL ?session= (popstate / shared deep-link). */
export async function applyUrlSelection(): Promise<void> {
	const id = sessionToSelectFromUrl();
	if (id) await openProject(id, { history: "none" });
}

/** Browser-local delete: the project and, unless another project shares it, its page record. */
export function removeProject(id: string): void {
	emit("beforeProjectChange");
	const wasSelected = getSelectedProject()?.id === id;
	const next = deleteProject(id);
	if (wasSelected) emit("projectOpened", { project: next, reason: "delete" });
}

export function removeAllProjects(): void {
	emit("beforeProjectChange");
	deleteAllProjects();
	emit("projectOpened", { project: null, reason: "delete" });
}

/** An empty page in the selected project (made first when none is selected): the first add from the Blocks feed or the Inspector. */
export function startEmptyPage(screenId: string | null = null): boolean {
	if (!getSelectedProject()) createWorkspaceProject();
	if (!startEmptyProject(screenId)) return false;
	emit("pageStarted", screenId);
	return true;
}

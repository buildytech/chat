/**
 * The project store: the sessions of this browser as projects (page, skin, collection, revision history), selection,
 * persistence, and the page operations that change the project record. It never imports chat code (a test enforces
 * it): chat messages, mode and usage are an extension (`project.ext.chat`) that this store keeps and returns untouched.
 * Module-level state, browser only (ADR-0003 style: no shared SSR state).
 */
import { emptyPage } from "@buildytech/builder-core";
import { readSessionQuery, resolveSessionSelection, syncSessionQuery } from "../api/session-url";
import { t } from "../i18n/dictionary";
import { allowPersistOverwrite, clearPagesBlob, deleteProjectPage, loadPagesBlob, loadSessionsJson, saveSessionsJson } from "../browser/persist";
import { reconcileChatRevision, type StoredChat } from "../browser/session-file";
import { STORAGE_KEYS, readKey, writeKey } from "../browser/storage-v1.ts";
import { applyCandidate, bindProject, clearCurrentPage, discardCandidate, getAppliedProvenance, getLastAppliedPage, getPageRevision, onPageRevision, startEmptyPage } from "../page-store";
import { docOfProject, projectOfDoc, type SessionDoc } from "./doc.ts";
import { bySavedAt, draftPageId, newProject, withApplied, withRevision, withSkin, withoutCollectionItem } from "./transitions.ts";
import type { Project, ProjectSummary } from "./types.ts";

const SELECTED_KEY = STORAGE_KEYS.selectedSessionId;
const nowIso = (): string => new Date().toISOString();

let projects = $state<Project[]>([]);
let selectedId = $state<string | null>(null);
/** Skin picked before the project exists (home composer): the next created project wears it. */
let pendingSkin = $state<string | null>(null);

/** Extension modules register a normalizer for their `ext` payload (old shapes); applied on every load and import. */
const normalizers: Array<(project: Project) => Project> = [];
export function registerProjectNormalizer(fn: (project: Project) => Project): void {
	normalizers.push(fn);
}
export const normalizeProject = (project: Project): Project => normalizers.reduce((acc, fn) => fn(acc), project);

export const getProjects = (): readonly Project[] => projects;
export const getProject = (id: string | null | undefined): Project | null => (id ? (projects.find((p) => p.id === id) ?? null) : null);
export const getSelectedProjectId = (): string | null => selectedId;
export const getSelectedProject = (): Project | null => getProject(selectedId);
export function listProjects(): ProjectSummary[] {
	return projects.map(({ id, title, updatedAt }) => ({ id, title, updatedAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveProjects(): void {
	saveSessionsJson(projects.map(docOfProject));
}
const save = saveProjects;

/** Put a project in the list (replacing the one with its id), newest first; saved unless `save: false`. */
export function putProject(next: Project, opts: { save?: boolean } = {}): void {
	projects = [next, ...projects.filter((p) => p.id !== next.id)].sort(bySavedAt);
	if (opts.save !== false) save();
}

/** Every project of storage, each normalized and with its pageRevision equal to the page store's (the source of truth). */
export function loadProjects(): Project[] {
	const parsed = loadSessionsJson();
	if (!Array.isArray(parsed)) return [];
	const pages = loadPagesBlob().pages;
	let drift = false;
	const list = (parsed as SessionDoc[]).map((doc) => {
		const project = normalizeProject(projectOfDoc(doc));
		const synced = reconcileChatRevision(project as unknown as StoredChat, pages[project.projectId] ?? undefined) as unknown as Project;
		if (synced !== project) drift = true;
		return synced;
	});
	if (drift) saveSessionsJson(list.map(docOfProject));
	return list;
}

export function rememberSelection(id: string | null): void {
	selectedId = id;
	writeKey(SELECTED_KEY, id);
}

/** Replace every project (import): the page store is unbound first so its in-memory page cannot overwrite an imported record. */
export function replaceProjects(next: Project[]): void {
	bindProject(null);
	projects = [...next].sort(bySavedAt);
	save();
}

export type Hydrated = { selected: string | null; missing: string | null };

/** Load the projects, pick the selection (URL, then the remembered id, then the newest) and bind the page store to it. */
export function hydrateProjects(): Hydrated {
	projects = loadProjects();
	const pick = resolveSessionSelection({ urlSession: readSessionQuery(), persistedId: writeKeyRead(), sessionIds: projects.map((p) => p.id) });
	if (pick.kind === "missing") {
		rememberSelection(null);
		bindProject(null);
		syncSessionQuery(pick.requested, { mode: "replace" });
		return { selected: null, missing: pick.requested };
	}
	const id = pick.kind === "ok" ? pick.id : null;
	rememberSelection(id);
	syncSessionQuery(id, { mode: "replace" });
	bindProject(getProject(id)?.projectId ?? null);
	return { selected: id, missing: null };
}
const writeKeyRead = (): string | null => readKey(SELECTED_KEY);

/** Select a project and bind its page. Null (and no selection) when storage has no such project. */
export function selectProject(id: string, opts?: { history?: "push" | "replace" | "none" }): Project | null {
	const historyMode = opts?.history ?? "push";
	rememberSelection(id);
	if (historyMode !== "none") syncSessionQuery(id, { mode: historyMode });
	const full = loadProjects().find((p) => p.id === id) ?? getProject(id);
	if (full) {
		putProject(full, { save: false });
		bindProject(full.projectId);
		return full;
	}
	projects = projects.filter((p) => p.id !== id);
	rememberSelection(null);
	bindProject(null);
	return null;
}

/** A new project (no page, no chat unless `ext` brings one), selected and bound. It wears the skin picked before it existed. */
export function createProject(input: { title: string; ext?: Project["ext"] }): Project {
	const project = newProject({ id: `session-${crypto.randomUUID()}`, title: input.title, now: nowIso(), skin: pendingSkin, ext: input.ext });
	projects = [project, ...projects];
	rememberSelection(project.id);
	syncSessionQuery(project.id, { mode: "push" });
	save();
	bindProject(project.projectId);
	clearCurrentPage();
	return project;
}

/** Browser-local delete: the project and, unless another project shares it, its page record. Returns the project selected next. */
export function deleteProject(id: string): Project | null {
	const gone = getProject(id);
	const remaining = projects.filter((p) => p.id !== id);
	projects = remaining;
	save();
	if (gone && !remaining.some((p) => p.projectId === gone.projectId)) deleteProjectPage(gone.projectId);
	if (selectedId !== id) return getSelectedProject();
	const next = remaining[0] ?? null;
	rememberSelection(next?.id ?? null);
	syncSessionQuery(next?.id ?? null, { mode: "replace" });
	bindProject(next?.projectId ?? null);
	return next;
}

export function deleteAllProjects(): void {
	allowPersistOverwrite();
	for (const project of projects) deleteProjectPage(project.projectId);
	projects = [];
	save();
	clearPagesBlob();
	rememberSelection(null);
	syncSessionQuery(null, { mode: "replace" });
	bindProject(null);
}

/** Apply the current URL ?session= (popstate / shared deep-link): the id to select, or null when nothing changes. */
export function sessionToSelectFromUrl(): string | null {
	const urlSession = readSessionQuery();
	if (!urlSession) {
		syncSessionQuery(selectedId, { mode: "replace" });
		return null;
	}
	return urlSession === selectedId ? null : urlSession;
}

// ---- skin and collection -----------------------------------------------------------------------------------------

export const getProjectSkin = (): string | null => (getSelectedProject() ? (getSelectedProject()!.skin ?? null) : pendingSkin);
export const setPendingSkin = (skin: string | null): void => void (pendingSkin = skin);

export function setProjectSkin(skin: string | null): void {
	pendingSkin = skin;
	const project = getSelectedProject();
	if (project && (project.skin ?? null) !== skin) putProject(withSkin(project, skin));
}

export function removeCollectionItem(index: number): void {
	const project = getSelectedProject();
	if (project?.collection) putProject(withoutCollectionItem(project, index));
}

// ---- the page of the project -------------------------------------------------------------------------------------

// Every new revision of an applied page (proposal applied, committed inspector edit, undo / redo) is written to its
// project: pageRevision, pageId and one history entry. Coalesced typing reaches this once per undo step (ADR 0015).
onPageRevision((event) => {
	const project = projects.find((p) => p.projectId === event.projectId);
	if (!project) return;
	const { projectId: _projectId, ...entry } = event;
	putProject(withRevision(project, { ...entry, at: nowIso() }));
});

/** The pending proposal becomes the applied page: the next revision, and the project keeps its page id, revision and screen. */
export function applyPending(opts: { fallbackScreenId?: string | null } = {}): boolean {
	if (!getSelectedProject() || !applyCandidate((getPageRevision() ?? 0) + 1)) return false;
	// Re-read: applyCandidate announced the revision and the project got its history entry.
	const project = getSelectedProject();
	if (!project) return false;
	const screenId = getAppliedProvenance()?.screenId ?? project.screenId ?? opts.fallbackScreenId ?? null;
	putProject(withApplied(project, { pageId: getLastAppliedPage()?.id, revision: getPageRevision(), screenId, now: nowIso() }));
	return true;
}

export const discardPending = (): void => discardCandidate();

/** Empty start (ADR 0024): the selected project gets an empty applied page (no sections, revision 0, no history entry). */
export function startEmptyProject(screenId: string | null): boolean {
	const project = getSelectedProject();
	if (!project) return false;
	const page = emptyPage({ title: t("page.untitled"), locale: "en", id: draftPageId(project) });
	if (!startEmptyPage(page, { screenId, scenarioId: null, missing: [] })) return false;
	putProject({ ...(getSelectedProject() ?? project), updatedAt: nowIso(), pageId: page.id, pageRevision: 0, screenId });
	return true;
}

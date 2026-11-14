/** The project module: page, skin, collection, history and persistence of a project; no chat code (ADR 0040). */
export { getProject, getProjects, getProjectSkin, getSelectedProject, removeCollectionItem, setProjectSkin } from "./store.svelte.ts";
export type { Project, ProjectSummary } from "./types.ts";
export type { ProjectCollection } from "./collection.ts";

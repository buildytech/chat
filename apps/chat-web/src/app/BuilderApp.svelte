<script lang="ts">
	import { onMount } from "svelte";
	import { applyUrlSelection, createWorkspaceProject, getWorkspaceProject, listWorkspaceProjects, openProject, removeProject, startWorkspace } from "$lib/modules/workspace.svelte";
	import { installBuildyApi } from "$lib/browser/buildy-api";
	import { t } from "$lib/i18n/dictionary";
	import { theme } from "$lib/theme/theme.svelte";
	import CreatorShell from "./CreatorShell.svelte";

	let sidebarOpen = $state(false);

	onMount(() => {
		void startWorkspace();
		theme.init();
		installBuildyApi();
	});

	const projects = $derived(listWorkspaceProjects());
	const selectedId = $derived(getWorkspaceProject()?.id ?? null);

	async function onNew() {
		createWorkspaceProject();
		sidebarOpen = false;
	}

	async function onSelect(id: string) {
		await openProject(id);
		sidebarOpen = false;
	}
</script>

<svelte:window onpopstate={() => void applyUrlSelection()} />

<svelte:head>
	<title>{t("app.documentTitle")}</title>
</svelte:head>

<CreatorShell
	{sidebarOpen}
	{projects}
	{selectedId}
	{onNew}
	{onSelect}
	onDelete={removeProject}
	onToggleSidebar={() => (sidebarOpen = !sidebarOpen)}
	onCloseSidebar={() => (sidebarOpen = false)}
/>

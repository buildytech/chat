<script lang="ts">
	import type { ProjectSummary } from "$lib/project";
	import ProjectSidebar from "./ProjectSidebar.svelte";

	let {
		projects,
		selectedId,
		onNew,
		onSelect,
		onDelete,
		onClose,
		collapsed = false,
		canDelete = true,
	}: {
		projects: ProjectSummary[];
		selectedId: string | null;
		onNew: () => void | Promise<void>;
		onSelect: (id: string) => void | Promise<void>;
		onDelete: (id: string) => void;
		onClose?: () => void;
		collapsed?: boolean;
		canDelete?: boolean;
	} = $props();
</script>

<ProjectSidebar {projects} {selectedId} {onNew} {onSelect} {onDelete} {onClose} {collapsed} {canDelete} />

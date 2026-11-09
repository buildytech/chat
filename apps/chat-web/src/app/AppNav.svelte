<script lang="ts">
	import type { SessionSummary } from "$lib/chat-core";
	import ChatSidebar from "./ChatSidebar.svelte";

	let {
		sessions,
		selectedId,
		onNew,
		onSelect,
		onDelete,
		onToggle,
		collapsed = false,
		canDelete = false
	}: {
		sessions: SessionSummary[];
		selectedId: string | null;
		onNew: () => void | Promise<void>;
		onSelect: (id: string) => void | Promise<void>;
		onDelete: (id: string) => void;
		onToggle?: () => void;
		collapsed?: boolean;
		canDelete?: boolean;
	} = $props();
</script>

<ChatSidebar {sessions} {selectedId} {onNew} {onSelect} {onDelete} {onToggle} {collapsed} {canDelete} />

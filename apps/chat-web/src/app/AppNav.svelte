<script lang="ts">
	import type { SessionSummary } from "$modules/chat/core";
	import ChatSidebar from "./ChatSidebar.svelte";

	let {
		sessions,
		selectedId,
		onNew,
		onSelect,
		onDelete,
		onClose,
		collapsed = false,
		canDelete = false,
	}: {
		sessions: SessionSummary[];
		selectedId: string | null;
		onNew: () => void | Promise<void>;
		onSelect: (id: string) => void | Promise<void>;
		onDelete: (id: string) => void;
		onClose?: () => void;
		collapsed?: boolean;
		canDelete?: boolean;
	} = $props();
</script>

<ChatSidebar {sessions} {selectedId} {onNew} {onSelect} {onDelete} {onClose} {collapsed} {canDelete} />

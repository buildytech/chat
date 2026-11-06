<script lang="ts">
	import type { SessionSummary } from "../chat-core";
	import ChatSidebar from "./ChatSidebar.svelte";

	let {
		sessions,
		selectedId,
		onNew,
		onSelect,
		onDelete
	}: {
		sessions: SessionSummary[];
		selectedId: string | null;
		onNew: () => void;
		onSelect: (id: string) => void;
		onDelete: (id: string) => void;
	} = $props();
</script>

<ChatSidebar {sessions} {selectedId} {onNew} {onSelect} {onDelete} />

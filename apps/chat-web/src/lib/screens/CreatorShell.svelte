<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import { theme } from "../theme/theme.svelte";
	import type { ChatSession, SessionSummary } from "../chat-core";
	import ChatColumn from "./ChatColumn.svelte";
	import ChatDrawer from "./ChatDrawer.svelte";
	import ChatNav from "./ChatNav.svelte";
	import CreatorTabs from "./CreatorTabs.svelte";
	import Workspace from "./Workspace.svelte";

	let {
		sidebarOpen,
		sessions,
		selected,
		selectedId,
		busy,
		onNew,
		onSelect,
		onDelete,
		onSend,
		onToggleSidebar,
		onCloseSidebar
	}: {
		sidebarOpen: boolean;
		sessions: SessionSummary[];
		selected: ChatSession | null;
		selectedId: string | null;
		busy: boolean;
		onNew: () => void;
		onSelect: (id: string) => void;
		onDelete: (id: string) => void;
		onSend: (text: string) => void;
		onToggleSidebar: () => void;
		onCloseSidebar: () => void;
	} = $props();

	let mobileSurface = $state<"chat" | "workspace">("chat");
</script>

<Block class="flex h-dvh min-h-0 flex-col bg-background text-foreground">
	<ChatNav
		{sidebarOpen}
		isDark={theme.isDark}
		onToggleSidebar={onToggleSidebar}
		onToggleTheme={() => theme.toggle()}
	/>
	<Group class="relative min-h-0 flex-1 items-stretch">
		<ChatDrawer
			open={sidebarOpen}
			{sessions}
			{selectedId}
			{onNew}
			{onSelect}
			{onDelete}
			onClose={onCloseSidebar}
		/>
		<ChatColumn
			session={selected}
			{busy}
			{onSend}
			visible={mobileSurface === "chat"}
		/>
		<Workspace visible={mobileSurface === "workspace"} />
	</Group>
	<CreatorTabs surface={mobileSurface} onSelect={(next) => (mobileSurface = next)} />
</Block>

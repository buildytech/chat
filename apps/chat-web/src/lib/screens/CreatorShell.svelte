<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import type { ChatSession, SessionSummary } from "../chat-core";
	import ChatColumn from "./ChatColumn.svelte";
	import ChatDrawer from "./ChatDrawer.svelte";
	import CreatorTabs from "./CreatorTabs.svelte";
	import CreatorTopBar from "./CreatorTopBar.svelte";
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
	let sidebarCollapsed = $state(false);
	let chatHidden = $state(false);

	function handleNavToggle() {
		if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
			sidebarCollapsed = !sidebarCollapsed;
			return;
		}
		onToggleSidebar();
	}

	function handleToggleChat() {
		if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
			chatHidden = !chatHidden;
			return;
		}
		mobileSurface = "chat";
	}
</script>

<Block
	class="flex h-dvh min-h-0 flex-col bg-muted text-foreground"
	data-pane={mobileSurface}
	data-chat-hidden={chatHidden ? "true" : "false"}
>
	<Group class="relative min-h-0 flex-1 items-stretch">
		<ChatDrawer
			open={sidebarOpen}
			collapsed={sidebarCollapsed}
			{sessions}
			{selectedId}
			{onNew}
			{onSelect}
			{onDelete}
			onClose={onCloseSidebar}
			onToggle={handleNavToggle}
		/>
		<Block tag="main" id="main-content" class="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
			<CreatorTopBar
				{sidebarOpen}
				onToggleSidebar={handleNavToggle}
			/>
			<Group class="min-h-0 min-w-0 flex-1 items-stretch max-lg:flex-col">
				<ChatColumn
					session={selected}
					{busy}
					{onSend}
					visible={mobileSurface === "chat"}
					{chatHidden}
				/>
				<Workspace
					visible={mobileSurface === "workspace"}
					{chatHidden}
					ontogglechat={handleToggleChat}
				/>
			</Group>
		</Block>
	</Group>
	<CreatorTabs surface={mobileSurface} onSelect={(next) => (mobileSurface = next)} />
</Block>

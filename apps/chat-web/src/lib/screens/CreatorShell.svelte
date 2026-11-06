<script lang="ts">
	import { onMount } from "svelte";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import type { ChatSession, SessionSummary } from "../chat-core";
	import { creatorLayout } from "../creator-layout.svelte";
	import ChatColumn from "./ChatColumn.svelte";
	import ChatDrawer from "./ChatDrawer.svelte";
	import CreatorTabs from "./CreatorTabs.svelte";
	import CreatorTopBar from "./CreatorTopBar.svelte";
	import PaneSplitter from "./PaneSplitter.svelte";
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
		onCloseSidebar,
		runtime
	}: {
		sidebarOpen: boolean;
		sessions: SessionSummary[];
		selected: ChatSession | null;
		selectedId: string | null;
		busy: boolean;
		runtime: {
			mode: "live" | "mock" | "booting";
			capabilities: { liveModel?: boolean; mode?: string; runtime?: string; note?: string } | null;
			error: string | null;
			canDelete: boolean;
			lastRequestId: string | null;
		};
		onNew: () => void | Promise<void>;
		onSelect: (id: string) => void | Promise<void>;
		onDelete: (id: string) => void;
		onSend: (text: string) => void | Promise<void>;
		onToggleSidebar: () => void;
		onCloseSidebar: () => void;
	} = $props();

	let mobileSurface = $state<"chat" | "workspace">("chat");
	const sidebarCollapsed = $derived(creatorLayout.sidebarCollapsed);
	const chatHidden = $derived(creatorLayout.chatHidden);

	onMount(() => {
		creatorLayout.syncCssVars();
	});

	function handleNavToggle() {
		if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
			creatorLayout.toggleSidebar();
			return;
		}
		onToggleSidebar();
	}

	function handleToggleChat() {
		if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
			creatorLayout.toggleChat();
			return;
		}
		mobileSurface = "chat";
	}
</script>

<Block
	id="creator-shell"
	class="flex h-dvh min-h-0 flex-col bg-muted text-foreground"
	data-pane={mobileSurface}
	data-nav={sidebarCollapsed ? "collapsed" : "expanded"}
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
			canDelete={runtime.canDelete}
			onClose={onCloseSidebar}
			onToggle={handleNavToggle}
		/>
		{#if !sidebarCollapsed}
			<PaneSplitter pane="nav" class="max-lg:hidden" />
		{/if}
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
					runtimeStatus={runtime}
					visible={mobileSurface === "chat"}
					{chatHidden}
				/>
				{#if !chatHidden}
					<PaneSplitter pane="chat" class="max-lg:hidden" />
				{/if}
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

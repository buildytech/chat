<script lang="ts">
	import { onMount } from "svelte";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/compose/Button.svelte";
	import MessageSquare from "@lucide/svelte/icons/message-square";
	import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
	import { t } from "$lib/i18n/dictionary";
	import { getChatMode } from "$lib/chat-core";
	import { shortcutFor } from "$lib/layout/shortcuts";
	import type { ChatSession, CreatorRuntimeStatus, SessionSummary } from "$lib/chat-core";
	import type { GrokChatModel, SessionUsage } from "@buildytech/builder-core";
	import { creatorLayout } from "$lib/creator-layout.svelte";
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
		onCancel,
		onAddModel,
		onSelectModel,
		onApply,
		onDiscard,
		chatModels = [],
		selectedModelId = "",
		sessionUsage = null,
		onToggleSidebar,
		onCloseSidebar,
		runtime
	}: {
		sidebarOpen: boolean;
		sessions: SessionSummary[];
		selected: ChatSession | null;
		selectedId: string | null;
		busy: boolean;
		runtime: CreatorRuntimeStatus;
		onNew: () => void | Promise<void>;
		onSelect: (id: string) => void | Promise<void>;
		onDelete: (id: string) => void;
		onSend: (text: string) => void | Promise<void>;
		onCancel?: () => void;
		onAddModel?: () => void;
		onSelectModel?: (id: string) => void;
		onApply?: () => void;
		onDiscard?: () => void;
		chatModels?: readonly GrokChatModel[];
		selectedModelId?: string;
		sessionUsage?: SessionUsage | null;
		onToggleSidebar: () => void;
		onCloseSidebar: () => void;
	} = $props();

	let mobileSurface = $state<"chat" | "workspace">("chat");
	let inspectorSheet = $state(false);
	const sidebarCollapsed = $derived(creatorLayout.collapsed("nav"));
	const chatHidden = $derived(creatorLayout.collapsed("chat"));
	const columns = $derived(creatorLayout.columns);

	onMount(() => {
		const sync = () => creatorLayout.setViewport(window.innerWidth);
		sync();
		window.addEventListener("resize", sync);
		return () => window.removeEventListener("resize", sync);
	});

	function handleNavToggle() {
		if (creatorLayout.columns) {
			creatorLayout.toggle("nav");
			return;
		}
		onToggleSidebar();
	}

	function handleToggleChat() {
		if (creatorLayout.columns) {
			creatorLayout.toggle("chat");
			return;
		}
		mobileSurface = mobileSurface === "chat" ? "workspace" : "chat";
	}

	function handleToggleInspector() {
		if (getChatMode() !== "build") return;
		if (creatorLayout.inspectorColumn) creatorLayout.toggle("inspector");
		else {
			mobileSurface = "workspace";
			inspectorSheet = !inspectorSheet;
		}
	}

	// Ctrl/Cmd+B chat column, Ctrl/Cmd+I inspector, Ctrl/Cmd+\ preview-only focus (not inside the code editor).
	function onKeyDown(event: KeyboardEvent) {
		const action = shortcutFor(event);
		if (!action) return;
		event.preventDefault();
		if (action === "chat") handleToggleChat();
		else if (action === "inspector") handleToggleInspector();
		else creatorLayout.toggleFocus();
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<Block
	id="creator-shell"
	class="fixed inset-0 flex min-h-0 flex-col bg-muted text-foreground"
	data-pane={mobileSurface}
	data-nav={columns && sidebarCollapsed ? "collapsed" : "expanded"}
	data-chat-hidden={chatHidden ? "true" : "false"}
>
	<Group class="relative min-h-0 flex-1 items-stretch">
		<ChatDrawer
			open={sidebarOpen}
			collapsed={columns && sidebarCollapsed}
			{sessions}
			{selectedId}
			{onNew}
			{onSelect}
			{onDelete}
			canDelete={runtime.canDelete}
			onClose={onCloseSidebar}
			onToggle={handleNavToggle}
		/>
		{#if columns && !sidebarCollapsed}
			<PaneSplitter pane="nav" controls="chat-sidebar-drawer" class="max-lg:hidden" />
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
					{onCancel}
					{onAddModel}
					{onSelectModel}
					{onApply}
					{onDiscard}
					{chatModels}
					{selectedModelId}
					{sessionUsage}
					runtimeStatus={runtime}
					visible={mobileSurface === "chat"}
					{chatHidden}
				/>
				{#if columns && chatHidden}
					<Stack
						align="center"
						class="shrink-0 gap-2 border-r border-border bg-background py-2"
						style={`width: ${creatorLayout.widths.chat}px`}
						aria-label={t("shell.chatColumn")}
						data-slot="chat-rail"
					>
						<Button size="sm" layout="icon" variant="ghost" aria-label={t("workspace.showChat")} title={`${t("workspace.showChat")} (Ctrl+B)`} aria-expanded="false" aria-controls="creator-chat-column" data-action="chat-expand" onclick={() => creatorLayout.setCollapsed("chat", false)}>
							<PanelLeftOpen />
						</Button>
						<Button size="sm" layout="icon" variant="ghost" aria-label={t("shell.chatColumn")} title={t("shell.chatColumn")} onclick={() => { creatorLayout.setCollapsed("chat", false); queueMicrotask(() => document.querySelector<HTMLTextAreaElement>("#creator-chat-column textarea")?.focus()); }}>
							<MessageSquare />
						</Button>
					</Stack>
				{/if}
				{#if !chatHidden}
					<PaneSplitter pane="chat" controls="creator-chat-column" class="border-r border-border max-lg:hidden" />
				{/if}
				<Workspace
					visible={mobileSurface === "workspace"}
					bind:sheetOpen={inspectorSheet}
					ontogglechat={handleToggleChat}
				/>
			</Group>
		</Block>
	</Group>
	<CreatorTabs surface={mobileSurface} onSelect={(next) => (mobileSurface = next)} />
</Block>

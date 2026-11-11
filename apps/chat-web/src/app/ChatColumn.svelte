<script lang="ts">
	import Blocks from "@lucide/svelte/icons/blocks";
	import ListTree from "@lucide/svelte/icons/list-tree";
	import MessageSquare from "@lucide/svelte/icons/message-square";
	import Block from "$registry/compose/Block.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { feed } from "$lib/feed/feed.svelte";
	import { LEFT_TABS } from "$lib/feed/prefs";
	import SectionsList from "./SectionsList.svelte";
	import BlocksFeed from "./BlocksFeed.svelte";
	import { creatorLayout } from "$lib/creator-layout.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import type { ChatSession, CreatorRuntimeStatus } from "$lib/chat-core";
	import type { GrokChatModel, SessionUsage } from "@buildytech/builder-core";
	import ChatThread from "./ChatThread.svelte";

	let {
		session,
		busy,
		onSend,
		onCancel,
		onAddModel,
		onSelectModel,
		onApply,
		onDiscard,
		chatModels = [],
		selectedModelId = "",
		sessionUsage = null,
		runtimeStatus = null,
		visible = true,
		chatHidden = false
	}: {
		session: ChatSession | null;
		busy: boolean;
		onSend: (text: string) => void | Promise<void>;
		onCancel?: () => void;
		onAddModel?: () => void;
		onSelectModel?: (id: string) => void;
		onApply?: () => void;
		onDiscard?: () => void;
		chatModels?: readonly GrokChatModel[];
		selectedModelId?: string;
		sessionUsage?: SessionUsage | null;
		runtimeStatus?: CreatorRuntimeStatus | null;
		visible?: boolean;
		chatHidden?: boolean;
	} = $props();

	// Left panel (ADR 0024): Blocks feed, Sections (the sortable page sections) and Chat share the ~320px column. Every panel
	// stays mounted, so the chat keeps its draft, scroll and running turn while another tab is open.
	const icons = { blocks: Blocks, sections: ListTree, chat: MessageSquare } as const;
	const tab = $derived(feed.tab);
	// An inactive panel carries the native `hidden` attribute (display: none in the base styles), never removed from the DOM.
	const panelClass = "min-h-0 flex-1 flex-col flex";
</script>

<Block
	tag="section"
	id="creator-chat-column"
	aria-label={t("shell.chatColumn")}
	class={cn(
		"min-h-0 min-w-0 flex-col bg-background",
		visible ? "flex flex-1" : "max-lg:hidden",
		chatHidden ? "lg:hidden" : "lg:flex lg:flex-none lg:shrink-0"
	)}
	style={creatorLayout.columns && !chatHidden ? `width: ${creatorLayout.widths.chat}px` : undefined}
>
	<Group class="h-10 shrink-0 items-center gap-1 border-b border-border px-2" role="tablist" aria-label={t("leftPanel.tabs")} data-slot="left-tabs">
		{#each LEFT_TABS as name (name)}
			{@const TabIcon = icons[name]}
			<Button
				size="sm"
				variant="ghost"
				id={`left-tab-${name}`}
				class={cn("h-8 gap-1 px-2 text-xs", tab === name ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
				role="tab"
				aria-selected={tab === name}
				aria-controls={`left-panel-${name}`}
				data-tab={name}
				onclick={() => (feed.tab = name)}
			>
				<Icon size="sm"><TabIcon /></Icon>
				<Text tag="span">{t(`leftPanel.${name}`)}</Text>
			</Button>
		{/each}
	</Group>
	<Box id="left-panel-blocks" role="tabpanel" aria-labelledby="left-tab-blocks" hidden={tab !== "blocks"} class={panelClass}>
		<BlocksFeed />
	</Box>
	<Box id="left-panel-sections" role="tabpanel" aria-labelledby="left-tab-sections" hidden={tab !== "sections"} class={panelClass}>
		<SectionsList />
	</Box>
	<Box id="left-panel-chat" role="tabpanel" aria-labelledby="left-tab-chat" hidden={tab !== "chat"} class={panelClass}>
	<ChatThread
		{session}
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
		{runtimeStatus}
	/>
	</Box>
</Block>

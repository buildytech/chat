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
	import { feedDrag } from "$lib/feed/drag.svelte";
	import { inspector } from "$lib/inspector/inspector.svelte";
	import { LEFT_TABS, landingTab } from "$lib/feed/prefs";
	import { readPreviewPage } from "$lib/page-store";
	import { untrack } from "svelte";
	import SectionsList from "./SectionsList.svelte";
	import BlocksFeed from "./BlocksFeed.svelte";
	import { creatorLayout } from "$lib/creator-layout.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { createdInThisTab, type ChatSession, type CreatorRuntimeStatus } from "$lib/chat-core";
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
	// The tab a chat opens on (landingTab): an empty chat lands on Blocks, the remembered tab is kept only when it has
	// something to show. Runs when another chat opens; a chat created in place (first message, first block) keeps the
	// tab the author is working in.
	let landedFor: string | null | undefined = undefined;
	$effect(() => {
		const id = session?.id ?? null;
		if (id === landedFor) return;
		// Restored chats arrive after hydration (null -> id) and land like any other; only a chat made in this tab keeps the tab.
		const createdInPlace = landedFor === null && createdInThisTab(id);
		landedFor = id;
		if (createdInPlace) return;
		untrack(() => {
			const hasPage = Boolean(readPreviewPage(id)?.layout.blocks.length);
			feed.land(landingTab(feed.savedTab, { hasPage, hasMessages: Boolean(session?.messages.length) }));
		});
	});
	// A feed card dragged onto the Sections tab opens it after a short rest, so the card can drop between sections.
	let springTimer: ReturnType<typeof setTimeout> | null = null;
	function springOpen(name: string) {
		if (!feedDrag.active || name !== "sections" || tab === "sections") return;
		springTimer ??= setTimeout(() => {
			springTimer = null;
			if (feedDrag.active) feed.tab = "sections";
		}, 400);
	}
	// A drag that ends anywhere (drop, Escape, outside the window) clears the dragged card; drop targets read it first.
	$effect(() => {
		const end = () => setTimeout(() => feedDrag.end(), 0);
		window.addEventListener("dragend", end);
		window.addEventListener("drop", end);
		return () => {
			window.removeEventListener("dragend", end);
			window.removeEventListener("drop", end);
		};
	});
	function springCancel() {
		if (springTimer) clearTimeout(springTimer);
		springTimer = null;
	}
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
				ondragenter={() => springOpen(name)}
				ondragleave={springCancel}
			>
				<Icon size="sm"><TabIcon /></Icon>
				<Text tag="span">{t(`leftPanel.${name}`)}</Text>
			</Button>
		{/each}
		<!-- ADR 0027: the screen family change, a small non-modal label (undo reverts it, Sections pins it). -->
		<Text tag="span" class="min-w-0 flex-1 truncate text-right text-[11px] text-muted-foreground" role="status" aria-live="polite" data-slot="family-note">
			{#if inspector.familyNote}
				{@const note = inspector.familyNote}
				{t("family.note").replace("{from}", t(`family.${note.from ?? "none"}`)).replace("{to}", t(`family.${note.to ?? "none"}`))}
			{/if}
		</Text>
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

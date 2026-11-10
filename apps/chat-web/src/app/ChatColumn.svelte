<script lang="ts">
	import Block from "$registry/compose/Block.svelte";
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
</Block>

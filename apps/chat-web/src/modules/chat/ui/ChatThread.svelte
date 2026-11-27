<script lang="ts">
	import Block from "$registry/compose/Block.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import type { ChatSession, CreatorRuntimeStatus } from "$modules/chat/core";
	import type { GrokChatModel, SessionUsage } from "@buildytech/chat-agent";
	import ChatComposer from "./ChatComposer.svelte";
	import ChatMessage from "./ChatMessage.svelte";
	import HomeOnboarding from "./HomeOnboarding.svelte";
	import AddModelDialog from "./AddModelDialog.svelte";
	import MediaPanel from "./MediaPanel.svelte";
	import DesignPanel from "./DesignPanel.svelte";
	import { getComposerMode } from "../core/composer-mode.svelte.ts";

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
		runtimeStatus = null
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
	} = $props();

	const messages = $derived(session?.messages ?? []);
	const media = $derived(getComposerMode() === "media");
	const design = $derived(getComposerMode() === "design");
	const empty = $derived(messages.length === 0 && !media && !design);

	let draft = $state("");
	let addModelOpen = $state(false);

	function onEdit(text: string) {
		draft = text;
	}
</script>

<Block class="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
	{#if empty}
		<HomeOnboarding
			{busy}
			{runtimeStatus}
			{onSend}
			{onCancel}
			{onAddModel}
			{onSelectModel}
			{chatModels}
			{selectedModelId}
			{sessionUsage}
		/>
	{:else}
		{#if media}
			<MediaPanel />
		{:else if design}
			<DesignPanel />
		{:else}
		<Stack align="stretch" class="min-h-0 flex-1 gap-6 overflow-y-auto p-4">
			<Stack align="stretch" class="mx-auto w-full max-w-2xl gap-6">
				{#each messages as message (message.id)}
					<ChatMessage
						{message}
						{onEdit}
						{onApply}
						{onDiscard}
					/>
				{/each}
			</Stack>
		</Stack>
		{/if}
		<ChatComposer
			disabled={busy}
			{busy}
			{onSend}
			{onCancel}
			onAddModel={() => {
				onAddModel?.();
				addModelOpen = true;
			}}
			{onSelectModel}
			{chatModels}
			{selectedModelId}
			{sessionUsage}
			bind:draft
			{runtimeStatus}
		/>
	{/if}
	{#if addModelOpen}
		<AddModelDialog onClose={() => (addModelOpen = false)} />
	{/if}
</Block>

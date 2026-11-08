<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Stack from "../compose/Stack.svelte";
	import { t } from "../i18n/dictionary";
	import type { ChatSession } from "../chat-core";
	import type { GrokChatModel, SessionUsage } from "@buildytech/builder-core";
	import ChatComposer from "./ChatComposer.svelte";
	import ChatMessage from "./ChatMessage.svelte";
	import HomeOnboarding from "./HomeOnboarding.svelte";
	import AddModelDialog from "./AddModelDialog.svelte";

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
		runtimeStatus?: {
			mode: "live" | "mock" | "booting";
			capabilities: { liveModel?: boolean; live?: { requested?: boolean; model?: string }; mode?: string; runtime?: string; note?: string } | null;
			error: string | null;
			canDelete: boolean;
			lastRequestId: string | null;
		} | null;
	} = $props();

	const messages = $derived(session?.messages ?? []);
	const empty = $derived(messages.length === 0);

	let draft = $state("");
	let addModelOpen = $state(false);

	function onEdit(text: string) {
		draft = text;
	}

	function activityFor(message: (typeof messages)[number]): string[] {
		const arts = message.artifacts ?? [];
		const lines: string[] = [];
		for (const a of arts) {
			if (a.kind === "saved_page") {
				for (const file of a.files) {
					lines.push(t("message.wrote").replace("{file}", file));
				}
				lines.push(
					t("message.savedRevision")
						.replace("{slug}", a.slug)
						.replace("{revision}", String(a.revision))
				);
			}
		}
		return lines;
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
		<Stack class="min-h-0 flex-1 gap-9 overflow-y-auto px-3 py-4">
			<Stack class="w-full gap-9">
				{#each messages as message (message.id)}
					{@const activity = activityFor(message)}
					<ChatMessage
						{message}
						{activity}
						showActivity={message.role === "assistant" && activity.length > 0}
						{onEdit}
						{onApply}
						{onDiscard}
					/>
				{/each}
			</Stack>
		</Stack>
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

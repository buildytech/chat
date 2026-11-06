<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Stack from "../compose/Stack.svelte";
	import Text from "../../ui/text/Text.svelte";
	import Title from "../compose/Title.svelte";
	import { t } from "../i18n/dictionary";
	import { blocksOf, getCurrentPage, walkBlocks } from "../page-store";
	import type { ChatSession } from "../chat-core";
	import ChatComposer from "./ChatComposer.svelte";
	import ChatMessage from "./ChatMessage.svelte";

	let {
		session,
		busy,
		onSend
	}: {
		session: ChatSession | null;
		busy: boolean;
		onSend: (text: string) => void;
	} = $props();

	const messages = $derived(session?.messages ?? []);
	const empty = $derived(messages.length === 0);
	const page = $derived(getCurrentPage());
	const lastAssistantId = $derived(
		[...messages].reverse().find((message) => message.role === "assistant")?.id ?? null
	);
	const activity = $derived.by(() => {
		const files = ["page.latte", ...walkBlocks(blocksOf(page)).slice(0, 4).map((block) => `blocks/${block.id}.latte`)];
		return files.map((file) => t("message.wrote").replace("{file}", file));
	});

	let draft = $state("");

	function onEdit(text: string) {
		draft = text;
	}
</script>

<Block class="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
	<Stack class="min-h-0 flex-1 gap-9 overflow-y-auto px-3 py-4">
		{#if empty}
			<Stack class="gap-2 py-8 text-center">
				<Title as={2} class="text-lg font-medium text-foreground">{t("empty.title")}</Title>
				<Text tag="p" class="text-sm text-muted-foreground">{t("empty.subtitle")}</Text>
			</Stack>
		{:else}
			<Stack class="w-full gap-9">
				{#each messages as message (message.id)}
					<ChatMessage
						{message}
						activity={activity}
						showActivity={message.role === "assistant" && message.id === lastAssistantId}
						{onEdit}
					/>
				{/each}
			</Stack>
		{/if}
	</Stack>
	<ChatComposer disabled={busy} {onSend} bind:draft />
</Block>

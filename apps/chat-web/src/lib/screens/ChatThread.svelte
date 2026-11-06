<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Stack from "../compose/Stack.svelte";
	import Text from "../../ui/text/Text.svelte";
	import Title from "../compose/Title.svelte";
	import { t } from "../i18n/dictionary";
	import { theme } from "../theme/theme.svelte";
	import type { ChatSession } from "../api/types";
	import ChatComposer from "./ChatComposer.svelte";
	import ChatMessage from "./ChatMessage.svelte";
	import ChatThreadHeader from "./ChatThreadHeader.svelte";

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
	const title = $derived(session?.title ?? t("empty.title"));
</script>

<Block tag="main" id="main-content" class="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
	<ChatThreadHeader {title} isDark={theme.isDark} onToggleTheme={() => theme.toggle()} />
	<Stack class="min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-6 md:px-8">
		{#if empty}
			<Stack class="mx-auto max-w-xl gap-2 py-16 text-center">
				<Title as={2} class="text-2xl font-medium text-foreground">{t("empty.title")}</Title>
				<Text tag="p" class="text-sm text-muted-foreground">{t("empty.subtitle")}</Text>
			</Stack>
		{:else}
			<Stack class="mx-auto w-full max-w-3xl gap-3">
				{#each messages as message (message.id)}
					<ChatMessage {message} />
				{/each}
			</Stack>
		{/if}
	</Stack>
	<ChatComposer disabled={busy} {onSend} />
</Block>

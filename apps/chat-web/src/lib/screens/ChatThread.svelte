<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Stack from "../compose/Stack.svelte";
	import Text from "../../ui/text/Text.svelte";
	import Title from "../compose/Title.svelte";
	import { t } from "../i18n/dictionary";
	import type { ChatSession } from "../chat-core";
	import ChatComposer from "./ChatComposer.svelte";
	import ChatMessage from "./ChatMessage.svelte";

	let {
		session,
		busy,
		onSend,
		runtimeStatus = null
	}: {
		session: ChatSession | null;
		busy: boolean;
		onSend: (text: string) => void | Promise<void>;
		runtimeStatus?: {
			mode: "live" | "mock" | "booting";
			capabilities: { liveModel?: boolean; mode?: string; runtime?: string; note?: string } | null;
			error: string | null;
			canDelete: boolean;
			lastRequestId: string | null;
		} | null;
	} = $props();

	const messages = $derived(session?.messages ?? []);
	const empty = $derived(messages.length === 0);

	let draft = $state("");

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
	<Stack class="min-h-0 flex-1 gap-9 overflow-y-auto px-3 py-4">
		{#if empty}
			<Stack class="gap-2 py-8 text-center">
				<Title as={2} class="text-lg font-medium text-foreground">{t("empty.title")}</Title>
				<Text tag="p" class="text-sm text-muted-foreground">{t("empty.subtitle")}</Text>
			</Stack>
		{:else}
			<Stack class="w-full gap-9">
				{#each messages as message (message.id)}
					{@const activity = activityFor(message)}
					<ChatMessage
						{message}
						{activity}
						showActivity={message.role === "assistant" && activity.length > 0}
						{onEdit}
					/>
				{/each}
			</Stack>
		{/if}
	</Stack>
	<ChatComposer disabled={busy} {onSend} bind:draft {runtimeStatus} />
</Block>

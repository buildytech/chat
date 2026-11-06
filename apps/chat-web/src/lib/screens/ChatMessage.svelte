<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Stack from "../compose/Stack.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import type { ChatMessage as ChatMessageModel } from "../api/types";

	let { message }: { message: ChatMessageModel } = $props();

	const mine = $derived(message.role === "user");
</script>

<Block
	tag="article"
	class={cn(
		"max-w-3xl rounded-default px-4 py-3",
		mine
			? "ml-auto bg-primary text-primary-foreground"
			: "mr-auto bg-secondary text-secondary-foreground"
	)}
>
	<Stack class="gap-1">
		<Text tag="span" class="text-xs font-semibold opacity-80">
			{mine ? t("message.you") : t("message.assistant")}
		</Text>
		<Text tag="p" class="text-sm whitespace-pre-wrap">{message.text}</Text>
	</Stack>
</Block>

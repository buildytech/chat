<script lang="ts">
	import Block from "../compose/Block.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import type { ChatSession } from "../chat-core";
	import ChatThread from "./ChatThread.svelte";

	let {
		session,
		busy,
		onSend,
		visible = true
	}: {
		session: ChatSession | null;
		busy: boolean;
		onSend: (text: string) => void;
		visible?: boolean;
	} = $props();
</script>

<Block
	tag="section"
	id="creator-chat-column"
	aria-label={t("shell.chatColumn")}
	class={cn(
		"min-h-0 min-w-0 flex-col border-r border-border bg-background",
		visible ? "flex flex-1" : "hidden",
		"lg:flex lg:w-80 lg:flex-none lg:shrink-0"
	)}
>
	<ChatThread {session} {busy} {onSend} />
</Block>

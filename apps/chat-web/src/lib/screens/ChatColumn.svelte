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
		runtimeStatus = null,
		visible = true,
		chatHidden = false
	}: {
		session: ChatSession | null;
		busy: boolean;
		onSend: (text: string) => void | Promise<void>;
		runtimeStatus?: {
			mode: "live" | "mock" | "booting";
			capabilities: { liveModel?: boolean; live?: { requested?: boolean; model?: string }; mode?: string; runtime?: string; note?: string } | null;
			error: string | null;
			canDelete: boolean;
			lastRequestId: string | null;
		} | null;
		visible?: boolean;
		chatHidden?: boolean;
	} = $props();
</script>

<Block
	tag="section"
	id="creator-chat-column"
	aria-label={t("shell.chatColumn")}
	class={cn(
		"min-h-0 min-w-0 flex-col border-r border-border bg-background",
		visible ? "flex flex-1" : "max-lg:hidden",
		chatHidden ? "lg:hidden" : "lg:flex lg:w-[var(--creator-chat-w,320px)] lg:flex-none lg:shrink-0"
	)}
>
	<ChatThread {session} {busy} {onSend} {runtimeStatus} />
</Block>

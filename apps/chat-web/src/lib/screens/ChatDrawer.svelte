<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import type { SessionSummary } from "../api/types";
	import ChatSidebar from "./ChatSidebar.svelte";

	let {
		open,
		sessions,
		selectedId,
		onNew,
		onSelect,
		onDelete,
		onClose
	}: {
		open: boolean;
		sessions: SessionSummary[];
		selectedId: string | null;
		onNew: () => void;
		onSelect: (id: string) => void;
		onDelete: (id: string) => void;
		onClose: () => void;
	} = $props();
</script>

<Block
	id="chat-sidebar-drawer"
	class={cn(
		"absolute inset-y-0 left-0 z-20 h-full md:static md:z-auto",
		open ? "flex" : "hidden md:flex"
	)}
>
	<ChatSidebar {sessions} {selectedId} {onNew} {onSelect} {onDelete} />
</Block>
{#if open}
	<Button
		class="absolute inset-0 z-10 bg-foreground/20 md:hidden"
		aria-label={t("sidebar.close")}
		onclick={onClose}
	>
		<Text tag="span" class="sr-only">{t("sidebar.close")}</Text>
	</Button>
{/if}

<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import type { SessionSummary } from "../chat-core";
	import AppNav from "./AppNav.svelte";

	let {
		open,
		collapsed = false,
		sessions,
		selectedId,
		onNew,
		onSelect,
		onDelete,
		onClose,
		onToggle
	}: {
		open: boolean;
		collapsed?: boolean;
		sessions: SessionSummary[];
		selectedId: string | null;
		onNew: () => void;
		onSelect: (id: string) => void;
		onDelete: (id: string) => void;
		onClose: () => void;
		onToggle?: () => void;
	} = $props();
</script>

<Block
	id="chat-sidebar-drawer"
	class={cn(
		"absolute inset-y-0 left-0 z-20 h-full lg:static lg:z-auto",
		open ? "flex" : "hidden",
		collapsed ? "lg:hidden" : "lg:flex"
	)}
>
	<AppNav {sessions} {selectedId} {onNew} {onSelect} {onDelete} {onToggle} />
</Block>
{#if open}
	<Button
		class="absolute inset-0 z-10 bg-foreground/20 lg:hidden"
		aria-label={t("sidebar.close")}
		onclick={onClose}
	>
		<Text tag="span" class="sr-only">{t("sidebar.close")}</Text>
	</Button>
{/if}

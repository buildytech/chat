<script lang="ts">
	import Block from "$registry/compose/Block.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import type { SessionSummary } from "$lib/chat-core";
	import AppNav from "./AppNav.svelte";

	let {
		open,
		collapsed = false,
		sessions,
		selectedId,
		onNew,
		onSelect,
		onDelete,
		canDelete = false,
		onClose,
		onToggle
	}: {
		open: boolean;
		collapsed?: boolean;
		sessions: SessionSummary[];
		selectedId: string | null;
		onNew: () => void | Promise<void>;
		onSelect: (id: string) => void | Promise<void>;
		onDelete: (id: string) => void;
		canDelete?: boolean;
		onClose: () => void;
		onToggle?: () => void;
	} = $props();
</script>

<Block
	id="chat-sidebar-drawer"
	class={cn(
		"absolute inset-y-0 left-0 z-20 h-full shrink-0 lg:static lg:z-auto",
		open ? "flex" : "max-lg:hidden",
		"lg:flex"
	)}
>
	<AppNav {sessions} {selectedId} {onNew} {onSelect} {onDelete} {onToggle} {collapsed} {canDelete} />
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

<script lang="ts">
	import { tick } from "svelte";
	import Block from "$registry/compose/Block.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import type { ProjectSummary } from "$lib/project";
	import NavPanel from "./NavPanel.svelte";

	let {
		open,
		collapsed = false,
		projects,
		selectedId,
		onNew,
		onSelect,
		onDelete,
		canDelete = true,
		onClose,
	}: {
		open: boolean;
		collapsed?: boolean;
		projects: ProjectSummary[];
		selectedId: string | null;
		onNew: () => void | Promise<void>;
		onSelect: (id: string) => void | Promise<void>;
		onDelete: (id: string) => void;
		canDelete?: boolean;
		onClose: () => void;
	} = $props();

	async function closeDrawer() {
		onClose();
		await tick();
		document.querySelector<HTMLElement>('[data-action="nav-toggle"]')?.focus();
	}

	$effect(() => {
		if (open) void tick().then(() => document.querySelector<HTMLElement>('[data-action="nav-close"]')?.focus());
	});
</script>

<svelte:window onkeydown={(event) => {
	if (open && event.key === "Escape" && !event.defaultPrevented && !document.querySelector('#creator-settings, #sidebar-chat-search, [role="dialog"], dialog[open]')) {
		event.preventDefault();
		void closeDrawer();
	}
}} />

<Block
	id="chat-sidebar-drawer"
	class={cn(
		"absolute inset-y-0 left-0 z-20 h-full shrink-0 lg:static lg:z-auto",
		open ? "flex" : "max-lg:hidden",
		"lg:flex",
	)}
>
	<NavPanel {projects} {selectedId} {onNew} {onSelect} {onDelete} onClose={closeDrawer} {collapsed} {canDelete} />
</Block>
{#if open}
	<Button class="absolute inset-0 z-10 bg-foreground/20 lg:hidden" aria-label={t("sidebar.close")} onclick={closeDrawer}>
		<Text tag="span" class="sr-only">{t("sidebar.close")}</Text>
	</Button>
{/if}

<script lang="ts">
	import Menu from "@lucide/svelte/icons/menu";
	import X from "@lucide/svelte/icons/x";
	import Group from "$registry/compose/Group.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { getCurrentPage } from "$lib/page-store";

	let {
		sidebarOpen = false,
		onToggleSidebar
	}: {
		sidebarOpen?: boolean;
		onToggleSidebar?: () => void;
	} = $props();

	const page = $derived(getCurrentPage());
	const pageTitle = $derived(page?.title?.trim() ? page.title : t("thread.untitled"));
</script>

<Group
	class="h-10 w-full shrink-0 items-center justify-between gap-2 border-b border-border px-2"
	role="toolbar"
	aria-label={t("shell.topBar")}
	data-block="creator-top-bar"
>
	<Group class="min-w-0 items-center gap-2">
		<Button
			class="inline-flex size-8 items-center justify-center rounded text-foreground hover:bg-accent"
			aria-label={sidebarOpen ? t("sidebar.collapse") : t("sidebar.expand")}
			title={sidebarOpen ? t("sidebar.collapse") : t("sidebar.expand")}
			data-action="nav-toggle"
			expanded={sidebarOpen}
			aria-controls="chat-sidebar-drawer"
			onclick={onToggleSidebar}
		>
			<Icon size="sm">
				{#if sidebarOpen}
					<X />
				{:else}
					<Menu />
				{/if}
			</Icon>
		</Button>
		<Text tag="span" class="truncate font-semibold text-foreground">{pageTitle}</Text>
	</Group>
</Group>

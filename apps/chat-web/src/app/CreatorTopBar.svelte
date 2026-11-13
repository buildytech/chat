<script lang="ts">
	import FolderArchive from "@lucide/svelte/icons/folder-archive";
	import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
	import PanelLeftClose from "@lucide/svelte/icons/panel-left-close";
	import Group from "$registry/compose/Group.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { getChatSkin } from "$lib/chat-core";
	import { downloadPageZip, getCurrentPage } from "$lib/page-store";
	import { packSkinOptions } from "$lib/theme/custom-skin.svelte";

	let {
		sidebarOpen = false,
		onToggleSidebar
	}: {
		sidebarOpen?: boolean;
		onToggleSidebar?: () => void;
	} = $props();

	const page = $derived(getCurrentPage());
	const pageTitle = $derived(page?.title?.trim() ? page.title : t("thread.untitled"));

	function onDownloadZip() {
		if (!page) return;
		void downloadPageZip(page, packSkinOptions(getChatSkin()));
	}
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
					<PanelLeftClose />
				{:else}
					<PanelLeftOpen />
				{/if}
			</Icon>
		</Button>
		<Text tag="span" class="truncate text-sm font-semibold text-foreground">{pageTitle}</Text>
	</Group>
	<Button
		class="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded px-2 text-xs text-foreground hover:bg-accent"
		aria-label={t("workspace.downloadZip")}
		title={t("workspace.downloadZip")}
		onclick={onDownloadZip}
	>
		<Icon size="sm"><FolderArchive /></Icon>
		<Text tag="span" class="max-sm:hidden">{t("workspace.downloadZip")}</Text>
	</Button>
</Group>

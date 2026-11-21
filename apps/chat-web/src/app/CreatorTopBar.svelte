<script lang="ts">
import { FolderArchive, PanelLeftOpen, PanelLeftClose } from "$lib/shell-icons";
	import Group from "$registry/compose/Group.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { getProjectSkin, getSelectedProject } from "$lib/project";
	import { downloadPageZip, getCurrentPage } from "$lib/page-store";
	import { imageSources } from "$lib/modules/registry.svelte";
	import { packSkinOptions } from "$lib/theme/custom-skin.svelte";

	let {
		sidebarOpen = false,
		onToggleSidebar
	}: {
		sidebarOpen?: boolean;
		onToggleSidebar?: () => void;
	} = $props();

	const page = $derived(getCurrentPage());
	const pageTitle = $derived(page?.title?.trim() ? page.title : getSelectedProject()?.title?.trim() || t("page.untitled"));

	let preparing = $state(false);
	/** Pictures the last export could not download (they stay remote in the project; manifest.json lists them). */
	let remotePictures = $state(0);

	async function onDownloadZip() {
		if (!page || preparing) return;
		preparing = true;
		try {
			const images = await downloadPageZip(page, packSkinOptions(getProjectSkin()), imageSources());
			remotePictures = images?.remote.length ?? 0;
		} finally {
			preparing = false;
		}
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
	<Group class="min-w-0 shrink-0 items-center gap-2">
		{#if remotePictures > 0 && !preparing}
			<Text tag="span" class="truncate text-xs text-muted-foreground max-sm:hidden" role="status" data-zip-remote={remotePictures}>{t("workspace.zipImagesRemote").replace("{count}", String(remotePictures))}</Text>
		{/if}
		<Button
			class="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded px-2 text-xs text-foreground hover:bg-accent"
			aria-label={t("workspace.downloadZip")}
			aria-busy={preparing}
			title={t("workspace.downloadZip")}
			data-action="download-zip"
			onclick={onDownloadZip}
		>
			<Icon size="sm"><FolderArchive /></Icon>
			<Text tag="span" class="max-sm:hidden">{preparing ? t("workspace.zipPreparing") : t("workspace.downloadZip")}</Text>
		</Button>
	</Group>
</Group>

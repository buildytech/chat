<script lang="ts">
import { ChevronDown, FolderArchive, PanelLeftOpen, PanelLeftClose } from "$lib/shell-icons";
	import Group from "$registry/compose/Group.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { getProjectSkin, getSelectedProject } from "$lib/project";
	import { downloadPageZip, getCurrentPage, type ExportChoice, type TemplPreset } from "$lib/page-store";
	import CreatorZipMenu, { PRESET_LABEL } from "./CreatorZipMenu.svelte";
	import { imageEncoder, imageSources, zipSaver } from "$lib/modules/registry.svelte";
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

	/** The export format (ADR 0069): Svelte, or the Go templ starter with a preset; chosen in CreatorZipMenu. */
	let format = $state<"svelte" | "templ">("svelte");
	let preset = $state<TemplPreset>("shop");
	const choice: ExportChoice = $derived(format === "svelte" ? { framework: "svelte" } : { framework: "templ", preset });
	let formatOpen = $state(false);
	const formatLabel = $derived(format === "svelte" ? t("workspace.zipSvelte") : `${t("workspace.zipTempl")} · ${t(PRESET_LABEL[preset])}`);

	function onWindowKey(event: KeyboardEvent) {
		if (event.key !== "Escape" || !formatOpen) return;
		formatOpen = false;
		document.getElementById("zip-format-trigger")?.focus();
	}
	function onWindowPointer(event: PointerEvent) {
		if (formatOpen && event.target instanceof Element && !event.target.closest("#zip-format-list, #zip-format-trigger")) formatOpen = false;
	}

	async function onDownloadZip() {
		if (!page || preparing) return;
		preparing = true;
		try {
			const images = await downloadPageZip(page, packSkinOptions(getProjectSkin()), imageSources(), imageEncoder(), zipSaver(), choice);
			remotePictures = images?.remote.length ?? 0;
		} finally {
			preparing = false;
		}
	}
</script>

<svelte:window onkeydown={onWindowKey} onpointerdown={onWindowPointer} />

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
		<Group class="relative shrink-0 items-center gap-1">
			<Button
				class="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded px-2 text-xs text-foreground hover:bg-accent"
				aria-label={t("workspace.downloadZipAs").replace("{format}", formatLabel)}
				aria-busy={preparing}
				title={t("workspace.downloadZipAs").replace("{format}", formatLabel)}
				data-action="download-zip"
				data-format={format}
				onclick={onDownloadZip}
			>
				<Icon size="sm"><FolderArchive /></Icon>
				<Text tag="span" class="max-sm:hidden">{preparing ? t("workspace.zipPreparing") : t("workspace.downloadZip")}</Text>
			</Button>
			<Button
				id="zip-format-trigger"
				class="inline-flex size-8 shrink-0 items-center justify-center rounded text-foreground hover:bg-accent"
				aria-label={t("workspace.zipFormatMenu")}
				title={t("workspace.zipFormatMenu")}
				expanded={formatOpen}
				aria-controls="zip-format-list"
				data-action="zip-format"
				onclick={() => (formatOpen = !formatOpen)}
			>
				<Icon size="sm"><ChevronDown /></Icon>
			</Button>
			{#if formatOpen}
				<CreatorZipMenu
					{format}
					{preset}
					{preparing}
					onFormat={(next) => (format = next)}
					onPreset={(next) => (preset = next)}
					onDownload={() => {
						formatOpen = false;
						void onDownloadZip();
					}}
				/>
			{/if}
		</Group>
	</Group>
</Group>

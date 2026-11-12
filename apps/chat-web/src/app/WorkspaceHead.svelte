<!--
  Workspace head (ADR 0017): one 40px tool bar. Left: chat column toggle (Ctrl+B) and the Preview / Code switch;
  right: Download ZIP, the inspector toggle (Build, Ctrl+I) and preview-only focus (Ctrl+\).
-->
<script lang="ts">
	import Box from "$registry/kit/ui/box/Box.svelte";
	import FolderArchive from "@lucide/svelte/icons/folder-archive";
	import Maximize2 from "@lucide/svelte/icons/maximize-2";
	import Minimize2 from "@lucide/svelte/icons/minimize-2";
	import PanelLeft from "@lucide/svelte/icons/panel-left";
	import PanelRight from "@lucide/svelte/icons/panel-right";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { creatorLayout } from "$lib/creator-layout.svelte";

	export type WorkspaceView = "preview" | "code";

	let {
		view = $bindable("preview"),
		build = false,
		inspectorOpen = false,
		ontogglechat,
		ontoggleinspector,
		onDownloadZip
	}: {
		view?: WorkspaceView;
		build?: boolean;
		inspectorOpen?: boolean;
		ontogglechat?: () => void;
		ontoggleinspector?: () => void;
		onDownloadZip?: () => void;
	} = $props();

	const chatOpen = $derived(!creatorLayout.collapsed("chat"));
	const focus = $derived(creatorLayout.focus);
</script>

<Group
	class="h-10 w-full shrink-0 items-center gap-2 border-b border-border px-2"
	role="toolbar"
	aria-label={t("workspace.head")}
	data-block="workspace-head"
	data-view={view}
>
	<Button
		size="sm"
		layout="icon"
		variant="ghost"
		class="max-lg:hidden"
		aria-label={chatOpen ? t("workspace.hideChat") : t("workspace.showChat")}
		title={`${chatOpen ? t("workspace.hideChat") : t("workspace.showChat")} (Ctrl+B)`}
		aria-expanded={chatOpen}
		aria-controls="creator-chat-column"
		data-action="chat-toggle"
		onclick={ontogglechat}
	>
		<PanelLeft />
	</Button>

	<Group class="gap-0 rounded bg-muted" role="tablist" aria-label={t("workspace.viewSwitcher")}>
		{#each ["preview", "code"] as const as option (option)}
			<Button
				size="sm"
				variant="ghost"
				class={cn("text-xs", view === option ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
				role="tab"
				aria-selected={view === option}
				aria-controls="pane-workspace"
				data-view={option}
				onclick={() => (view = option)}
			>
				<Text tag="span">{t(`workspace.${option}`)}</Text>
			</Button>
		{/each}
	</Group>

	<Box class="min-w-0 flex-1"></Box>
	<Group class="items-center gap-2">
		<Button size="sm" variant="outline" class="gap-2 text-xs" aria-label={t("workspace.downloadZip")} title={t("workspace.downloadZip")} onclick={onDownloadZip}>
			<Icon size="sm"><FolderArchive /></Icon>
			<Text tag="span" class="max-sm:hidden">{t("workspace.downloadZip")}</Text>
		</Button>
		{#if build && view === "preview"}
			<Button
				size="sm"
				layout="icon"
				variant="ghost"
				aria-label={inspectorOpen ? t("inspector.collapse") : t("inspector.expand")}
				title={`${inspectorOpen ? t("inspector.collapse") : t("inspector.expand")} (Ctrl+I)`}
				aria-expanded={inspectorOpen}
				aria-controls="creator-inspector"
				data-action="inspector-toggle"
				onclick={ontoggleinspector}
			>
				<PanelRight />
			</Button>
		{/if}
		<Button
			size="sm"
			layout="icon"
			variant="ghost"
			class="max-lg:hidden"
			aria-label={focus ? t("workspace.focusOff") : t("workspace.focusOn")}
			title={`${focus ? t("workspace.focusOff") : t("workspace.focusOn")} (Ctrl+\\)`}
			aria-pressed={focus}
			data-action="focus-toggle"
			onclick={() => creatorLayout.toggleFocus()}
		>
			{#if focus}<Minimize2 />{:else}<Maximize2 />{/if}
		</Button>
	</Group>
</Group>

<script lang="ts">
	import Block from "$registry/compose/Block.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Sheet from "$registry/compose/Sheet.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { cn } from "$registry/utils/cn";
	import { getChatMode, getChatSkin } from "$lib/chat-core";
	import { t } from "$lib/i18n/dictionary";
	import { creatorLayout } from "$lib/creator-layout.svelte";
	import { downloadPageZip, getCurrentPage } from "$lib/page-store";
	import CodePane from "./CodePane.svelte";
	import InspectorColumn from "./InspectorColumn.svelte";
	import PaneSplitter from "./PaneSplitter.svelte";
	import PreviewPane from "./PreviewPane.svelte";
	import WorkspaceHead from "./WorkspaceHead.svelte";

	let {
		visible = true,
		sheetOpen = $bindable(false),
		ontogglechat
	}: {
		visible?: boolean;
		/** Below md the inspector is a sheet over the canvas (Ctrl+I and the head button open it). */
		sheetOpen?: boolean;
		ontogglechat?: () => void;
	} = $props();

	// Build is the editor: canvas + inspector column (Layers over Properties). Ask shows the canvas alone.
	const build = $derived(getChatMode() === "build");
	const column = $derived(creatorLayout.inspectorColumn);
	const inspectorCollapsed = $derived(creatorLayout.collapsed("inspector"));

	// The sheet is a non-modal native dialog: Escape closes it here.
	function onWindowKey(event: KeyboardEvent) {
		if (sheetOpen && event.key === "Escape") {
			event.preventDefault();
			sheetOpen = false;
		}
	}

	function onDownloadZip() {
		const page = getCurrentPage();
		if (!page) return;
		void downloadPageZip(page, { skin: getChatSkin() });
	}

	function toggleInspector() {
		if (column) creatorLayout.toggle("inspector");
		else sheetOpen = !sheetOpen;
	}
</script>

<svelte:window onkeydown={onWindowKey} />

<Block
	tag="section"
	id="pane-workspace"
	aria-label={t("workspace.region")}
	class={cn("min-h-0 min-w-0 flex-col bg-background", visible ? "flex flex-1" : "max-lg:hidden", "lg:flex lg:flex-1")}
	data-slot="workspace"
>
	<WorkspaceHead
		bind:view={creatorLayout.view}
		{build}
		inspectorOpen={column ? !inspectorCollapsed : sheetOpen}
		{ontogglechat}
		ontoggleinspector={toggleInspector}
		{onDownloadZip}
	/>
	{#if creatorLayout.view === "preview"}
		<Group align="stretch" class="min-h-0 flex-1 gap-0" data-slot="build-editor" data-mode={build ? "build" : "ask"}>
			<PreviewPane />
			{#if build && column}
				{#if !inspectorCollapsed}
					<PaneSplitter pane="inspector" controls="creator-inspector" edge="end" class="border-l border-border" />
				{/if}
				<InspectorColumn />
			{/if}
		</Group>
		{#if build && !column}
			<Sheet open={sheetOpen} side="right" aria-label={t("inspector.column")} data-slot="inspector-sheet">
				<Button class="absolute inset-0 h-full w-full bg-foreground/40" aria-label={t("inspector.close")} onclick={() => (sheetOpen = false)}>
					<Text tag="span" class="sr-only">{t("inspector.close")}</Text>
				</Button>
				<Box class="relative h-full w-full max-w-sm bg-card shadow-lg">
					<InspectorColumn sheet onclose={() => (sheetOpen = false)} />
				</Box>
			</Sheet>
		{/if}
	{:else}
		<CodePane />
	{/if}
</Block>

<script lang="ts">
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import { cn } from "$registry/utils/cn";
	import { getChatMode } from "$lib/chat-core";
	import { downloadPageZip, getCurrentPage, getSelectedBlockId } from "$lib/page-store";
	import BlockTree from "./BlockTree.svelte";
	import CodePane from "./CodePane.svelte";
	import InspectorPanel from "./InspectorPanel.svelte";
	import PreviewPane from "./PreviewPane.svelte";
	import WorkspaceHead from "./WorkspaceHead.svelte";

	let {
		visible = true,
		chatHidden = false,
		ontogglechat
	}: {
		visible?: boolean;
		chatHidden?: boolean;
		ontogglechat?: () => void;
	} = $props();

	let view = $state<"preview" | "code">("preview");
	// Build is the editor: the block tree sits next to the canvas. Ask shows the preview alone.
	const build = $derived(getChatMode() === "build");

	function onDownloadZip() {
		const page = getCurrentPage();
		if (!page) return;
		void downloadPageZip(page, getSelectedBlockId());
	}
</script>

<Block
	tag="section"
	id="pane-workspace"
	aria-label="Workspace"
	class={cn(
		"min-h-0 min-w-0 flex-col bg-background p-4",
		visible ? "flex flex-1" : "max-lg:hidden",
		"lg:flex lg:flex-1"
	)}
>
	<WorkspaceHead bind:view {chatHidden} {ontogglechat} {onDownloadZip} />
	{#if view === "preview"}
		<Group align="stretch" class="mt-4 min-h-0 flex-1 gap-4 max-lg:flex-col" data-slot="build-editor" data-mode={build ? "build" : "ask"}>
			{#if build}
				<BlockTree />
			{/if}
			<PreviewPane />
			{#if build}
				<InspectorPanel />
			{/if}
		</Group>
	{:else}
		<CodePane />
	{/if}
</Block>

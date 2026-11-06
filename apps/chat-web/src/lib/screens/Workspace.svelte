<script lang="ts">
	import Block from "../compose/Block.svelte";
	import { cn } from "../../utils/cn";
	import { downloadPageZip, getCurrentPage, getSelectedBlockId } from "../page-store";
	import CodePane from "./CodePane.svelte";
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

	function onDownloadZip() {
		const page = getCurrentPage();
		if (!page) return;
		downloadPageZip(page, getSelectedBlockId());
	}
</script>

<Block
	tag="section"
	id="pane-workspace"
	aria-label="Workspace"
	class={cn(
		"min-h-0 min-w-0 flex-col bg-background p-4",
		visible ? "flex flex-1" : "hidden",
		"lg:flex lg:flex-1"
	)}
>
	<WorkspaceHead bind:view {chatHidden} {ontogglechat} {onDownloadZip} />
	{#if view === "preview"}
		<PreviewPane />
	{:else}
		<CodePane />
	{/if}
</Block>

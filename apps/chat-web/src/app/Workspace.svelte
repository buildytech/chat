<script lang="ts">
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import { cn } from "$registry/utils/cn";
	import { editorMode } from "$lib/modules/registry.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { creatorLayout } from "$lib/creator-layout.svelte";
	import CodePane from "./CodePane.svelte";
	import InspectorSlideOver from "./InspectorSlideOver.svelte";
	import { inspectorPanel } from "$lib/inspector/panel.svelte";
	import PreviewPane from "./PreviewPane.svelte";
	import WorkspaceHead from "./WorkspaceHead.svelte";

	let {
		visible = true,
		ontogglechat
	}: {
		visible?: boolean;
		ontogglechat?: () => void;
	} = $props();

	// A module's Ask / Build switch controls the model tools; the manual editor stays available in either mode.
	const build = $derived(editorMode() === "build");

	// The slide-over is non-modal: Escape closes it unless something else (a menu, the composer) took the key.
	function onWindowKey(event: KeyboardEvent) {
		if (inspectorPanel.open && event.key === "Escape" && !event.defaultPrevented) {
			event.preventDefault();
			inspectorPanel.close();
		}
	}

	function toggleInspector() {
		inspectorPanel.toggle();
	}
</script>

<svelte:window onkeydown={onWindowKey} />

<Block
	tag="section"
	id="pane-workspace"
	aria-label={t("workspace.region")}
	class={cn("relative min-h-0 min-w-0 flex-col bg-background", visible ? "flex flex-1" : "max-lg:hidden", "lg:flex lg:flex-1")}
	data-slot="workspace"
>
	<WorkspaceHead
		bind:view={creatorLayout.view}
		inspectorOpen={inspectorPanel.open}
		{ontogglechat}
		ontoggleinspector={toggleInspector}
	/>
	{#if creatorLayout.view === "preview"}
		<Group align="stretch" class="relative min-h-0 flex-1 gap-0" data-slot="build-editor" data-mode={build ? "build" : "ask"}>
			<PreviewPane />
			{#if inspectorPanel.open}
				<!-- Over the preview only (absolute in the editor): the left panel stays usable while it is open. -->
				<InspectorSlideOver />
			{/if}
		</Group>
	{:else}
		<CodePane />
	{/if}
</Block>

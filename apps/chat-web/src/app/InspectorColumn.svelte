<!--
  Build inspector column (ADR 0017): Layers (the block tree) on top, Properties (the fields of the selected block)
  below, one column right of the canvas with a horizontal separator between them. Collapsed, it is a 48px rail with
  icon buttons. Below md it is not a column: Workspace shows the same content in a sheet (`sheet` = true).
-->
<script lang="ts">
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronRight from "@lucide/svelte/icons/chevron-right";
	import Layers from "@lucide/svelte/icons/layers";
	import PanelRightClose from "@lucide/svelte/icons/panel-right-close";
	import PanelRightOpen from "@lucide/svelte/icons/panel-right-open";
	import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
	import X from "@lucide/svelte/icons/x";
	import Block from "$registry/compose/Block.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { creatorLayout } from "$lib/creator-layout.svelte";
	import BlockTree from "./BlockTree.svelte";
	import InspectorPanel from "./InspectorPanel.svelte";
	import PaneSplitter from "./PaneSplitter.svelte";

	let { sheet = false, onclose }: { sheet?: boolean; onclose?: () => void } = $props();

	const collapsed = $derived(!sheet && creatorLayout.collapsed("inspector"));
	const layersOpen = $derived(!creatorLayout.collapsed("layers"));
	const width = $derived(sheet ? undefined : `width: ${creatorLayout.widths.inspector}px`);
	const shortcut = "Ctrl+I";

	function expand(focusId?: string) {
		creatorLayout.setCollapsed("inspector", false);
		if (focusId === "inspector-layers") creatorLayout.setCollapsed("layers", false);
		if (focusId) queueMicrotask(() => document.getElementById(focusId)?.focus());
	}
</script>

{#if collapsed}
	<Stack
		tag="aside"
		id="creator-inspector"
		align="center"
		class="shrink-0 gap-2 border-l border-border bg-card py-2"
		style={width}
		aria-label={t("inspector.column")}
		data-slot="inspector-rail"
	>
		<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.expand")} title={`${t("inspector.expand")} (${shortcut})`} aria-expanded="false" aria-controls="creator-inspector" data-action="inspector-expand" onclick={() => expand()}>
			<PanelRightOpen />
		</Button>
		<Button size="sm" layout="icon" variant="ghost" aria-label={t("workspace.blockTree")} title={t("workspace.blockTree")} onclick={() => expand("inspector-layers")}>
			<Layers />
		</Button>
		<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.title")} title={t("inspector.title")} onclick={() => expand("inspector-properties")}>
			<SlidersHorizontal />
		</Button>
	</Stack>
{:else}
	<Stack
		tag="aside"
		id="creator-inspector"
		align="stretch"
		class={cn("min-h-0 shrink-0 gap-0 bg-card", sheet ? "h-full w-full" : "border-l border-border")}
		style={width}
		aria-label={t("inspector.column")}
		data-slot="inspector-column"
	>
		<Group class="h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
			<Button
				size="sm"
				variant="ghost"
				id="inspector-layers"
				class="gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
				aria-expanded={layersOpen}
				aria-controls="inspector-layers-body"
				data-action="layers-toggle"
				onclick={() => creatorLayout.toggle("layers")}
			>
				<Icon size="sm">{#if layersOpen}<ChevronDown />{:else}<ChevronRight />{/if}</Icon>
				<Icon size="sm"><Layers /></Icon>
				<Text tag="span" class="text-xs">{t("workspace.blockTree")}</Text>
			</Button>
			{#if sheet}
				<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.close")} title={t("inspector.close")} data-action="inspector-close" onclick={onclose}>
					<X />
				</Button>
			{:else}
				<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.collapse")} title={`${t("inspector.collapse")} (${shortcut})`} aria-expanded="true" aria-controls="creator-inspector" data-action="inspector-collapse" onclick={() => creatorLayout.setCollapsed("inspector", true)}>
					<PanelRightClose />
				</Button>
			{/if}
		</Group>
		{#if layersOpen}
			<Block
				id="inspector-layers-body"
				class="min-h-0 shrink-0 overflow-y-auto"
				style={`height: ${creatorLayout.size("layers")}px`}
				data-slot="inspector-layers"
			>
				<BlockTree />
			</Block>
			<PaneSplitter pane="layers" controls="inspector-layers-body" orientation="horizontal" class="border-y border-border" />
		{/if}
		<Block id="inspector-properties" tabindex={-1} class="min-h-0 flex-1 overflow-y-auto" data-slot="inspector-properties">
			<InspectorPanel />
		</Block>
	</Stack>
{/if}

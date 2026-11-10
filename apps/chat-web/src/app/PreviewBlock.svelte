<!--
  One page block in the preview frame: its UI8Kit registry block (lazy-loaded from the registry tree), or the
  explicit "not in registry" stub. The wrapper carries the block id (`data-block-id` = PageBlock.id) for selection and
  hover; it adds no layout and no editor chrome. Outlines and labels of the Build canvas are drawn by the chat over the
  frame (CanvasOverlay), never inside the page. A click also picks the field under the pointer through the block's
  generated viewMap (ADR 0021) and focuses it in the inspector; the block DOM itself gets no attribute.
-->
<script lang="ts">
	import type { Component } from "svelte";
	import Alert from "$registry/compose/Alert.svelte";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { organismFor } from "@buildytech/builder-core";
	import { t } from "$lib/i18n/dictionary";
	import { tick } from "svelte";
	import { selectBlock, type PageBlock } from "$lib/page-store";
	import { canvas } from "$lib/inspector/canvas.svelte";
	import { fieldAtClick, focusInspectorControl } from "$lib/inspector/field-select";

	type Organism = Component<Record<string, unknown>>;
	const loaders = import.meta.glob<{ default: Organism }>("$registry/blocks/*.svelte");
	const byFile: Record<string, () => Promise<{ default: Organism }>> = Object.fromEntries(
		Object.entries(loaders).map(([path, load]) => [`blocks/${path.split("/").pop()}`, load])
	);

	// clean: no service labels (Settings, and always in the standalone preview window); standalone: no selection.
	let { block, clean = false, standalone = false }: { block: PageBlock; clean?: boolean; standalone?: boolean } = $props();

	const render = $derived(organismFor(block));
	const load = $derived(render ? byFile[render.organism] : undefined);

	async function pick(event: MouseEvent) {
		selectBlock(block.id);
		const wrapper = event.currentTarget as Element;
		const target = event.target as Element | null;
		const pointer = target ? fieldAtClick(block, wrapper, target) : null;
		if (!pointer) {
			canvas.clearField();
			return;
		}
		canvas.selectField(block.id, pointer, "preview");
		await tick();
		focusInspectorControl(document, block.id, pointer);
	}
</script>

<Block
	tag="article"
	class="overflow-hidden"
	aria-label={standalone ? undefined : t("preview.selectBlock")}
	data-block-id={block.id}
	data-renderer={render && load ? "registry" : "stub"}
	data-registry-item={render?.item}
	data-variant={render?.variant}
	onclick={standalone ? undefined : pick}
	onpointerenter={standalone ? undefined : () => canvas.hover(block.id)}
	onpointerleave={standalone ? undefined : () => canvas.hover(null)}
>
	{#if !clean}
	<Group class="flex-wrap gap-2 border-b border-border bg-muted px-4 py-2" data-slot="block-provenance">
		<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{block.kind}</Text>
		<Text tag="span" class="text-xs text-muted-foreground">
			{#if render && load}
				{t("preview.registryRenderer")}: {render.item} / {render.variant}
			{:else}
				{t("preview.notInRegistry")}
			{/if}
		</Text>
	</Group>
	{/if}
	{#if render && load}
		{#await load() then module}
			<module.default {...render.props} />
		{:catch}
			<Alert variant="destructive" data-slot="registry-stub">{t("preview.registryLoadFailed")}: {render.organism}</Alert>
		{/await}
	{:else}
		<Alert variant="destructive" data-slot="registry-stub">
			{t("preview.notInRegistry")}: {block.catalogBlock ?? block.kind}{block.variant ? ` / ${block.variant}` : ""}
		</Alert>
	{/if}
</Block>

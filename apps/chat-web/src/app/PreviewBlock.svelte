<!--
  One page block in the preview frame: its UI8Kit registry block (lazy-loaded from the registry tree), or the
  explicit "not in registry" stub. The wrapper only selects the block and labels where it comes from; it adds no layout.
-->
<script lang="ts">
	import type { Component } from "svelte";
	import Alert from "$registry/compose/Alert.svelte";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { organismFor } from "@buildytech/builder-core";
	import { t } from "$lib/i18n/dictionary";
	import { selectBlock, type PageBlock } from "$lib/page-store";
	import { cn } from "$registry/utils/cn";

	type Organism = Component<Record<string, unknown>>;
	const loaders = import.meta.glob<{ default: Organism }>("$registry/blocks/*.svelte");
	const byFile: Record<string, () => Promise<{ default: Organism }>> = Object.fromEntries(
		Object.entries(loaders).map(([path, load]) => [`blocks/${path.split("/").pop()}`, load])
	);

	let { block, selectedId }: { block: PageBlock; selectedId: string | null } = $props();

	const selected = $derived(selectedId === block.id);
	const render = $derived(organismFor(block));
	const load = $derived(render ? byFile[render.organism] : undefined);
</script>

<Block
	tag="article"
	class={cn("overflow-hidden outline-2 -outline-offset-2", selected ? "outline-primary" : "outline-transparent")}
	aria-label={t("preview.selectBlock")}
	data-renderer={render && load ? "registry" : "stub"}
	data-registry-item={render?.item}
	data-variant={render?.variant}
	onclick={() => selectBlock(block.id)}
>
	<Group class="flex-wrap gap-2 border-b border-border bg-muted px-4 py-1" data-slot="block-provenance">
		<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{block.kind}</Text>
		<Text tag="span" class="text-xs text-muted-foreground">
			{#if render && load}
				{t("preview.registryRenderer")}: {render.item} / {render.variant}
			{:else}
				{t("preview.notInRegistry")}
			{/if}
		</Text>
	</Group>
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

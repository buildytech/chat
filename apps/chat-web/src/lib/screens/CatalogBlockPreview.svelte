<!--
  A page block rendered by its real UI8Kit registry organism (vendored, sha256-pinned snapshot). The organism sits in
  a .ui8kit-preview scope: kit tokens, radius and font there; the chat theme everywhere else.
-->
<script lang="ts">
	import type { Component } from "svelte";
	import type { OrganismRender } from "@buildytech/builder-core";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Box from "../../ui/box/Box.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import { selectBlock, type PageBlock } from "../page-store";

	const modules = import.meta.glob<{ default: Component<Record<string, unknown>> }>("../../registry/svelte/blocks/*.svelte", {
		eager: true
	});
	const organisms: Record<string, Component<Record<string, unknown>>> = Object.fromEntries(
		Object.entries(modules).map(([path, module]) => [path.replace("../../registry/svelte/", ""), module.default])
	);

	let {
		block,
		selectedId,
		render
	}: {
		block: PageBlock;
		selectedId: string | null;
		render: OrganismRender;
	} = $props();

	const selected = $derived(selectedId === block.id);
	const Organism = $derived(organisms[render.organism]);
</script>

<Block
	tag="article"
	class={cn("overflow-hidden rounded-default border", selected ? "border-primary" : "border-border")}
	aria-label={t("preview.selectBlock")}
	data-renderer="registry"
	data-registry-item={render.item}
	data-variant={render.variant}
	onclick={() => selectBlock(block.id)}
>
	<Group class="flex-wrap items-center gap-2 border-b border-border px-4 py-2">
		<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{block.kind}</Text>
		<Text tag="span" class="text-xs text-muted-foreground">
			{t("preview.registryRenderer")}: {render.item} / {render.variant}
		</Text>
	</Group>
	<Box class="ui8kit-preview">
		{#if Organism}
			<Organism {...render.props} />
		{/if}
	</Box>
</Block>

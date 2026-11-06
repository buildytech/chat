<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Stack from "../compose/Stack.svelte";
	import Text from "../../ui/text/Text.svelte";
	import Title from "../compose/Title.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import { selectBlock, type PageBlock } from "../page-store";

	let {
		block,
		selectedId
	}: {
		block: PageBlock;
		selectedId: string | null;
	} = $props();

	const selected = $derived(selectedId === block.id);

	function onSelect(event: Event) {
		event.stopPropagation();
		selectBlock(block.id);
	}
</script>

<Block
	tag="article"
	class={cn(
		"rounded-default border px-3 py-2",
		selected ? "border-primary bg-accent" : "border-border bg-background"
	)}
	aria-label={t("preview.selectBlock")}
	onclick={onSelect}
>
	<Stack class="gap-1">
		<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
			{block.kind}
		</Text>
		<Title as={3} class="text-sm font-medium text-foreground">{block.title}</Title>
		<Text tag="p" class="text-sm text-muted-foreground">{block.summary}</Text>
	</Stack>
</Block>

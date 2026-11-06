<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Stack from "../compose/Stack.svelte";
	import Text from "../../ui/text/Text.svelte";
	import Title from "../compose/Title.svelte";
	import type { PageBlock } from "../page-store";

	let { block }: { block: PageBlock } = $props();
</script>

<Block tag="article" class="rounded-default border border-border bg-card px-4 py-3">
	<Stack class="gap-2">
		<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
			{block.kind}
		</Text>
		<Title as={3} class="text-base font-medium text-foreground">{block.title}</Title>
		<Text tag="p" class="text-sm text-muted-foreground">{block.summary}</Text>
	</Stack>
</Block>

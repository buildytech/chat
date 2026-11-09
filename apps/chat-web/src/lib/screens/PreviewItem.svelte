<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Box from "../../ui/box/Box.svelte";
	import Text from "../../ui/text/Text.svelte";
	import Title from "../compose/Title.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import { selectBlock, type PageBlock } from "../page-store";
	import type { ItemView } from "../page-store/data-view";

	let {
		block,
		selectedId,
		view = "plain",
		barClass = "h-2"
	}: {
		block: PageBlock;
		selectedId: string | null;
		view?: ItemView;
		barClass?: string;
	} = $props();

	const selected = $derived(selectedId === block.id);
	const copy = $derived(block.copy);

	function onSelect(event: Event) {
		event.stopPropagation();
		selectBlock(block.id);
	}
</script>

<Block
	tag="article"
	class={cn(
		"rounded-default border px-3 py-2",
		view === "bar" ? "flex min-w-0 flex-1 flex-col justify-end" : "",
		selected ? "border-primary bg-accent" : "border-border bg-background"
	)}
	aria-label={t("preview.selectBlock")}
	data-item-view={view}
	onclick={onSelect}
>
	{#if view === "tile"}
		<Stack class="gap-1">
			<Text tag="span" class="text-xs text-muted-foreground">{block.title}</Text>
			<Text tag="span" class="text-2xl font-semibold text-foreground">{copy?.value ?? ""}</Text>
			{#if copy?.note}
				<Text tag="span" class="text-xs text-muted-foreground">{copy.note}</Text>
			{/if}
		</Stack>
	{:else if view === "row"}
		<Group class="items-start justify-between gap-3">
			<Stack class="min-w-0 gap-1">
				<Title as={3} class="text-sm font-medium text-foreground">{block.title}</Title>
				{#if block.summary !== block.title}
					<Text tag="p" class="text-xs text-muted-foreground">{block.summary}</Text>
				{/if}
			</Stack>
			{#if copy?.note}
				<Text tag="span" class="shrink-0 text-xs text-muted-foreground">{copy.note}</Text>
			{/if}
		</Group>
	{:else if view === "bar"}
		<Stack class="items-stretch gap-1">
			<Text tag="span" class="text-center text-xs font-medium text-foreground">{copy?.value ?? ""}</Text>
			<Box class={cn("w-full rounded-default bg-primary", barClass)} aria-hidden="true"></Box>
			<Text tag="span" class="truncate text-center text-xs text-muted-foreground">{block.title}</Text>
		</Stack>
	{:else}
		<Stack class="gap-1">
			<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				{block.kind}
			</Text>
			<Title as={3} class="text-sm font-medium text-foreground">{block.title}</Title>
			<Text tag="p" class="text-sm text-muted-foreground">{block.summary}</Text>
			{#if copy?.value}
				<Text tag="span" class="text-sm font-medium text-foreground">{copy.value}</Text>
			{/if}
		</Stack>
	{/if}
</Block>

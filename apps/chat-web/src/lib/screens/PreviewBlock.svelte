<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Title from "../compose/Title.svelte";
	import Box from "../../ui/box/Box.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import { selectBlock, type PageBlock } from "../page-store";
	import PreviewItem from "./PreviewItem.svelte";

	let {
		block,
		selectedId
	}: {
		block: PageBlock;
		selectedId: string | null;
	} = $props();

	const selected = $derived(selectedId === block.id);
	const copy = $derived(block.copy);
	const children = $derived(block.children ?? []);
	const kind = $derived(block.kind);

	function onSelect() {
		selectBlock(block.id);
	}

	function onSelectChild(event: Event, id: string) {
		event.stopPropagation();
		selectBlock(id);
	}
</script>

<Block
	tag="article"
	class={cn(
		"rounded-default border bg-card px-4 py-4",
		selected ? "border-primary" : "border-border"
	)}
	aria-label={t("preview.selectBlock")}
	onclick={onSelect}
>
	<Stack class="gap-3">
		<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
			{kind}
		</Text>

		{#if kind === "nav"}
			<Group class="flex-wrap justify-between gap-3">
				<Title as={2} class="text-base font-semibold text-foreground">
					{copy?.brand ?? block.title}
				</Title>
				<Group class="flex-wrap gap-2">
					{#each children as child (child.id)}
						<Button
							class={cn(
								"rounded-default px-3 py-2 text-sm",
								selectedId === child.id
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:bg-accent/70"
							)}
							aria-pressed={selectedId === child.id ? "true" : "false"}
							onclick={(event: Event) => onSelectChild(event, child.id)}
						>
							<Text tag="span">{child.title}</Text>
						</Button>
					{/each}
				</Group>
			</Group>
		{:else if kind === "hero"}
			<Stack class="gap-2">
				{#if copy?.eyebrow}
					<Text tag="span" class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						{copy.eyebrow}
					</Text>
				{/if}
				<Title as={2} class="text-xl font-semibold text-foreground">
					{copy?.headline ?? block.title}
				</Title>
				{#if copy?.lede}
					<Text tag="p" class="text-sm text-muted-foreground">{copy.lede}</Text>
				{/if}
				{#if copy?.action}
					<Button
						class="inline-flex w-fit rounded-default bg-primary px-3 py-2 text-sm text-primary-foreground"
					>
						<Text tag="span">{copy.action}</Text>
					</Button>
				{/if}
			</Stack>
		{:else if kind === "pagehead"}
			<Stack class="gap-2">
				<Title as={1} class="text-xl font-semibold text-foreground">
					{copy?.headline ?? block.title}
				</Title>
				{#if copy?.lede}
					<Text tag="p" class="text-sm text-muted-foreground">{copy.lede}</Text>
				{/if}
			</Stack>
		{:else if kind === "overview" || kind === "metrics" || kind === "activity"}
			<Stack class="gap-2">
				<Title as={2} class="text-lg font-semibold text-foreground">{block.title}</Title>
				<Text tag="p" class="text-sm text-muted-foreground">{copy?.lede ?? block.summary}</Text>
			</Stack>
			{#if children.length > 0}
				<Stack class="gap-2">
					{#each children as child (child.id)}
						<PreviewItem block={child} {selectedId} />
					{/each}
				</Stack>
			{/if}
		{:else if kind === "chart"}
			<Stack class="gap-2">
				<Title as={2} class="text-lg font-semibold text-foreground">{block.title}</Title>
				<Box
					tag="div"
					class="flex min-h-32 items-center justify-center rounded-default border border-dashed border-border bg-muted px-4 py-8"
				>
					<Text tag="p" class="text-sm text-muted-foreground">{copy?.lede ?? block.summary}</Text>
				</Box>
			</Stack>
		{:else if kind === "features" || kind === "menu"}
			<Stack class="gap-2">
				<Title as={2} class="text-lg font-semibold text-foreground">{block.title}</Title>
				<Text tag="p" class="text-sm text-muted-foreground">{block.summary}</Text>
			</Stack>
			{#if children.length > 0}
				<Stack class="gap-2">
					{#each children as child (child.id)}
						<PreviewItem block={child} {selectedId} />
					{/each}
				</Stack>
			{/if}
		{:else if kind === "hours"}
			<Stack class="gap-2">
				<Title as={2} class="text-lg font-semibold text-foreground">{block.title}</Title>
				{#if copy?.days}
					<Text tag="p" class="text-sm text-foreground">{copy.days}</Text>
				{/if}
				{#if copy?.address}
					<Text tag="p" class="text-sm text-muted-foreground">{copy.address}</Text>
				{/if}
			</Stack>
		{:else if kind === "cta"}
			<Stack class="gap-2">
				<Title as={2} class="text-lg font-semibold text-foreground">{block.title}</Title>
				{#if copy?.lede}
					<Text tag="p" class="text-sm text-muted-foreground">{copy.lede}</Text>
				{/if}
				{#if copy?.action}
					<Button
						class="inline-flex w-fit rounded-default bg-primary px-3 py-2 text-sm text-primary-foreground"
					>
						<Text tag="span">{copy.action}</Text>
					</Button>
				{/if}
				{#if copy?.note}
					<Text tag="p" class="text-xs text-muted-foreground">{copy.note}</Text>
				{/if}
			</Stack>
		{:else if kind === "footer"}
			<Stack class="gap-1">
				{#if copy?.contact}
					<Text tag="p" class="text-sm text-foreground">{copy.contact}</Text>
				{/if}
				{#if copy?.legal}
					<Text tag="p" class="text-xs text-muted-foreground">{copy.legal}</Text>
				{/if}
			</Stack>
		{:else}
			<Stack class="gap-2">
				<Title as={2} class="text-base font-medium text-foreground">{block.title}</Title>
				<Text tag="p" class="text-sm text-muted-foreground">{block.summary}</Text>
			</Stack>
			{#if children.length > 0}
				<Stack class="gap-2">
					{#each children as child (child.id)}
						<PreviewItem block={child} {selectedId} />
					{/each}
				</Stack>
			{/if}
		{/if}
	</Stack>
</Block>

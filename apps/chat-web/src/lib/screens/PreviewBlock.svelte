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
	import CatalogBlockPreview from "./CatalogBlockPreview.svelte";
	import { organismFor } from "@buildytech/builder-core";
	import { barHeightClass, itemViewFor } from "../page-store/data-view";

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
	const view = $derived(itemViewFor(block.kind));
	// A block with a registry source renders its real UI8Kit organism; the rest falls back to the generic renderer.
	const organism = $derived(organismFor(block));

	function onSelect() {
		selectBlock(block.id);
	}

	function onSelectChild(event: Event, id: string) {
		event.stopPropagation();
		selectBlock(id);
	}

	// Sidenav collapses below the shell breakpoint; the toggle opens it as a sheet.
	let navOpen = $state(false);
	const linksId = $derived(`${block.id}-links`);

	function toggleNav(event: Event) {
		event.stopPropagation();
		navOpen = !navOpen;
	}

	function groupStart(index: number): string | null {
		const label = children[index]?.copy?.eyebrow;
		if (!label) return null;
		return children[index - 1]?.copy?.eyebrow === label ? null : label;
	}
</script>

{#if organism}
	<CatalogBlockPreview {block} {selectedId} render={organism} />
{:else}
<Block
	tag="article"
	class={cn(
		"rounded-default border bg-card px-4 py-4",
		selected ? "border-primary" : "border-border"
	)}
	aria-label={t("preview.selectBlock")}
	data-renderer="generic"
	onclick={onSelect}
>
	<Stack class="gap-3">
		<Group class="flex-wrap items-center gap-2">
			<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				{kind}
			</Text>
			<Text tag="span" class="text-xs text-muted-foreground" data-slot="renderer-label">{t("preview.genericRenderer")}</Text>
			{#if copy?.badge}
				<Text
					tag="span"
					class="rounded-full border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground"
					data-badge="demo"
				>
					{copy.badge}
				</Text>
			{/if}
		</Group>

		{#if kind === "sidenav"}
			<Group class="items-center justify-between gap-2" data-slot="sidenav-bar">
				<Title as={2} class="text-base font-semibold text-foreground">{copy?.brand ?? block.title}</Title>
				<Button
					class="rounded-default border border-border px-2 py-1 text-xs text-foreground hover:bg-accent @xl:hidden"
					aria-expanded={navOpen ? "true" : "false"}
					aria-controls={linksId}
					onclick={toggleNav}
				>
					<Text tag="span">{navOpen ? t("preview.sidenavClose") : t("preview.sidenavOpen")}</Text>
				</Button>
			</Group>
			<Box
				tag="nav"
				id={linksId}
				aria-label={block.title}
				class={cn("@xl:block", navOpen ? "block" : "hidden")}
				data-slot="sidenav-links"
			>
				<Stack tag="ul" class="gap-1">
					{#each children as child, index (child.id)}
						{#if groupStart(index)}
							<Box tag="li" class="px-2 pt-2" aria-hidden="true">
								<Text tag="span" class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
									{groupStart(index)}
								</Text>
							</Box>
						{/if}
						<Box tag="li">
							<Button
								class={cn(
									"w-full justify-start rounded-default px-2 py-2 text-left text-sm",
									index === 0 ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/70",
									selectedId === child.id ? "ring-1 ring-primary" : ""
								)}
								aria-current={index === 0 ? "page" : undefined}
								onclick={(event: Event) => onSelectChild(event, child.id)}
							>
								<Text tag="span">{child.title}</Text>
							</Button>
						</Box>
					{/each}
				</Stack>
			</Box>
		{:else if kind === "bottomnav"}
			<Box tag="nav" aria-label={block.title} data-slot="bottomnav-links">
				<Group tag="ul" class="justify-around gap-1">
					{#each children as child, index (child.id)}
						<Box tag="li" class="min-w-0 flex-1">
							<Button
								class={cn(
									"w-full justify-center truncate rounded-default px-2 py-2 text-xs",
									index === 0 ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/70",
									selectedId === child.id ? "ring-1 ring-primary" : ""
								)}
								aria-current={index === 0 ? "page" : undefined}
								onclick={(event: Event) => onSelectChild(event, child.id)}
							>
								<Text tag="span">{child.title}</Text>
							</Button>
						</Box>
					{/each}
				</Group>
			</Box>
		{:else if kind === "nav"}
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
		{:else if kind === "overview" || kind === "metrics"}
			<Stack class="gap-2">
				<Title as={2} class="text-lg font-semibold text-foreground">{block.title}</Title>
				{#if copy?.lede || children.length === 0}
					<Text tag="p" class="text-sm text-muted-foreground">{copy?.lede ?? block.summary}</Text>
				{/if}
			</Stack>
			{#if children.length > 0}
				<Box class="grid grid-cols-2 gap-2 lg:grid-cols-3">
					{#each children as child (child.id)}
						<PreviewItem block={child} {selectedId} {view} />
					{/each}
				</Box>
			{/if}
		{:else if kind === "activity"}
			<Stack class="gap-2">
				<Title as={2} class="text-lg font-semibold text-foreground">{block.title}</Title>
				{#if copy?.lede || children.length === 0}
					<Text tag="p" class="text-sm text-muted-foreground">{copy?.lede ?? block.summary}</Text>
				{/if}
			</Stack>
			{#if children.length > 0}
				<Stack class="gap-2">
					{#each children as child (child.id)}
						<PreviewItem block={child} {selectedId} {view} />
					{/each}
				</Stack>
			{/if}
		{:else if kind === "chart"}
			<Stack class="gap-2">
				<Title as={2} class="text-lg font-semibold text-foreground">{block.title}</Title>
				{#if children.length > 0}
					{#if copy?.lede}
						<Text tag="p" class="text-sm text-muted-foreground">{copy.lede}</Text>
					{/if}
					<Group class="min-h-32 items-end gap-2 overflow-x-auto rounded-default border border-border bg-muted px-2 py-2">
						{#each children as child (child.id)}
							<PreviewItem block={child} {selectedId} {view} barClass={barHeightClass(child, children)} />
						{/each}
					</Group>
				{:else}
					<Box
						tag="div"
						class="flex min-h-32 items-center justify-center rounded-default border border-dashed border-border bg-muted px-4 py-8"
					>
						<Text tag="p" class="text-sm text-muted-foreground">{copy?.lede ?? block.summary}</Text>
					</Box>
				{/if}
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
{/if}

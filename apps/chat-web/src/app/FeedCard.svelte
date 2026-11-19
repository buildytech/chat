<!--
  One Blocks feed card (ADR 0024, ADR 0059): a block variant drawn as its prototype in the page's skin, its title and
  variant label, and "+" that adds the real block to the page through the inspector gates (no model call). The card
  drags into the preview or the Sections list; "+" stays the keyboard path. A variant the page cannot take keeps "+"
  disabled with the reason.
-->
<script lang="ts">
	import { Plus } from "$lib/shell-icons";
	import Block from "$registry/compose/Block.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import type { CatalogCard } from "@buildytech/builder-core";
	import { inspector } from "$lib/inspector/inspector.svelte";
	import { FEED_DRAG_TYPE, feedDrag } from "$lib/feed/drag.svelte";
	import PrototypeThumb from "./PrototypeThumb.svelte";

	let { item, onAdd }: { item: CatalogCard; onAdd: (item: CatalogCard) => void } = $props();

	const fill = (key: string) => t(key).replace("{title}", item.title).replace("{variant}", item.label);
	const check = $derived(inspector.canAdd(item.item, item.variant));
	const canDrag = $derived(check.ok);
	const why = $derived(check.ok ? null : t(`feed.why.${check.code}`));

	function onDragStart(event: DragEvent) {
		if (!canDrag || !event.dataTransfer) {
			event.preventDefault();
			return;
		}
		event.dataTransfer.setData(FEED_DRAG_TYPE, item.id);
		event.dataTransfer.setData("text/plain", item.id);
		event.dataTransfer.effectAllowed = "copy";
		feedDrag.start(item);
	}
</script>

<Block
	tag="li"
	class={cn("flex min-w-0 flex-col overflow-hidden rounded border border-border bg-card", canDrag && "cursor-grab", feedDrag.item?.id === item.id && "opacity-60")}
	draggable={canDrag ? "true" : undefined}
	title={canDrag ? t("feed.dragHint") : undefined}
	ondragstart={onDragStart}
	ondragend={() => feedDrag.end()}
	data-slot="feed-card"
	data-id={item.id}
>
	<PrototypeThumb item={item.item} variant={item.variant} class="w-full border-b border-border" />
	<Stack align="stretch" class="min-w-0 flex-1 gap-1 p-2">
		<Group class="min-w-0 items-center justify-between gap-1">
			<Text tag="span" class="min-w-0 truncate text-xs font-medium text-foreground" title={item.title}>{item.title}</Text>
			<Button
				size="sm"
				layout="icon"
				variant="ghost"
				class="size-8 shrink-0 px-0"
				disabled={!check.ok}
				aria-label={fill("feed.add")}
				title={why ?? fill("feed.add")}
				data-action="feed-add"
				onclick={() => onAdd(item)}
			>
				<Plus />
			</Button>
		</Group>
		<Text tag="span" class="truncate text-xs text-muted-foreground" title={item.id}>{item.label}</Text>
		{#if item.isDefault}
			<Text tag="span" class="text-xs text-muted-foreground">{t("feed.default")}</Text>
		{/if}
		{#if why}
			<Text tag="span" class="text-xs text-muted-foreground" data-slot="feed-why">{why}</Text>
		{/if}
	</Stack>
</Block>

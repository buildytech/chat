<!--
  One Blocks feed result (ADR 0024): the Stock WebP thumbnail, title, spec / variant, a link to the codegen-x asset
  page and, for a block, "+" that adds it to the page through the inspector gates (no model call); for a screen,
  "Start page" that makes a fresh page from it (program assembly, no model call). Both column counts keep a
  full-width thumbnail on top; one column offers a larger preview. A block the page cannot take keeps "+" disabled with the reason.
  t150u: whether the card can be added, started or dragged is computed here, per card, from the item (stockSearch's
  supported flag) and the current page's hard rules; nothing is cached from the first result page.
-->
<script lang="ts">
import { ExternalLink, FilePlus, Plus } from "$lib/shell-icons";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Link from "$registry/kit/ui/link/Link.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import type { StockSearchItem } from "@buildytech/builder-core";
	import { inspector } from "$lib/inspector/inspector.svelte";
	import StockMediaCard from "./StockMediaCard.svelte";
	import { FEED_DRAG_TYPE, feedDrag } from "$lib/feed/drag.svelte";

	let {
		item,
		onAdd,
		onStart,
		starting = false
	}: {
		item: StockSearchItem;
		onAdd: (item: StockSearchItem) => void;
		onStart: (item: StockSearchItem) => void;
		starting?: boolean;
	} = $props();

	const fill = (key: string) => t(key).replace("{title}", item.title).replace("{variant}", item.variant);
	// A pure function of this item and the page (inspector.canAdd reads the page): the same on every result page.
	const check = $derived(item.type === "block" ? inspector.canAdd(item.spec, item.variant) : null);
	const canDrag = $derived(item.type === "block" ? check?.ok === true : item.supported);
	// A card drags into the preview or the Sections list (ADR 0024 step C; a screen brings its sections, t150u);
	// "+" / Start page stay the keyboard path.
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

	const why = $derived(check && !check.ok ? t(`feed.why.${check.code}`).replace("{role}", item.role ?? "") : null);
</script>

<StockMediaCard
	tag="li"
	thumb={item.thumb}
	thumbTitle={`${item.title} (${item.variant})`}
	layout="stack"
	class={cn(canDrag && "cursor-grab", feedDrag.item?.id === item.id && "opacity-60")}
	draggable={canDrag ? "true" : undefined}
	title={canDrag ? t(item.type === "block" ? "feed.dragHint" : "feed.dragScreenHint") : undefined}
	ondragstart={onDragStart}
	ondragend={() => feedDrag.end()}
	data-slot="feed-card"
	data-id={item.id}
	data-type={item.type}
>
	<Group class="min-w-0 items-center justify-between gap-1">
		<Text tag="span" class="min-w-0 truncate text-xs font-medium text-foreground" title={item.title}>{item.title}</Text>
		<Group class="shrink-0 items-center gap-1">
			<Link
				href={item.url}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
				aria-label={fill("feed.open")}
				title={fill("feed.open")}
				data-action="feed-open"
			>
				<Icon size="sm"><ExternalLink /></Icon>
			</Link>
			{#if item.type === "block"}
				<Button
					size="sm"
					layout="icon"
					variant="ghost"
					class="size-8 px-0"
					disabled={!check?.ok}
					aria-label={fill("feed.add")}
					title={why ?? fill("feed.add")}
					data-action="feed-add"
					onclick={() => onAdd(item)}
				>
					<Plus />
				</Button>
			{:else}
				<Button
					size="sm"
					layout="icon"
					variant="ghost"
					class="size-8 px-0"
					disabled={!item.supported || starting}
					aria-label={fill("feed.start")}
					title={item.supported ? fill("feed.start") : t("feed.why.screen_not_renderable")}
					data-action="feed-start"
					onclick={() => onStart(item)}
				>
					<FilePlus />
				</Button>
			{/if}
		</Group>
	</Group>
	<Text tag="span" class="truncate text-xs text-muted-foreground" title={item.id}>
		{item.variant}
	</Text>
	{#if item.type === "screen"}
		<Text tag="span" class="text-[11px] text-muted-foreground">{t("feed.screen")} · {item.subtitle}</Text>
		{#if !item.supported}
			<Text tag="span" class="text-[11px] text-muted-foreground" data-slot="feed-why">{t("feed.why.screen_not_renderable")}</Text>
		{/if}
	{:else if item.isDefault}
		<Text tag="span" class="text-[11px] text-muted-foreground">{t("feed.default")}</Text>
	{/if}
	{#if why && check && !check.ok && check.code !== "no_screen"}
		<Text tag="span" class="text-[11px] text-muted-foreground" data-slot="feed-why">{why}</Text>
	{/if}
</StockMediaCard>

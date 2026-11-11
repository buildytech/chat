<!--
  One Blocks feed result (ADR 0024): the Stock WebP thumbnail, title, spec / variant, a link to the codegen-x asset
  page and, for a block, "+" that adds it to the page through the inspector gates (no model call). One column: thumb
  left of the text; two columns: thumb on top. A block the page cannot take keeps "+" disabled with the reason.
-->
<script lang="ts">
	import ExternalLink from "@lucide/svelte/icons/external-link";
	import Plus from "@lucide/svelte/icons/plus";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Link from "$registry/kit/ui/link/Link.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import type { AddBlockCheck, StockSearchItem } from "@buildytech/builder-core";
	import StockThumb from "./StockThumb.svelte";

	let {
		item,
		columns,
		check,
		onAdd
	}: { item: StockSearchItem; columns: 1 | 2; check: AddBlockCheck | null; onAdd: (item: StockSearchItem) => void } = $props();

	const fill = (key: string) => t(key).replace("{title}", item.title).replace("{variant}", item.variant);
	const why = $derived(check && !check.ok ? t(`feed.why.${check.code}`).replace("{role}", item.role ?? "") : null);
</script>

<Box
	tag="li"
	class={cn("min-w-0 rounded border border-border bg-card p-2", columns === 1 ? "flex items-start gap-2" : "flex flex-col gap-2")}
	data-slot="feed-card"
	data-id={item.id}
	data-type={item.type}
>
	<StockThumb src={item.thumb} title={`${item.title} (${item.variant})`} class={columns === 1 ? "w-24" : "w-full"} />
	<Stack align="stretch" class="min-w-0 flex-1 gap-1">
		<Group class="min-w-0 items-start justify-between gap-1">
			<Text tag="span" class="min-w-0 truncate text-xs font-medium text-foreground" title={item.title}>{item.title}</Text>
			<Group class="shrink-0 items-center gap-1">
				<Link
					href={item.url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
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
						variant="outline"
						class="size-6 px-0"
						disabled={!check?.ok}
						aria-label={fill("feed.add")}
						title={why ?? fill("feed.add")}
						data-action="feed-add"
						onclick={() => onAdd(item)}
					>
						<Plus />
					</Button>
				{/if}
			</Group>
		</Group>
		<Text tag="span" class="truncate font-mono text-[11px] text-muted-foreground" title={item.id}>
			{item.spec}/{item.variant}
		</Text>
		{#if item.type === "screen"}
			<Text tag="span" class="text-[11px] text-muted-foreground">{t("feed.screen")} · {item.subtitle}</Text>
		{:else if item.isDefault}
			<Text tag="span" class="text-[11px] text-muted-foreground">{t("feed.default")}</Text>
		{/if}
		{#if why && check && !check.ok && check.code !== "no_page" && check.code !== "no_screen"}
			<Text tag="span" class="text-[11px] text-muted-foreground" data-slot="feed-why">{why}</Text>
		{/if}
	</Stack>
</Box>

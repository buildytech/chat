<!--
  Blocks feed (ADR 0024, Build left panel): search + facet filters over Stock blocks and screens through the shared
  stockSearch (stock-search/v1, the same function as the home Stock screens field), 8 cards per page in one or two
  columns (persisted; the page size does not change with the view), pagination, and "+" on a block card: an inspector
  add operation after the selected section or at the end, gated, one undo step, no model call.
-->
<script lang="ts">
	import Columns2 from "@lucide/svelte/icons/columns-2";
	import Rows3 from "@lucide/svelte/icons/rows-3";
	import ChevronLeft from "@lucide/svelte/icons/chevron-left";
	import ChevronRight from "@lucide/svelte/icons/chevron-right";
	import Block from "$registry/compose/Block.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Input from "$registry/kit/ui/input/Input.svelte";
	import Select from "$registry/compose/Select.svelte";
	import SelectOption from "$registry/compose/SelectOption.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { feed, type FeedFilters } from "$lib/feed/feed.svelte";
	import { inspector } from "$lib/inspector/inspector.svelte";
	import { canvas } from "$lib/inspector/canvas.svelte";
	import { getCurrentPage, getCurrentProvenance } from "$lib/page-store";
	import type { AddBlockCheck, StockSearchItem } from "@buildytech/builder-core";
	import FeedCard from "./FeedCard.svelte";

	const result = $derived(feed.result);
	const filters = $derived(feed.filters);
	let status = $state<{ ok: boolean; text: string } | null>(null);

	// The page the cards add to: read so the checks follow page and screen changes.
	const checks = $derived.by(() => {
		void getCurrentPage();
		void getCurrentProvenance();
		const out: Record<string, AddBlockCheck> = {};
		for (const item of result.items) if (item.type === "block") out[item.id] = inspector.canAdd(item.spec, item.variant);
		return out;
	});
	const pageNote = $derived.by(() => {
		const first = Object.values(checks)[0];
		return first && !first.ok && (first.code === "no_page" || first.code === "no_screen") ? t(`feed.why.${first.code}`) : null;
	});

	const facet = (name: "type" | "role" | "spec" | "site" | "variant") => result.facets[name];
	const label = (value: string, count: number) => `${value} (${count})`;
	const hasFilter = $derived(Boolean(feed.q || filters.role || filters.spec || filters.site || filters.variant || filters.type !== "block"));

	function pick(key: keyof FeedFilters) {
		return (event: Event) => feed.setFilter(key, ((event.currentTarget as HTMLSelectElement).value || null) as never);
	}

	function add(item: StockSearchItem) {
		const done = inspector.add(item.spec, item.variant);
		const name = (key: string) => t(key).replace("{title}", item.title).replace("{variant}", item.variant);
		if (done.ok) {
			canvas.requestReveal(done.blockId);
			status = { ok: true, text: name("feed.added") };
		} else status = { ok: false, text: t("feed.addFailed").replace("{message}", done.message) };
	}
</script>

<Block tag="section" class="flex min-h-0 flex-1 flex-col" aria-label={t("feed.region")} data-slot="blocks-feed">
	<Stack align="stretch" class="shrink-0 gap-2 border-b border-border p-2">
		<Input
			id="feed-search"
			type="search"
			value={feed.q}
			placeholder={t("feed.search")}
			aria-label={t("feed.search")}
			class="h-8 w-full rounded border border-input bg-card px-2 text-xs"
			oninput={(event: Event) => (feed.q = (event.currentTarget as HTMLInputElement).value)}
		/>
		<Box class="grid grid-cols-2 gap-2" role="group" aria-label={t("feed.filters")}>
			<Select size="sm" class="h-8 min-w-0 text-xs" value={filters.type ?? ""} aria-label={t("feed.type")} data-filter="type" onchange={pick("type")}>
				<SelectOption value="">{t("feed.typeAll")}</SelectOption>
				<SelectOption value="block">{t("feed.typeBlock")}</SelectOption>
				<SelectOption value="screen">{t("feed.typeScreen")}</SelectOption>
			</Select>
			<Select size="sm" class="h-8 min-w-0 text-xs" value={filters.role ?? ""} aria-label={t("feed.role")} data-filter="role" onchange={pick("role")}>
				<SelectOption value="">{t("feed.roleAll")}</SelectOption>
				{#each facet("role") as option (option.value)}
					<SelectOption value={option.value}>{label(option.value, option.count)}</SelectOption>
				{/each}
			</Select>
			<Select size="sm" class="h-8 min-w-0 text-xs" value={filters.spec ?? ""} aria-label={t("feed.spec")} data-filter="spec" onchange={pick("spec")}>
				<SelectOption value="">{t("feed.specAll")}</SelectOption>
				{#each facet("spec") as option (option.value)}
					<SelectOption value={option.value}>{label(option.value, option.count)}</SelectOption>
				{/each}
			</Select>
			<Select size="sm" class="h-8 min-w-0 text-xs" value={filters.site ?? ""} aria-label={t("feed.site")} data-filter="site" onchange={pick("site")}>
				<SelectOption value="">{t("feed.siteAll")}</SelectOption>
				{#each facet("site") as option (option.value)}
					<SelectOption value={option.value}>{label(option.value, option.count)}</SelectOption>
				{/each}
			</Select>
			{#if filters.spec}
				<Select size="sm" class="col-span-2 h-8 min-w-0 text-xs" value={filters.variant ?? ""} aria-label={t("feed.variant")} data-filter="variant" onchange={pick("variant")}>
					<SelectOption value="">{t("feed.variantAll")}</SelectOption>
					{#each facet("variant") as option (option.value)}
						<SelectOption value={option.value}>{label(option.value, option.count)}</SelectOption>
					{/each}
				</Select>
			{/if}
		</Box>
		<Group class="items-center justify-between gap-2">
			<Text tag="span" class="text-xs text-muted-foreground" data-slot="feed-total">{t("feed.results").replace("{n}", String(result.total))}</Text>
			<Group class="items-center gap-1">
				{#if hasFilter}
					<Button size="sm" variant="ghost" class="h-6 px-2 text-xs" data-action="feed-clear" onclick={() => feed.reset()}>
						<Text tag="span" class="text-xs">{t("feed.clear")}</Text>
					</Button>
				{/if}
				<Group class="gap-0 rounded border border-border" role="group" aria-label={t("feed.view")}>
					<Button size="sm" layout="icon" variant="ghost" class={cn("size-6 px-0", feed.columns === 1 && "bg-accent")} pressed={feed.columns === 1} aria-label={t("feed.oneColumn")} title={t("feed.oneColumn")} data-view="1" onclick={() => (feed.columns = 1)}>
						<Rows3 />
					</Button>
					<Button size="sm" layout="icon" variant="ghost" class={cn("size-6 px-0", feed.columns === 2 && "bg-accent")} pressed={feed.columns === 2} aria-label={t("feed.twoColumns")} title={t("feed.twoColumns")} data-view="2" onclick={() => (feed.columns = 2)}>
						<Columns2 />
					</Button>
				</Group>
			</Group>
		</Group>
		{#if pageNote}
			<Text tag="p" class="text-xs text-muted-foreground" data-slot="feed-page-note">{pageNote}</Text>
		{/if}
		<Text tag="p" class={cn("text-xs", status?.ok === false ? "text-destructive" : "text-muted-foreground", !status && "sr-only")} role="status" aria-live="polite" data-slot="feed-status">{status?.text ?? ""}</Text>
	</Stack>
	<Box class="min-h-0 flex-1 overflow-y-auto p-2">
		{#if result.total === 0}
			<Text tag="p" class="text-xs text-muted-foreground">{t("feed.empty")}</Text>
		{:else}
			<Box tag="ul" class={cn("grid gap-2", feed.columns === 2 ? "grid-cols-2" : "grid-cols-1")} aria-label={t("feed.list")} data-slot="feed-list" data-columns={feed.columns}>
				{#each result.items as item (item.id)}
					<FeedCard {item} columns={feed.columns} check={item.type === "block" ? (checks[item.id] ?? null) : null} onAdd={add} />
				{/each}
			</Box>
		{/if}
	</Box>
	{#if result.pageCount > 1}
		<Group tag="nav" class="shrink-0 items-center justify-between gap-2 border-t border-border p-2" aria-label={t("feed.pager")} data-slot="feed-pager">
			<Button size="sm" layout="icon" variant="outline" class="size-8 px-0" disabled={result.page <= 1} aria-label={t("feed.prev")} title={t("feed.prev")} data-action="feed-prev" onclick={() => (feed.page = result.page - 1)}>
				<ChevronLeft />
			</Button>
			<Text tag="span" class="text-xs text-muted-foreground" data-slot="feed-page">{t("feed.pageOf").replace("{page}", String(result.page)).replace("{pages}", String(result.pageCount))}</Text>
			<Button size="sm" layout="icon" variant="outline" class="size-8 px-0" disabled={result.page >= result.pageCount} aria-label={t("feed.next")} title={t("feed.next")} data-action="feed-next" onclick={() => (feed.page = result.page + 1)}>
				<ChevronRight />
			</Button>
		</Group>
	{/if}
</Block>

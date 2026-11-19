<!--
  Blocks feed (ADR 0024, ADR 0059; Build left panel): search and a category filter over the block variants of the
  catalog, each card drawn as its prototype in the page's skin, in one or two columns (persisted), and "+" on a card:
  an inspector add operation after the selected section or at the end, gated, one undo step, no model call.
-->
<script lang="ts">
	import { Columns2, Rows3 } from "$lib/shell-icons";
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
	import { feed } from "$lib/feed/feed.svelte";
	import { inspector } from "$lib/inspector/inspector.svelte";
	import { canvas } from "$lib/inspector/canvas.svelte";
	import type { CatalogCard } from "@buildytech/builder-core";
	import FeedCard from "./FeedCard.svelte";
	import { feedDrag } from "$lib/feed/drag.svelte";

	const result = $derived(feed.result);
	const hasFilter = $derived(Boolean(feed.q || feed.category));

	async function add(item: CatalogCard) {
		const done = await inspector.add(item.item, item.variant);
		if (done.ok) {
			canvas.requestReveal(done.blockId);
			feedDrag.status = { ok: true, text: t("feed.added").replace("{title}", item.title).replace("{variant}", item.label) };
		} else feedDrag.status = { ok: false, text: t("feed.addFailed").replace("{message}", done.message) };
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
		<Select
			size="sm"
			class="h-8 min-w-0 text-xs"
			value={feed.category ?? ""}
			aria-label={t("feed.category")}
			data-filter="category"
			onchange={(event: Event) => (feed.category = (event.currentTarget as HTMLSelectElement).value || null)}
		>
			<SelectOption value="">{t("feed.categoryAll")}</SelectOption>
			{#each result.categories as option (option.value)}
				<SelectOption value={option.value}>{`${option.value} (${option.count})`}</SelectOption>
			{/each}
		</Select>
		<Group class="items-center justify-between gap-2">
			<Text tag="span" class="text-xs text-muted-foreground" data-slot="feed-total"
				>{t("feed.results").replace("{n}", String(result.total))}</Text
			>
			<Group class="items-center gap-1">
				{#if hasFilter}
					<Button
						size="sm"
						variant="ghost"
						class="h-6 px-2 text-xs"
						data-action="feed-clear"
						onclick={() => feed.reset()}
					>
						<Text tag="span" class="text-xs">{t("feed.clear")}</Text>
					</Button>
				{/if}
				<Group class="gap-0 rounded border border-border" role="group" aria-label={t("feed.view")}>
					<Button
						size="sm"
						layout="icon"
						variant="ghost"
						class={cn("size-6 px-0", feed.columns === 1 && "bg-accent")}
						pressed={feed.columns === 1}
						aria-label={t("feed.oneColumn")}
						title={t("feed.oneColumn")}
						data-view="1"
						onclick={() => (feed.columns = 1)}
					>
						<Rows3 />
					</Button>
					<Button
						size="sm"
						layout="icon"
						variant="ghost"
						class={cn("size-6 px-0", feed.columns === 2 && "bg-accent")}
						pressed={feed.columns === 2}
						aria-label={t("feed.twoColumns")}
						title={t("feed.twoColumns")}
						data-view="2"
						onclick={() => (feed.columns = 2)}
					>
						<Columns2 />
					</Button>
				</Group>
			</Group>
		</Group>
		<Text
			tag="p"
			class={cn(
				"text-xs",
				feedDrag.status?.ok === false ? "text-destructive" : "text-muted-foreground",
				!feedDrag.status && "sr-only",
			)}
			role="status"
			aria-live="polite"
			data-slot="feed-status">{feedDrag.status?.text ?? ""}</Text
		>
	</Stack>
	<Box class="min-h-0 flex-1 overflow-y-auto p-2">
		{#if result.total === 0}
			<Text tag="p" class="text-xs text-muted-foreground">{t("feed.empty")}</Text>
		{:else}
			<Box
				tag="ul"
				class={cn("grid gap-2", feed.columns === 2 ? "grid-cols-2" : "grid-cols-1")}
				aria-label={t("feed.list")}
				data-slot="feed-list"
				data-columns={feed.columns}
			>
				{#each result.items as item (item.id)}
					<FeedCard {item} onAdd={add} />
				{/each}
			</Box>
		{/if}
	</Box>
</Block>

<script lang="ts">
	import LayoutList from "@lucide/svelte/icons/layout-list";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import {
		blocksOf,
		getCurrentPage,
		getSelectedBlockId,
		selectBlock,
		type PageBlock
	} from "../page-store";

	const page = $derived(getCurrentPage());
	const blocks = $derived(page ? blocksOf(page) : []);
	const selectedId = $derived(getSelectedBlockId());

	const depthPad = ["pl-3", "pl-6", "pl-8"] as const;

	function padClass(depth: number): string {
		return depthPad[Math.min(Math.max(depth, 0), depthPad.length - 1)] ?? "pl-8";
	}
</script>

<Block
	tag="aside"
	class="max-h-32 shrink-0 overflow-y-auto border-b border-border bg-card p-3 lg:max-h-none lg:h-full lg:w-56 lg:border-b-0 lg:border-r"
	aria-label={t("workspace.blockTree")}
>
	<Stack class="gap-2">
		<Group class="gap-2">
			<Icon size="sm"><LayoutList /></Icon>
			<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				{t("workspace.blockTree")}
			</Text>
		</Group>
		{#if blocks.length === 0}
			<Text tag="p" class="text-sm text-muted-foreground">{t("workspace.empty")}</Text>
		{:else}
			{#snippet treeList(items: PageBlock[], depth: number)}
				{#each items as block (block.id)}
					<Stack tag="li" class="gap-1">
						<Button
							class={cn(
								"w-full justify-start rounded-default py-2 pr-3 text-left",
								padClass(depth),
								selectedId === block.id
									? "bg-accent text-accent-foreground"
									: "text-foreground hover:bg-accent/70"
							)}
							aria-pressed={selectedId === block.id ? "true" : "false"}
							aria-label={block.title}
							onclick={() => selectBlock(block.id)}
						>
							<Stack class="min-w-0 gap-1">
								<Text tag="span" class="truncate text-sm font-medium">{block.title}</Text>
								<Text tag="span" class="truncate text-xs text-muted-foreground">{block.kind}</Text>
							</Stack>
						</Button>
						{#if block.children && block.children.length > 0}
							<Stack tag="ul" class="gap-1">
								{@render treeList(block.children, depth + 1)}
							</Stack>
						{/if}
					</Stack>
				{/each}
			{/snippet}
			<Stack tag="ul" class="gap-1">
				{@render treeList(blocks, 0)}
			</Stack>
		{/if}
	</Stack>
</Block>

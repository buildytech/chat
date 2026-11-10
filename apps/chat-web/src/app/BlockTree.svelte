<script lang="ts">
	import Block from "$registry/compose/Block.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { canvas } from "$lib/inspector/canvas.svelte";
	import {
		blocksOf,
		getCurrentPage,
		getSelectedBlockId,
		selectBlock,
		type PageBlock
	} from "$lib/page-store";

	const page = $derived(getCurrentPage());
	const blocks = $derived(page ? blocksOf(page) : []);
	const selectedId = $derived(getSelectedBlockId());

	const depthPad = ["pl-2", "pl-4", "pl-6", "pl-8"] as const;

	function padClass(depth: number): string {
		return depthPad[Math.min(Math.max(depth, 0), depthPad.length - 1)] ?? "pl-8";
	}

	// Picking a section in the tree selects it and brings it into view in the canvas.
	function pick(id: string) {
		selectBlock(id);
		canvas.requestReveal(id);
	}
</script>

<Block
	tag="nav"
	class="p-2"
	data-slot="block-tree"
	aria-label={t("workspace.blockTree")}
>
	{#if blocks.length === 0}
		<Text tag="p" class="px-2 text-xs text-muted-foreground">{t("workspace.empty")}</Text>
	{:else}
		{#snippet treeList(items: PageBlock[], depth: number)}
			{#each items as block (block.id)}
				<Stack align="stretch" tag="li" gap="0">
					<Button
						class={cn(
							"flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded pr-2 text-left text-xs",
							padClass(depth),
							selectedId === block.id
								? "bg-accent text-accent-foreground"
								: "text-foreground hover:bg-accent/70"
						)}
						pressed={selectedId === block.id}
						aria-label={block.title}
						title={`${block.title} · ${block.kind}`}
						onclick={() => pick(block.id)}
						onpointerenter={() => canvas.hover(block.id)}
						onpointerleave={() => canvas.hover(null)}
					>
						<Text tag="span" class="truncate text-xs font-medium">{block.title}</Text>
						<Text tag="span" class="shrink-0 text-xs text-muted-foreground">{block.kind}</Text>
					</Button>
					{#if block.children && block.children.length > 0}
						<Stack align="stretch" tag="ul" gap="0">
							{@render treeList(block.children, depth + 1)}
						</Stack>
					{/if}
				</Stack>
			{/each}
		{/snippet}
		<Stack align="stretch" tag="ul" gap="0">
			{@render treeList(blocks, 0)}
		</Stack>
	{/if}
</Block>

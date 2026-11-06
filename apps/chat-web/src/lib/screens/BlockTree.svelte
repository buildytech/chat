<script lang="ts">
	import LayoutList from "@lucide/svelte/icons/layout-list";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import type { PageBlock } from "../page-store";

	let { blocks }: { blocks: PageBlock[] } = $props();
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
			<Stack tag="ul" class="gap-1">
				{#each blocks as block (block.id)}
					<Group tag="li" class="rounded-default bg-background px-3 py-2">
						<Stack class="min-w-0 gap-1">
							<Text tag="span" class="truncate text-sm font-medium text-foreground">{block.title}</Text>
							<Text tag="span" class="truncate text-xs text-muted-foreground">{block.kind}</Text>
						</Stack>
					</Group>
				{/each}
			</Stack>
		{/if}
	</Stack>
</Block>

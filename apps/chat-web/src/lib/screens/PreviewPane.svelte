<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Stack from "../compose/Stack.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { blocksOf, getCurrentPage, getSelectedBlockId } from "../page-store";
	import PreviewBlock from "./PreviewBlock.svelte";

	const page = $derived(getCurrentPage());
	const blocks = $derived(blocksOf(page));
	const selectedId = $derived(getSelectedBlockId());
</script>

<Block
	tag="section"
	class="min-h-0 min-w-0 flex-1 overflow-y-auto bg-background p-4"
	aria-label={t("workspace.preview")}
>
	<Stack class="gap-3">
		<Text tag="p" class="text-xs text-muted-foreground">{t("preview.runtime")}</Text>
		{#if blocks.length === 0}
			<Text tag="p" class="text-sm text-muted-foreground">{t("workspace.empty")}</Text>
		{:else}
			{#each blocks as block (block.id)}
				<PreviewBlock {block} {selectedId} />
			{/each}
		{/if}
	</Stack>
</Block>

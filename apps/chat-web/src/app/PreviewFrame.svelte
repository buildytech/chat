<!--
  The page blocks inside the preview iframe, in page order. Mounted by PreviewPane into the iframe document, in the
  same JavaScript realm: page store, selection and targeted edits are shared with the chat; the layout of each block
  is its registry block's own, and the frame's CSS (breakpoints, kit theme) belongs to the iframe.
-->
<script lang="ts">
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { blocksOf, getCurrentPage, getSelectedBlockId } from "$lib/page-store";
	import PreviewBlock from "./PreviewBlock.svelte";

	let { frame }: { frame: { reload: number } } = $props();

	const page = $derived(getCurrentPage());
	const blocks = $derived(page ? blocksOf(page) : []);
	const selectedId = $derived(getSelectedBlockId());
</script>

<Box class="min-h-screen bg-background text-foreground" data-slot="preview-frame">
	{#key frame.reload}
		{#if blocks.length === 0}
			<Text tag="p" class="p-4 text-sm text-muted-foreground">{t("workspace.empty")}</Text>
		{:else}
			{#each blocks as block (block.id)}
				<PreviewBlock {block} {selectedId} />
			{/each}
		{/if}
	{/key}
</Box>

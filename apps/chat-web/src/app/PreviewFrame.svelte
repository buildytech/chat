<!--
  The page blocks inside the preview iframe, in page order. Mounted by PreviewPane into the iframe document, in the
  same JavaScript realm: page store, selection and targeted edits are shared with the chat; the layout of each block
  is its registry block's own, and the frame's CSS (breakpoints, kit theme) belongs to the iframe.
-->
<script lang="ts">
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { blocksOf, getCurrentPage } from "$lib/page-store";
	import PreviewBlock from "./PreviewBlock.svelte";
	import { previewSettings } from "$lib/browser/preview-settings.svelte";

	let { frame }: { frame: { reload: number } } = $props();

	const page = $derived(getCurrentPage());
	const blocks = $derived(page ? blocksOf(page) : []);
</script>

<Box class="min-h-screen bg-background text-foreground" data-slot="preview-frame">
	{#key frame.reload}
		{#if blocks.length === 0}
			<!-- Empty page (or none yet): the drop zone. Drag events land on the host drop layer over the frame; "+" adds too. -->
			<Box class="p-4" data-slot="preview-empty">
				<Box
					class="flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center"
					data-slot="preview-empty-drop"
				>
					<Text tag="p" class="text-base font-semibold text-foreground">{t("preview.emptyDrop")}</Text>
					<Text tag="p" class="max-w-md text-sm text-muted-foreground">{t("preview.emptyHint")}</Text>
				</Box>
			</Box>
		{:else}
			{#each blocks as block (block.id)}
				<PreviewBlock {block} clean={previewSettings.hideServiceLabels} />
			{/each}
		{/if}
	{/key}
</Box>

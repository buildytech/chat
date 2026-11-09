<!--
  The page blocks inside the preview iframe. Mounted by PreviewPane into the iframe document, in the same
  JavaScript realm: page store, selection and targeted edits are shared with the chat; only layout and CSS
  (breakpoints, kit theme) belong to the frame.
-->
<script lang="ts">
	import Box from "../../ui/box/Box.svelte";
	import Stack from "../compose/Stack.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { blocksOf, getCurrentPage, getSelectedBlockId } from "../page-store";
	import PreviewBlock from "./PreviewBlock.svelte";

	let { frame }: { frame: { reload: number } } = $props();

	const page = $derived(getCurrentPage());
	const blocks = $derived(page ? blocksOf(page) : []);
	// App shell (Dashboard): sidenav column + main; bottomnav only in narrow (mobile) frames.
	const sidenav = $derived(blocks.find((block) => block.kind === "sidenav") ?? null);
	const bottomnav = $derived(blocks.find((block) => block.kind === "bottomnav") ?? null);
	const mainBlocks = $derived(blocks.filter((block) => block.kind !== "sidenav" && block.kind !== "bottomnav"));
	const selectedId = $derived(getSelectedBlockId());
</script>

<Box class="min-h-screen bg-background p-4 text-foreground" data-slot="preview-frame">
	{#key frame.reload}
		<Stack class="gap-3">
			{#if blocks.length === 0}
				<Text tag="p" class="text-sm text-muted-foreground">{t("workspace.empty")}</Text>
			{:else if sidenav || bottomnav}
				<Box class="@container" data-slot="app-shell">
					<Box class="grid gap-3 @xl:grid-cols-[13rem_minmax(0,1fr)]">
						{#if sidenav}
							<PreviewBlock block={sidenav} {selectedId} />
						{/if}
						<Stack class="min-w-0 gap-3" data-slot="app-main" aria-label={t("preview.appMain")}>
							{#each mainBlocks as block (block.id)}
								<PreviewBlock {block} {selectedId} />
							{/each}
						</Stack>
					</Box>
					{#if bottomnav}
						<Box class="mt-3 @xl:hidden" data-slot="app-bottomnav">
							<PreviewBlock block={bottomnav} {selectedId} />
						</Box>
					{/if}
				</Box>
			{:else}
				{#each blocks as block (block.id)}
					<PreviewBlock {block} {selectedId} />
				{/each}
			{/if}
		</Stack>
	{/key}
</Box>

<script lang="ts">
	// The candidates of one picture slot: a grid of thumbnails; clicking one puts it on the page (the block's `image`).
	import Button from "$registry/compose/Button.svelte";
	import Grid from "$registry/compose/Grid.svelte";
	import Image from "$registry/compose/Image.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { pickCandidate } from "../media/media.svelte.ts";

	let { blockId, candidates, current, alt }: { blockId: string; candidates: readonly string[]; current: string; alt: string } = $props();
</script>

<Grid class="grid-cols-3 gap-1" data-slot="media-candidates">
	{#each candidates as url, index (url)}
		<Button
			type="button"
			variant="ghost"
			class={cn("h-auto rounded p-0", url === current ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100")}
			pressed={url === current}
			aria-label={t("media.pick").replace("{n}", String(index + 1))}
			data-action="media-pick"
			onclick={() => pickCandidate(blockId, url)}
		>
			<Image src={url} {alt} loading="lazy" class="aspect-square w-full rounded object-cover" />
		</Button>
	{/each}
</Grid>

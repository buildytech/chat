<!--
  A Stock thumbnail (WebP, 16:10, served by app.codegen-x.com/thumbs/): lazy, top-aligned, and a muted placeholder of the same
  size when the asset has no picture or it fails to load. Decorative next to a visible title unless `alt` says more.
  `bleed`: edge-to-edge media of a card (no own radius or frame; the card clips it, a divider class may be passed).
-->
<script lang="ts">
	import ImageOff from "@lucide/svelte/icons/image-off";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Image from "$registry/compose/Image.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";

	let { src, title, bleed = false, class: className }: { src: string | null; title: string; bleed?: boolean; class?: string } = $props();

	let failed = $state<string | null>(null);
	const shown = $derived(src && failed !== src ? src : null);
</script>

<Box
	class={cn("aspect-16/10 shrink-0 overflow-hidden bg-muted", bleed ? "border-border" : "rounded border border-border", className)}
	data-slot="stock-thumb"
	data-bleed={bleed ? "true" : undefined}
>
	{#if shown}
		<Image
			src={shown}
			alt={t("thumb.alt").replace("{title}", title)}
			loading="lazy"
			decoding="async"
			width="640"
			height="400"
			fit="cover"
			position="top"
			class="h-full w-full"
			onerror={() => (failed = shown)}
		/>
	{:else}
		<Box class="flex h-full w-full items-center justify-center text-muted-foreground">
			<Icon size="sm" label={t("thumb.missing")}><ImageOff /></Icon>
		</Box>
	{/if}
</Box>

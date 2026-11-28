<!--
  A block variant drawn as its prototype (ADR 0059): the wireframe from ui8kit/prototypes (rectangles only), rendered at
  the page width and scaled to the card, in the page's skin (lib/feed/page-skin), isolated from the app's own skin.
  Decorative next to a visible title; inert, so it takes no focus and no pointer.
-->
<script lang="ts">
	import type { Component } from "svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import { catalogBlock, prototypeProps } from "@buildytech/builder-core";
	import { cn } from "$registry/utils/cn";
	import { pageSkinScope, syncPageSkinStyle } from "$lib/feed/page-skin.svelte";

	let { item, variant, class: className }: { item: string; variant: string; class?: string } = $props();

	const PROTOTYPES = import.meta.glob<Component<Record<string, unknown>>>("../../../../prototypes/svelte/blocks/*.svelte", { import: "default", eager: true });
	/** The width the prototype is laid out at: its md / lg breakpoints follow the viewport (a desktop here), so the layout stays the
	    desktop one; 720 rather than the 1280 page keeps the 8px text bars about 1.5px thick in a 2-column card instead of under 1px. */
	const PAGE_WIDTH = 720;

	const file = $derived(catalogBlock(item)?.prototype ?? "");
	const Prototype = $derived(Object.entries(PROTOTYPES).find(([path]) => path.endsWith(`/${file}`))?.[1] ?? null);
	const settings = $derived(prototypeProps(item, variant));
	const scope = $derived(pageSkinScope());
	$effect(() => syncPageSkinStyle(scope.source));

	let width = $state(0);
	let height = $state(0);
	const scale = $derived(width ? width / PAGE_WIDTH : 0);

	/** Track one size of the element (ResizeObserver): the card's width, the prototype's height. */
	function measure(set: (rect: DOMRectReadOnly) => void) {
		return (node: Element) => {
			const observer = new ResizeObserver(([entry]) => entry && set(entry.contentRect));
			observer.observe(node);
			return () => observer.disconnect();
		};
	}
</script>

<Box
	class={cn("relative shrink-0 overflow-hidden bg-muted", className)}
	style={`height: ${Math.ceil(height * scale)}px`}
	data-slot="prototype-thumb"
	data-item={item}
	data-variant={variant}
	{@attach measure((rect) => (width = rect.width))}
>
	{#if Prototype}
		<Box
			{...scope.attrs}
			class="pointer-events-none absolute top-0 left-0 origin-top-left"
			style={`width: ${PAGE_WIDTH}px; transform: scale(${scale}); ${scope.style}`}
			aria-hidden="true"
			inert
			{@attach measure((rect) => (height = rect.height))}
		>
			<Prototype {...settings} />
		</Box>
	{/if}
</Box>

<!--
  The Stock card frame shared by the Blocks feed and the home Stock screens (ADR 0024): the WebP thumbnail is
  full-bleed (no padding around it; the card radius clips it), on top in the stacked layout or on the left edge in
  the row layout, and the body (title row with actions, id, notes) sits in an 8px padded column. Root attributes
  (tag, drag handlers, data-*) pass through.
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import { cn } from "$registry/utils/cn";
	import StockThumb from "./StockThumb.svelte";

	let {
		thumb,
		thumbTitle,
		layout = "stack",
		selected = false,
		class: className,
		children,
		...rest
	}: {
		thumb: string | null;
		thumbTitle: string;
		layout?: "stack" | "row";
		selected?: boolean;
		class?: string;
		children: Snippet;
		[key: string]: unknown;
	} = $props();
</script>

<Box
	{...rest}
	class={cn(
		"min-w-0 overflow-hidden rounded border bg-card",
		selected ? "border-primary" : "border-border",
		layout === "row" ? "flex items-stretch" : "flex flex-col",
		className
	)}
>
	<StockThumb src={thumb} title={thumbTitle} bleed class={layout === "row" ? "w-24 self-start border-r" : "w-full border-b"} />
	<Stack align="stretch" class="min-w-0 flex-1 gap-1 p-2">
		{@render children()}
	</Stack>
</Box>

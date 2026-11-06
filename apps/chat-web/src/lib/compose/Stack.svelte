<script lang="ts">
	import type { Snippet } from "svelte";
	import Box from "../../ui/box/Box.svelte";
	import { cn } from "../../utils/cn";
	import type { BoxTag } from "../../utils/tags";

	let {
		tag = "div",
		class: className,
		children,
		...rest
	}: {
		tag?: BoxTag;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();
</script>

<Box {tag} class={cn("flex flex-col", className)} {...rest}>
	{@render children?.()}
</Box>

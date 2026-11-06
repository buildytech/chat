<script lang="ts">
	import type { Snippet } from "svelte";
	import Text from "../../ui/text/Text.svelte";
	import type { TextTag } from "../../utils/tags";

	let {
		as = 1,
		class: className,
		children,
		...rest
	}: {
		as?: 1 | 2 | 3 | 4 | 5 | 6;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const tag = $derived(`h${as}` as TextTag);
</script>

<Text {tag} class={className} {...rest}>
	{@render children?.()}
</Text>

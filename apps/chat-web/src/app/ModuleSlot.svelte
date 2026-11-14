<script lang="ts" generics="N extends SlotName">
	// Renders what the loaded modules put in a core slot; nothing when none does (the core without a module).
	import { slotComponents } from "$lib/modules/registry.svelte";
	import type { SlotName, SlotProps } from "$lib/modules/types";

	let { name, props }: { name: N; props: SlotProps[N] } = $props();
	const items = $derived(slotComponents(name));
</script>

{#each items as Item, index (index)}
	<Item {...props} />
{/each}

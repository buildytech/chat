<script lang="ts">
	// Inspector section of the selected block in Media mode (t109u): one card per picture slot of the block.
	import Stack from "$registry/compose/Stack.svelte";
	import { getComposerMode, pageSlots } from "../media/media.svelte.ts";
	import MediaSlotCard from "./MediaSlotCard.svelte";

	let { blockId }: { blockId: string } = $props();

	const slots = $derived(getComposerMode() === "media" ? pageSlots().filter((s) => s.blockId === blockId) : []);
</script>

{#if slots.length}
	<Stack align="stretch" gap="2" data-slot="media-block">
		{#each slots as slot (slot.key)}<MediaSlotCard {slot} />{/each}
	</Stack>
{/if}

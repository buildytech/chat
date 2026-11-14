<script lang="ts">
	// Slot block.actions: add the block to (or remove it from) the chat's scope for the next message.
	import Button from "$registry/kit/ui/button/Button.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { blockScope } from "../core/block-scope.svelte.ts";
	import { getSelectedSession } from "../core";

	let { blockId }: { blockId: string } = $props();
	const inScope = $derived(blockScope.ids(getSelectedSession()?.id).includes(blockId));

	function toggle(event: MouseEvent) {
		event.stopPropagation();
		const session = getSelectedSession();
		if (session) blockScope.toggle(session.id, blockId);
	}
</script>

<Button size="sm" variant="ghost" pressed={inScope} onclick={toggle}>
	{t(inScope ? "scope.remove" : "scope.add")}
</Button>

<script lang="ts">
	// The thread area in Media mode (t109u): the page art direction and every picture slot of the page with its status.
	// The composer below sends a new art direction and draws the whole page; one slot is drawn from its row or the Inspector.
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Image from "$registry/compose/Image.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Text from "$registry/compose/Text.svelte";
	import Textarea from "$registry/compose/Textarea.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { valueOf } from "$lib/inspector/fields";
	import { selectBlock } from "$lib/page-store";
	import { generatePage, generateSlot, isRunning, mediaCostUsd, mediaStyle, pageSlots, setMediaStyle, slotRecord } from "../media/media.svelte.ts";
	import { staleReason } from "../media/slots.ts";

	const slots = $derived(pageSlots());
	const cost = $derived(mediaCostUsd());
	const anyBusy = $derived(slots.some((s) => isRunning(s.blockId)));
</script>

<Stack align="stretch" class="min-h-0 flex-1 gap-4 overflow-y-auto p-4" data-slot="media-panel">
	<Stack align="stretch" gap="2">
		<Text tag="h2" class="text-sm font-medium">{t("media.styleTitle")}</Text>
		<Textarea size="sm" rows="4" aria-label={t("media.styleTitle")} value={mediaStyle()} data-slot="media-style" onchange={(event: Event) => setMediaStyle(valueOf(event))} />
		<Text tag="p" class="text-xs text-muted-foreground">{t("media.styleHint")}</Text>
	</Stack>
	<Group class="items-center justify-between gap-2">
		<Text tag="span" class="text-xs text-muted-foreground">{t("media.count").replace("{n}", String(slots.length))}{cost !== null ? ` · $${cost.toFixed(2)}` : ""}</Text>
		<Button size="sm" disabled={!slots.length || anyBusy} data-action="media-generate-page" onclick={() => void generatePage()}>{anyBusy ? t("media.drawing") : t("media.generatePage")}</Button>
	</Group>
	{#if !slots.length}<Text tag="p" class="text-xs text-muted-foreground">{t("media.none")}</Text>{/if}
	{#each slots as slot (slot.blockId)}
		{@const record = slotRecord(slot.blockId)}
		{@const stale = staleReason(slot, record)}
		<Group class="items-start gap-2 rounded border border-border p-2" data-slot="media-slot" data-block={slot.blockId}>
			{#if slot.image}<Image src={slot.image} alt={slot.alt || slot.title} class="size-16 shrink-0 rounded object-cover" />{/if}
			<Stack align="stretch" gap="1" class="min-w-0 flex-1">
				<Button variant="link" size="sm" class="h-auto justify-start p-0 text-xs" onclick={() => selectBlock(slot.blockId)}>{slot.item} · {slot.aspect}</Button>
				<Text tag="p" class="text-xs text-muted-foreground">{slot.alt || t("media.noAlt")}</Text>
				{#if stale}<Text tag="p" class="text-xs text-destructive">{t(`media.stale.${stale}`)}</Text>{/if}
			</Stack>
			<Button size="sm" variant="outline" disabled={isRunning(slot.blockId)} onclick={() => void generateSlot(slot.blockId)}>{isRunning(slot.blockId) ? t("media.drawing") : record?.candidates.length ? t("media.regenerate") : t("media.generate")}</Button>
		</Group>
	{/each}
</Stack>

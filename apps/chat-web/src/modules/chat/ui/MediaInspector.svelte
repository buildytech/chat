<script lang="ts">
	// Inspector section of a picture slot (Media mode, t109u): the description the picture is drawn from (imageAlt), the frame
	// from the variant, an optional extra for this picture, the candidates and Generate / Regenerate. Only blocks with a slot.
	import Alert from "$registry/compose/Alert.svelte";
	import Badge from "$registry/compose/Badge.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Text from "$registry/compose/Text.svelte";
	import Textarea from "$registry/compose/Textarea.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { valueOf } from "$lib/inspector/fields";
	import { generateSlot, getComposerMode, isRunning, pageSlots, setSlotExtra, slotError, slotRecord } from "../media/media.svelte.ts";
	import { staleReason } from "../media/slots.ts";
	import MediaCandidates from "./MediaCandidates.svelte";

	let { blockId }: { blockId: string } = $props();

	const slot = $derived(pageSlots().find((s) => s.blockId === blockId) ?? null);
	const record = $derived(slotRecord(blockId));
	const stale = $derived(slot ? staleReason(slot, record) : null);
	const busy = $derived(isRunning(blockId));
	const error = $derived(slotError(blockId));
</script>

{#if slot && getComposerMode() === "media"}
	<Stack align="stretch" gap="2" class="rounded border border-border p-2" data-slot="media-inspector" data-aspect={slot.aspect}>
		<Group class="items-center justify-between gap-2">
			<Text tag="span" class="text-xs font-medium">{t("media.slot")}</Text>
			<Badge variant="outline">{slot.aspect}</Badge>
		</Group>
		<Text tag="p" class="text-xs text-muted-foreground" data-slot="media-alt">{slot.alt || t("media.noAlt")}</Text>
		<Textarea
			size="sm"
			rows="2"
			aria-label={t("media.extra")}
			placeholder={t("media.extra")}
			value={record?.extra ?? ""}
			onchange={(event: Event) => setSlotExtra(blockId, valueOf(event))}
		/>
		{#if stale}<Alert variant="warning" data-slot="media-stale">{t(`media.stale.${stale}`)}</Alert>{/if}
		{#if error}<Alert variant="destructive" role="alert">{error}</Alert>{/if}
		{#if record?.candidates.length}
			<MediaCandidates {blockId} candidates={record.candidates} current={slot.image} alt={slot.alt || slot.title} />
		{/if}
		<Button size="sm" variant={record?.candidates.length ? "outline" : "default"} disabled={busy} data-action="media-generate" onclick={() => void generateSlot(blockId)}>
			{busy ? t("media.drawing") : record?.candidates.length ? t("media.regenerate") : t("media.generate")}
		</Button>
	</Stack>
{/if}

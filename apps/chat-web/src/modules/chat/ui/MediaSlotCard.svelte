<script lang="ts">
	// One picture slot in the Inspector (Media mode, t109u): the description it is drawn from (imageAlt, or the record's title
	// and description), the frame of the variant, an optional extra, the candidates and Draw / Redraw.
	import Alert from "$registry/compose/Alert.svelte";
	import Badge from "$registry/compose/Badge.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Text from "$registry/compose/Text.svelte";
	import Textarea from "$registry/compose/Textarea.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { valueOf } from "$lib/inspector/fields";
	import { generateSlot, isRunning, setSlotExtra, slotError, slotRecord } from "../media/media.svelte.ts";
	import { staleReason, type ImageSlot } from "../media/slots.ts";
	import MediaCandidates from "./MediaCandidates.svelte";

	let { slot }: { slot: ImageSlot } = $props();

	const record = $derived(slotRecord(slot.key));
	const stale = $derived(staleReason(slot, record));
	const busy = $derived(isRunning(slot.key));
	const error = $derived(slotError(slot.key));
	const drawn = $derived(Boolean(record?.candidates.length));
</script>

<Stack align="stretch" gap="2" class="rounded border border-border p-2" data-slot="media-inspector" data-key={slot.key} data-aspect={slot.aspect}>
	<Group class="items-center justify-between gap-2">
		<Text tag="span" class="text-xs font-medium">{slot.key === slot.blockId ? t("media.slot") : slot.title}</Text>
		<Badge variant="outline">{slot.aspect}</Badge>
	</Group>
	<Text tag="p" class="text-xs text-muted-foreground" data-slot="media-alt">{slot.alt || t("media.noAlt")}</Text>
	<Textarea size="sm" rows="2" aria-label={t("media.extra")} placeholder={t("media.extra")} value={record?.extra ?? ""} onchange={(event: Event) => setSlotExtra(slot.key, valueOf(event))} />
	{#if stale}<Alert variant="warning" data-slot="media-stale">{t(`media.stale.${stale}`)}</Alert>{/if}
	{#if error}<Alert variant="destructive" role="alert">{error}</Alert>{/if}
	{#if record && drawn}<MediaCandidates slotKey={slot.key} candidates={record.candidates} current={slot.image} alt={slot.alt || slot.title} />{/if}
	<Button size="sm" variant={drawn ? "outline" : "default"} disabled={busy} data-action="media-generate" onclick={() => void generateSlot(slot.key)}>
		{busy ? t("media.drawing") : drawn ? t("media.regenerate") : t("media.generate")}
	</Button>
</Stack>

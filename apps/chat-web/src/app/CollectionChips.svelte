<!--
  The selected chat's Stock collection (session 1.3.0 `collection`; ui8kit/contract docs/collection-intake.md): present
  items as removable chips above the composer (Build uses only these blocks) and one note for the skipped ones.
-->
<script lang="ts">
	import Layers from "@lucide/svelte/icons/layers";
	import X from "@lucide/svelte/icons/x";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { collectionItemDetail, collectionItemName, collectionNote, getChatCollection, removeCollectionItem } from "$lib/chat-core";

	const collection = $derived(getChatCollection());
	const note = $derived(collection ? collectionNote(collection) : "");
</script>

{#if collection && (collection.items.length || note)}
	<Stack align="stretch" class="gap-2" data-slot="collection" aria-label={t("collection.chips")}>
		<Group class="items-center gap-2">
			<Icon size="sm" class="text-muted-foreground"><Layers /></Icon>
			<Text tag="span" class="truncate text-xs font-medium text-foreground">{t("collection.label")}: {collection.title}</Text>
			{#if collection.items.length}
				<Text tag="span" class="text-[11px] text-muted-foreground">{t("collection.hint")}</Text>
			{/if}
		</Group>
		{#if collection.items.length}
			<Group class="flex-wrap gap-2" role="list">
				{#each collection.items as item, index (`${item.kind}:${item.id}:${"variant" in item ? (item.variant ?? "") : ""}`)}
					<Group class="items-center gap-1 rounded border border-border bg-card py-1 pl-2 pr-1" role="listitem" data-slot="collection-chip" data-item={item.id}>
						<Stack align="stretch" class="min-w-0 gap-0">
							<Text tag="span" class="truncate text-xs text-foreground">{collectionItemName(item)}</Text>
							<Text tag="span" class="truncate text-[11px] text-muted-foreground">{collectionItemDetail(item)}</Text>
						</Stack>
						<Button
							type="button"
							class="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
							aria-label={t("collection.remove").replace("{name}", collectionItemName(item))}
							data-action="collection-remove"
							onclick={() => removeCollectionItem(index)}
						>
							<Icon size="sm"><X /></Icon>
						</Button>
					</Group>
				{/each}
			</Group>
		{/if}
		{#if note}
			<Text tag="p" class="text-[11px] text-muted-foreground" role="status" data-slot="collection-note">{note}</Text>
		{/if}
	</Stack>
{/if}

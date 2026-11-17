<script lang="ts">
	import { blockScope } from "$modules/chat/core/block-scope.svelte.ts";
	import { getSelectedSession } from "$modules/chat/core";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";

	const session = $derived(getSelectedSession());
	const ids = $derived(blockScope.ids(session?.id));
</script>

{#if session && ids.length}
	<Stack class="gap-1" data-slot="chat-block-scope">
		<Text tag="p" class="text-xs text-muted-foreground">{t("scope.only")}</Text>
		<Group class="flex-wrap gap-1">
			{#each ids as id (id)}
				<Button size="sm" variant="ghost" title={t("scope.remove")} onclick={() => blockScope.toggle(session.id, id)}>{blockScope.fieldId(session.id) === id ? `${t("scope.editFields")} · ` : ""}{id} ×</Button>
			{/each}
			<Button size="sm" variant="ghost" onclick={() => blockScope.clear(session.id)}>{t("scope.clear")}</Button>
		</Group>
	</Stack>
{/if}

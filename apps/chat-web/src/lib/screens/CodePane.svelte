<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import {
		getCurrentPage,
		getSelectedBlock,
		getSelectedBlockId,
		latteFromPage
	} from "../page-store";

	const page = $derived(getCurrentPage());
	const selectedId = $derived(getSelectedBlockId());
	const selected = $derived(getSelectedBlock());
	const source = $derived(latteFromPage(page, selectedId));
</script>

<Block
	tag="section"
	class="min-h-0 min-w-0 flex-1 overflow-y-auto bg-card p-4"
	aria-label={t("workspace.code")}
>
	<Stack class="gap-3">
		<Text tag="p" class="text-xs text-muted-foreground">{t("code.runtime")}</Text>
		{#if selected}
			<Group class="gap-2">
				<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					{t("code.selected")}
				</Text>
				<Text tag="span" class="truncate text-xs text-foreground">{selected.title}</Text>
				<Text tag="span" class="text-xs text-muted-foreground">{selected.kind}</Text>
			</Group>
		{/if}
		<Text tag="pre" class="overflow-x-auto whitespace-pre-wrap text-xs text-foreground">{source}</Text>
	</Stack>
</Block>

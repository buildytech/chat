<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Stack from "../compose/Stack.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { latteFromPage, type CreatorPage } from "../page-store";

	let { page }: { page: CreatorPage } = $props();

	const source = $derived(latteFromPage(page));
</script>

<Block
	tag="section"
	class="min-h-0 min-w-0 flex-1 overflow-y-auto bg-card p-4"
	aria-label={t("workspace.code")}
>
	<Stack class="gap-3">
		<Text tag="p" class="text-xs text-muted-foreground">{t("code.runtime")}</Text>
		<Text tag="pre" class="overflow-x-auto whitespace-pre-wrap text-xs text-foreground">{source}</Text>
	</Stack>
</Block>

<script lang="ts">
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { billedCostForDisplay } from "@buildytech/chat-agent";
	let { cost }: { cost: unknown } = $props();
	const billed = $derived(billedCostForDisplay(cost));
</script>

<Text tag="p" class="text-xs text-muted-foreground">
	{billed.available ? t(billed.completeness === "complete" ? "usage.billed" : "usage.billedPartial").replace("{amount}", billed.usd) : t("usage.noDollars")}
</Text>

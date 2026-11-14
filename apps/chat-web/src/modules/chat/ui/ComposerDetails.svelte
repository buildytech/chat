<script lang="ts">
	import { previewSettings } from "$lib/browser/preview-settings.svelte.ts";
	import Stack from "$registry/compose/Stack.svelte";
	import Summary from "$registry/compose/Summary.svelte";
	import Disclosure from "$registry/kit/ui/disclosure/Disclosure.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { formatTokens, type GrokChatModel, type SessionUsage } from "@buildytech/chat-agent";

	let { selected, sessionUsage, persistLabel, runtimeLabel }: { selected: GrokChatModel | null; sessionUsage: SessionUsage | null; persistLabel: string; runtimeLabel: string } = $props();
</script>

{#if !previewSettings.hideServiceLabels}
	<Disclosure class="group px-2" data-slot="composer-details">
		<Summary class="w-fit gap-2 rounded py-1 text-xs text-muted-foreground">{t("composer.details")}</Summary>
		<Stack align="stretch" class="gap-2 py-2">
			{#if selected}<Text tag="p" class="break-all font-mono text-xs text-muted-foreground">{selected.id}</Text>{/if}
			{#if sessionUsage}
				<Text tag="p" class="text-xs text-muted-foreground" role="status"
					>{t("usage.session")
						.replace("{status}", sessionUsage.status === "incomplete" ? t("usage.incomplete") : t("usage.complete"))
						.replace("{prompt}", formatTokens(sessionUsage.promptTokens))
						.replace("{completion}", formatTokens(sessionUsage.completionTokens))
						.replace("{total}", formatTokens(sessionUsage.totalTokens))
						.replace("{runs}", String(sessionUsage.runs))}</Text
				>
				<Text tag="p" class="text-xs text-muted-foreground">{t("usage.noDollars")}</Text>
			{/if}
			{#if persistLabel}<Text tag="p" class="text-xs text-muted-foreground">{persistLabel}</Text>{/if}
			{#if runtimeLabel}<Text tag="p" class="text-xs text-muted-foreground">{runtimeLabel}</Text>{/if}
		</Stack>
	</Disclosure>
{/if}

<script lang="ts">
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { modelRunsToolLoop, modelUnavailableCode, type GrokChatModel } from "@buildytech/chat-agent";

	let { chatModels, selectedModelId, onChoose, onAddModel }: { chatModels: readonly GrokChatModel[]; selectedModelId: string; onChoose: (id: string) => void; onAddModel: () => void } = $props();
</script>

<Stack
	align="stretch"
	id="composer-model-list"
	class="absolute inset-x-0 bottom-full z-20 mb-2 max-h-64 gap-1 overflow-y-auto rounded bg-popover p-2"
	role="group"
	aria-label={t("composer.modelList")}
>
	{#each chatModels as model (model.id)}
		<Button
			type="button"
			class={cn("w-full rounded px-2 py-2 text-left disabled:opacity-50", model.id === selectedModelId ? "bg-accent" : "hover:bg-accent")}
			pressed={model.id === selectedModelId}
			disabled={!modelRunsToolLoop(model)}
			onclick={() => onChoose(model.id)}
		>
			<Stack align="stretch" class="min-w-0 gap-1">
				<Text tag="span" class="text-sm text-foreground">{model.label}</Text>
				<Text tag="span" class="break-all font-mono text-xs text-muted-foreground">{model.id}</Text>
				{#if !modelRunsToolLoop(model)}
					<Text tag="span" class="text-xs text-muted-foreground">{t(modelUnavailableCode(model) === "model_too_slow" ? "composer.modelTooSlow" : "composer.modelUnavailable")}</Text>
				{/if}
			</Stack>
		</Button>
	{/each}
	<Button type="button" class="rounded px-2 py-2 text-left text-sm text-foreground hover:bg-accent" onclick={onAddModel}><Text tag="span">{t("composer.addModel")}</Text></Button>
	<Text tag="p" class="px-2 text-xs text-muted-foreground">{t("composer.modelTrialHint")}</Text>
</Stack>

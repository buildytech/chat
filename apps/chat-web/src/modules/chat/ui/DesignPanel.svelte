<script lang="ts">
	// The thread area in Design mode (ADR 0070): the project's Brand Skins and the taste-agent conversation.
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Text from "$registry/compose/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { getProjectSkin, setProjectSkin } from "$lib/project";
	import { projectBrandSkins } from "$lib/theme/brand-skins.svelte.ts";
	import { designBusy, designError, designMessages } from "../design/design.svelte.ts";

	const skins = $derived(projectBrandSkins());
	const messages = $derived(designMessages());
	const selected = $derived(getProjectSkin());
	const error = $derived(designError());
	const busy = $derived(designBusy());
</script>

<Stack align="stretch" class="min-h-0 flex-1 gap-4 overflow-y-auto p-4" data-slot="design-panel">
	<Stack align="stretch" gap="2">
		<Text tag="h2" class="text-sm font-medium">{t("design.title")}</Text>
		<Text tag="p" class="text-xs text-muted-foreground">{t("design.hint")}</Text>
	</Stack>
	{#if skins.length}
		<Stack align="stretch" gap="2" data-slot="design-skins">
			<Text tag="h3" class="text-xs font-medium text-foreground">{t("design.skinsTitle")}</Text>
			{#each skins as skin (skin.id)}
				<Group class="items-center justify-between gap-2 rounded border border-border p-2" data-slot="design-skin" data-skin={skin.id}>
					<Stack align="stretch" gap="1" class="min-w-0 flex-1">
						<Text tag="span" class="text-xs font-medium">{skin.name}</Text>
						<Text tag="span" class="text-xs text-muted-foreground">{skin.brief.thesis.summary}</Text>
					</Stack>
					{#if selected === skin.id}
						<Text tag="span" class="text-xs text-muted-foreground">{t("design.inUse")}</Text>
					{:else}
						<Button size="sm" variant="outline" data-action="design-use-skin" onclick={() => setProjectSkin(skin.id)}>{t("design.use")}</Button>
					{/if}
				</Group>
			{/each}
		</Stack>
	{:else}
		<Text tag="p" class="text-xs text-muted-foreground">{t("design.none")}</Text>
	{/if}
	<Stack align="stretch" gap="2" data-slot="design-thread">
		{#each messages as message (message.id)}
			<Stack align="stretch" gap="1" class="rounded border border-border p-2" data-role={message.role}>
				<Text tag="span" class="text-xs font-medium">{t(message.role === "user" ? "design.you" : "design.agent")}</Text>
				<Text tag="p" class="whitespace-pre-wrap text-xs text-foreground">{message.text}</Text>
			</Stack>
		{/each}
		{#if busy}<Text tag="p" class="text-xs text-muted-foreground">{t("design.working")}</Text>{/if}
		{#if error && !busy}<Text tag="p" class="text-xs text-destructive">{error}</Text>{/if}
	</Stack>
</Stack>

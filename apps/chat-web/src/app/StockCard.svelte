<script lang="ts">
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import Title from "$registry/compose/Title.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import type { CatalogScreen, ScreenCompatibility } from "@buildytech/builder-core";

	let {
		screen,
		compatibility,
		selected = false,
		onAttach
	}: {
		screen: CatalogScreen;
		compatibility: ScreenCompatibility;
		selected?: boolean;
		onAttach: (id: string) => void;
	} = $props();

	const missing = $derived(compatibility.missing.map((item) => item.catalogLabel).join(", "));
</script>

<Block
	tag="article"
	class={cn(
		"flex h-full flex-col gap-3 rounded border bg-card p-4",
		selected ? "border-primary" : "border-border"
	)}
>
	<Stack align="stretch" class="gap-1">
		<Title as={3} class="text-sm font-semibold text-foreground">{screen.title}</Title>
		<Text tag="p" class="text-xs text-muted-foreground">{screen.subtitle}</Text>
		<Text tag="p" class="text-[11px] text-muted-foreground">{screen.screenId}</Text>
	</Stack>
	{#if missing}
		<Text tag="p" class="text-xs text-muted-foreground">
			{t("home.incompatible")}
			{t("home.missing").replace("{list}", missing)}
		</Text>
	{/if}
	<Group class="mt-auto">
		<Button
			class="rounded border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
			pressed={selected}
			onclick={() => onAttach(screen.screenId)}
		>
			<Text tag="span">{t("home.attachScreen")}</Text>
		</Button>
	</Group>
</Block>

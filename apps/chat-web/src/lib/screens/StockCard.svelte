<script lang="ts">
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Text from "../../ui/text/Text.svelte";
	import Title from "../compose/Title.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
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
		"flex h-full flex-col gap-3 rounded-default border bg-card p-4",
		selected ? "border-primary" : "border-border"
	)}
>
	<Stack class="gap-1">
		<Title as={3} class="text-sm font-semibold text-foreground">{screen.title}</Title>
		<Text tag="p" class="text-xs text-muted-foreground">{screen.subtitle}</Text>
		<Text tag="p" class="text-[11px] text-muted-foreground">{screen.screenId}</Text>
	</Stack>
	{#if !compatibility.compatible}
		<Text tag="p" class="text-xs text-muted-foreground">
			{t("home.incompatible")}
			{#if missing}
				{t("home.missing").replace("{list}", missing)}
			{/if}
		</Text>
	{/if}
	<Group class="mt-auto">
		<Button
			class="rounded-default border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
			aria-pressed={selected ? "true" : "false"}
			onclick={() => onAttach(screen.screenId)}
		>
			<Text tag="span">{t("home.attachScreen")}</Text>
		</Button>
	</Group>
</Block>

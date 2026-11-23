<!-- The Settings screen (/settings, ADR 0068): a header (back to the builder, the theme switch) and the sections the loaded
     modules put in the "settings.screen" slot; without a module it says there is nothing to set here. -->
<script lang="ts">
	import { onMount } from "svelte";
	import Box from "$registry/compose/Box.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Title from "$registry/compose/Title.svelte";
	import Text from "$registry/compose/Text.svelte";
	import Link from "$registry/compose/Link.svelte";
	import Button from "$registry/compose/Button.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { theme } from "$lib/theme/theme.svelte";
	import { slotComponents } from "$lib/modules/registry.svelte";
	import ModuleSlot from "./ModuleSlot.svelte";

	onMount(() => theme.init());
	const empty = $derived(slotComponents("settings.screen").length === 0);
</script>

<svelte:head>
	<title>{t("settingsScreen.documentTitle")}</title>
</svelte:head>

<Box tag="main" class="min-h-screen bg-background text-foreground" data-slot="settings-screen">
	<Stack align="stretch" class="mx-auto w-full max-w-4xl gap-6 p-4 md:p-8">
		<Group tag="header" class="items-center justify-between gap-4">
			<Group class="items-center gap-4">
				<Link href="/" class="text-sm underline" data-action="settings-back">{t("settingsScreen.back")}</Link>
				<Title as={1} class="text-xl font-semibold">{t("settingsScreen.title")}</Title>
			</Group>
			<Button size="sm" variant="outline" pressed={theme.isDark} aria-label={t("settingsScreen.dark")} data-action="settings-dark" onclick={() => theme.toggle()}>
				{t("settingsScreen.dark")}
			</Button>
		</Group>
		{#if empty}
			<Text tag="p" class="text-sm text-muted-foreground">{t("settingsScreen.empty")}</Text>
		{:else}
			<ModuleSlot name="settings.screen" props={{}} />
		{/if}
	</Stack>
</Box>

<!-- The Settings region of the sidebar: chat theme, interface language, preview labels, theme import, session file, clear storage. -->
<script lang="ts">
	import { X } from "$lib/shell-icons";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Title from "$registry/compose/Title.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import Checkbox from "$registry/compose/Checkbox.svelte";
	import Label from "$registry/compose/Label.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { UI_LOCALES } from "$lib/i18n/locale-pref";
	import { uiLocale } from "$lib/i18n/locale.svelte";
	import { theme } from "$lib/theme/theme.svelte";
	import { THEME_PREFS } from "$lib/theme/theme-pref";
	import { cn } from "$registry/utils/cn";
	import { previewSettings } from "$lib/browser/preview-settings.svelte";
	import SettingsSessionFile from "./SettingsSessionFile.svelte";
	import SettingsThemeImport from "./SettingsThemeImport.svelte";
	import Link from "$registry/compose/Link.svelte";
	import { slotComponents } from "$lib/modules/registry.svelte";

	// The Settings screen has sections only when a module brings them (the providers of the chat module).
	const hasScreen = $derived(slotComponents("settings.screen").length > 0);

	let { storageNote, onclose, onclearall }: { storageNote: string; onclose: () => void; onclearall: () => void } = $props();

	// Keyboard focus inside the scrolling Settings region: show the whole control, not only its caret (a tall textarea
	// was left half clipped by the browser's own focus scroll at 1024x640).
	function revealFocused(event: FocusEvent) {
		if (event.target instanceof HTMLElement) event.target.scrollIntoView?.({ block: "nearest" });
	}
</script>

	<Stack
		align="stretch"
		id="creator-settings"
		class="min-h-0 shrink gap-2 overflow-y-auto overscroll-contain rounded border border-border p-2 text-xs"
		role="region"
		tabindex={-1}
		aria-label={t("sidebar.settingsRegion")}
		data-slot="settings-region"
		onfocusin={revealFocused}
	>
		<Group class="sticky top-0 z-10 items-center justify-between gap-2 bg-card">
			<Title as={2} class="text-xs font-semibold">{t("sidebar.settings")}</Title>
			<Button
				id="creator-settings-close"
				class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
				aria-label={t("sidebar.closeSettings")}
				title={t("sidebar.closeSettings")}
				onclick={onclose}><Icon size="sm"><X /></Icon></Button
			>
		</Group>
		<!-- The chat UI theme (ADR 0026): system / dark / light; the preview keeps its own skin. -->
		<Text tag="p" class="text-xs font-medium text-foreground" id="creator-settings-theme-label"
			>{t("settings.theme")}</Text
		>
		<Group
			class="items-center gap-1 rounded-full bg-muted p-1"
			role="group"
			aria-labelledby="creator-settings-theme-label"
			data-slot="settings-theme"
		>
			{#each THEME_PREFS as option (option)}
				<Button
					class={cn(
						"flex-1 rounded-full px-2 py-1 text-xs",
						theme.pref === option
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
					pressed={theme.pref === option}
					data-action={`theme-${option}`}
					onclick={() => theme.setPref(option)}
				>
					{t(`settings.theme.${option}`)}
				</Button>
			{/each}
		</Group>
		<Text tag="p" class="text-xs font-medium text-foreground" id="creator-settings-locale-label"
			>{t("settings.locale")}</Text
		>
		<Group
			class="items-center gap-1 rounded-full bg-muted p-1"
			role="group"
			aria-labelledby="creator-settings-locale-label"
			data-slot="settings-locale"
		>
			{#each UI_LOCALES as option (option)}
				<Button
					class={cn(
						"flex-1 rounded-full px-2 py-1 text-xs",
						uiLocale.current === option
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
					pressed={uiLocale.current === option}
					data-action={`locale-${option}`}
					onclick={() => uiLocale.set(option)}
				>
					{t(`settings.locale.${option}`)}
				</Button>
			{/each}
		</Group>
		<Group class="items-center gap-2 px-2 py-1" data-slot="settings-preview-clean">
			<Checkbox
				id="creator-settings-preview-clean"
				checked={previewSettings.hideServiceLabels}
				onchange={(event: Event) => {
					if (event.currentTarget instanceof HTMLInputElement) previewSettings.setHideServiceLabels(event.currentTarget.checked);
				}}
			/>
			<Label for="creator-settings-preview-clean" class="text-xs text-foreground"
				>{t("settings.hidePreviewLabels")}</Label
			>
		</Group>
		<SettingsThemeImport />
		<SettingsSessionFile />
		{#if hasScreen}
			<Link href="/settings" class="px-2 py-1 text-xs underline" data-action="open-settings-screen">{t("settings.screenLink")}</Link>
		{/if}
		<Button
			class="flex w-full items-center justify-start rounded px-2 py-1 text-xs text-destructive hover:bg-accent/70"
			aria-haspopup="dialog"
			onclick={onclearall}
		>
			{t("sidebar.clearStorage")}
		</Button>
		{#if storageNote}
			<Text tag="p" class="text-xs text-muted-foreground">{storageNote}</Text>
		{/if}
	</Stack>

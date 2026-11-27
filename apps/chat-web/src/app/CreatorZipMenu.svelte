<script lang="ts" module>
	import type { TemplPreset } from "$lib/page-store";
	/** Dictionary keys of the starter presets. */
	export const PRESET_LABEL: Record<TemplPreset, string> = { blog: "workspace.zipPresetBlog", corporate: "workspace.zipPresetCorporate", shop: "workspace.zipPresetShop" };
</script>

<script lang="ts">
	// The export format of «Download ZIP» (ADR 0069): the Svelte project, or the Go templ starter with one of its presets.
	import { Check } from "$lib/shell-icons";
	import Stack from "$registry/compose/Stack.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { cn } from "$registry/utils/cn";
	import { t } from "$lib/i18n/dictionary";

	type Format = "svelte" | "templ";
	let {
		format,
		preset,
		preparing = false,
		onFormat,
		onPreset,
		onDownload
	}: { format: Format; preset: TemplPreset; preparing?: boolean; onFormat: (format: Format) => void; onPreset: (preset: TemplPreset) => void; onDownload: () => void } = $props();
</script>

{#snippet formatOption(id: Format, label: string, hint: string)}
	<Button
		type="button"
		class={cn("w-full items-center justify-between gap-2 rounded px-2 py-1 text-left", format === id ? "bg-accent text-foreground" : "text-foreground hover:bg-accent")}
		pressed={format === id}
		data-format={id}
		onclick={() => onFormat(id)}
	>
		<Stack align="stretch" class="min-w-0 gap-1">
			<Text tag="span" class="text-xs text-foreground">{t(label)}</Text>
			<Text tag="span" class="text-xs text-muted-foreground">{t(hint)}</Text>
		</Stack>
		{#if format === id}<Icon size="sm"><Check /></Icon>{/if}
	</Button>
{/snippet}

{#snippet presetOption(value: TemplPreset)}
	<Button
		type="button"
		class={cn("flex-1 rounded px-2 py-1 text-xs", preset === value ? "bg-accent text-foreground" : "text-foreground hover:bg-accent")}
		pressed={preset === value}
		data-preset={value}
		onclick={() => onPreset(value)}
	>
		<Text tag="span">{t(PRESET_LABEL[value])}</Text>
	</Button>
{/snippet}

<Stack align="stretch" id="zip-format-list" class="absolute right-0 top-8 z-20 mt-1 w-80 gap-1 rounded bg-popover p-1" role="group" aria-label={t("workspace.zipFormat")} data-block="zip-format">
	<Text tag="p" class="px-2 pt-1 text-xs text-muted-foreground">{t("workspace.zipFormat")}</Text>
	{@render formatOption("svelte", "workspace.zipSvelte", "workspace.zipSvelteHint")}
	{@render formatOption("templ", "workspace.zipTempl", "workspace.zipTemplHint")}
	{#if format === "templ"}
		<Text tag="p" id="zip-preset-label" class="px-2 pt-1 text-xs text-muted-foreground">{t("workspace.zipPreset")}</Text>
		<Group class="gap-1 px-1" role="group" aria-labelledby="zip-preset-label">
			{@render presetOption("blog")}
			{@render presetOption("corporate")}
			{@render presetOption("shop")}
		</Group>
	{/if}
	<Button
		type="button"
		class="mt-1 w-full rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
		aria-busy={preparing}
		data-action="download-zip-choice"
		onclick={onDownload}
	>
		<Text tag="span">{preparing ? t("workspace.zipPreparing") : t("workspace.downloadZip")}</Text>
	</Button>
</Stack>

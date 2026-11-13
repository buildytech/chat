<!--
  Settings > Theme import (ADR 0025): one theme as the Stock theme editor (app.codegen-x.com, Theme > Export / import)
  exports it, format magazine-theme version 2, from a file or pasted. It is checked in program code (Stock's schema and
  reader, custom-skin.ts); a passing config fills the one Custom Skin slot (a new import replaces it) and shows in the
  preview's skin selector as "Custom Skin". Export gives the same config back; Remove empties the slot. The theme
  applies to the preview site and its export only, never to the chat UI.
-->
<script lang="ts">
import { Check, Download, FileUp, Trash2, Upload } from "$lib/shell-icons";
	import Group from "$registry/compose/Group.svelte";
	import Label from "$registry/compose/Label.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Textarea from "$registry/compose/Textarea.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Input from "$registry/kit/ui/input/Input.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { getChatSkin, setChatSkin } from "$lib/chat-core";
	import { CUSTOM_SKIN_ID, type ThemeIssue } from "$lib/theme/custom-skin";
	import { customSkin } from "$lib/theme/custom-skin.svelte";

	const ACTION = "inline-flex flex-1 items-center justify-center gap-2 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-accent/70 disabled:cursor-not-allowed disabled:opacity-60";

	let text = $state("");
	let note = $state("");
	let issues = $state.raw<ThemeIssue[]>([]);
	const config = $derived(customSkin.config);
	const inUse = $derived(getChatSkin() === CUSTOM_SKIN_ID);

	function issueText(issue: ThemeIssue): string {
		return t(`themeImport.issue.${issue.code}`)
			.replace("{path}", issue.path || "/")
			.replace("{allowed}", (issue.allowed ?? []).join(", "));
	}

	function run(input: string) {
		const result = customSkin.import(input);
		if (result.ok) {
			issues = [];
			text = result.text;
			note = t("themeImport.imported");
		} else {
			issues = result.issues;
			note = t("themeImport.invalid").replace("{count}", String(result.issues.length));
		}
	}

	async function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (!file) return;
		text = await file.text();
		run(text);
	}

	function onExport() {
		const out = customSkin.exportText();
		if (!out) return;
		text = out;
		const blob = new Blob([`${out}\n`], { type: "application/json" });
		const href = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = href;
		anchor.download = "custom-skin.magazine-theme.json";
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(href);
		note = t("themeImport.exported");
	}

	function onRemove() {
		if (inUse) setChatSkin(null);
		customSkin.remove();
		issues = [];
		note = t("themeImport.removed");
	}
</script>

<Stack align="stretch" class="gap-2" data-slot="settings-theme-import">
	<Text tag="p" class="text-xs font-medium text-foreground">{t("themeImport.title")}</Text>
	<Text tag="p" class="text-xs text-muted-foreground">{t("themeImport.note")}</Text>
	{#if config}
		<Group class="items-center gap-2 rounded border border-border px-2 py-1" data-slot="custom-skin-slot">
			<Icon size="sm" class="text-muted-foreground"><Check /></Icon>
			<Text tag="span" class="min-w-0 flex-1 truncate text-xs text-foreground">
				{t("themeImport.slot").replace("{skin}", config.skin ?? t("preview.skinDefault")).replace("{mode}", config.mode)}
			</Text>
		</Group>
		<Group class="gap-2">
			<Button class={ACTION} data-action="custom-skin-use" disabled={inUse} onclick={() => setChatSkin(CUSTOM_SKIN_ID)}>
				{inUse ? t("themeImport.inUse") : t("themeImport.use")}
			</Button>
			<Button class={ACTION} data-action="custom-skin-export" onclick={onExport}>
				<Icon size="sm"><Download /></Icon>
				{t("themeImport.export")}
			</Button>
			<Button class={ACTION} aria-label={t("themeImport.remove")} title={t("themeImport.remove")} data-action="custom-skin-remove" onclick={onRemove}>
				<Icon size="sm"><Trash2 /></Icon>
			</Button>
		</Group>
	{/if}
	<Label for="settings-theme-json" class="text-xs text-foreground">{t("themeImport.label")}</Label>
	<Textarea
		id="settings-theme-json"
		size="sm"
		rows={4}
		class="font-mono text-xs"
		value={text}
		placeholder={t("themeImport.placeholder")}
		spellcheck="false"
		data-slot="theme-import-text"
		oninput={(event: Event) => (text = (event.currentTarget as HTMLTextAreaElement).value)}
	/>
	<Group class="gap-2">
		<Button class={ACTION} data-action="theme-import-file" onclick={() => document.getElementById("settings-theme-file")?.click()}>
			<Icon size="sm"><FileUp /></Icon>
			{t("themeImport.file")}
		</Button>
		<Button class={ACTION} data-action="theme-import" disabled={!text.trim()} onclick={() => run(text)}>
			<Icon size="sm"><Upload /></Icon>
			{t("themeImport.import")}
		</Button>
	</Group>
	<Input id="settings-theme-file" type="file" accept="application/json,.json" class="hidden" aria-label={t("themeImport.file")} data-slot="theme-import-file" onchange={onFile} />
	{#if note}
		<Text tag="p" class="text-xs text-muted-foreground" role="status" data-slot="theme-import-note">{note}</Text>
	{/if}
	{#if issues.length}
		<Stack align="stretch" class="gap-1" role="alert" data-slot="theme-import-issues">
			{#each issues.slice(0, 8) as issue, index (index)}
				<Text tag="p" class="break-all text-xs text-destructive">{issueText(issue)}</Text>
			{/each}
		</Stack>
	{/if}
</Stack>

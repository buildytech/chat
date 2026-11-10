<!--
  Settings > Session file (ADR 0015): Export saves this browser's session file buildy:v1 (what `buildy.export()`
  returns), Import checks one and loads it (`buildy.import(json)`; a failing file changes nothing), and Quarantine
  lists the stored values that failed their checks at load: kept, never loaded, downloadable as JSON.
-->
<script lang="ts">
	import Download from "@lucide/svelte/icons/download";
	import Upload from "@lucide/svelte/icons/upload";
	import Disclosure from "$registry/compose/Disclosure.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Summary from "$registry/compose/Summary.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Input from "$registry/kit/ui/input/Input.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { exportSessionFile, importFile } from "$lib/browser/buildy-api";
	import { browserQuarantine, type QuarantineEntry } from "$lib/browser/storage-v1";

	let note = $state("");
	let entries = $state.raw<QuarantineEntry[]>(browserQuarantine());

	function onExport() {
		const file = exportSessionFile({ download: true });
		note = t("settings.exported").replace("{count}", String(file.sessions.length));
	}

	async function onImportFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (!file) return;
		const result = await importFile(await file.text());
		if (result.ok && "sessionId" in result) {
			note = t("settings.collectionOpened").replace("{count}", String(result.items));
		} else if (!result.ok && !("issues" in result)) {
			note = result.message;
		} else if (result.ok) {
			note = t("settings.imported")
				.replace("{added}", String(result.added.length))
				.replace("{replaced}", String(result.replaced.length));
		} else {
			const first = result.issues[0];
			note = t("settings.importFailed").replace("{code}", result.code).replace("{path}", first ? first.path : "$");
		}
		entries = browserQuarantine();
	}

	function onDownloadQuarantine() {
		const blob = new Blob([JSON.stringify(entries, null, 2) + "\n"], { type: "application/json" });
		const href = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = href;
		anchor.download = "buildy-quarantine.json";
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(href);
	}
</script>

<Stack align="stretch" class="gap-2" data-slot="settings-session-file">
	<Text tag="p" class="text-xs font-medium text-foreground">{t("settings.sessionFile")}</Text>
	<Group class="gap-2">
		<Button
			class="inline-flex flex-1 items-center justify-center gap-2 rounded border border-border px-2 py-2 text-sm text-foreground hover:bg-accent/70"
			data-action="session-export"
			onclick={onExport}
		>
			<Icon size="sm"><Download /></Icon>
			{t("settings.export")}
		</Button>
		<Button
			class="inline-flex flex-1 items-center justify-center gap-2 rounded border border-border px-2 py-2 text-sm text-foreground hover:bg-accent/70"
			data-action="session-import"
			onclick={() => document.getElementById("settings-session-import")?.click()}
		>
			<Icon size="sm"><Upload /></Icon>
			{t("settings.import")}
		</Button>
	</Group>
	<Input
		id="settings-session-import"
		type="file"
		accept="application/json,.json"
		class="hidden"
		aria-label={t("settings.import")}
		data-slot="session-import-file"
		onchange={onImportFile}
	/>
	{#if note}
		<Text tag="p" class="text-xs text-muted-foreground" role="status" data-slot="session-file-note">{note}</Text>
	{/if}
	<Disclosure variant="ghost" data-slot="settings-quarantine" ontoggle={() => (entries = browserQuarantine())}>
		<Summary size="sm">{t("settings.quarantine").replace("{count}", String(entries.length))}</Summary>
		<Stack align="stretch" class="gap-2 py-2">
			{#if entries.length === 0}
				<Text tag="p" class="text-xs text-muted-foreground">{t("settings.quarantineEmpty")}</Text>
			{:else}
				<Text tag="p" class="text-xs text-muted-foreground">{t("settings.quarantineHint")}</Text>
				{#each entries as entry, index (index)}
					<Stack align="stretch" class="gap-0 rounded border border-border p-2" data-slot="quarantine-entry">
						<Text tag="p" class="break-all text-xs font-medium text-foreground">{entry.key}{entry.path ? ` ${entry.path}` : ""}</Text>
						<Text tag="p" class="text-xs text-muted-foreground">{entry.reason} · {entry.at}</Text>
						<Text tag="p" class="text-xs text-muted-foreground">{t("settings.quarantineSize").replace("{size}", String(entry.raw.length))}</Text>
					</Stack>
				{/each}
				<Button
					class="w-full justify-start rounded px-2 py-2 text-sm text-foreground hover:bg-accent/70"
					data-action="quarantine-download"
					onclick={onDownloadQuarantine}
				>
					{t("settings.quarantineDownload")}
				</Button>
			{/if}
		</Stack>
	</Disclosure>
</Stack>

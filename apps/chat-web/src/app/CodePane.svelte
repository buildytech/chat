<!-- Service notes follow the shell visibility setting; source remains intact. -->
<script lang="ts">
	import { packSkinOptions } from "$lib/theme/custom-skin.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import ChevronLeft from "@lucide/svelte/icons/chevron-left";
	import Copy from "@lucide/svelte/icons/copy";
	import FileCode from "@lucide/svelte/icons/file-code";
	import Files from "@lucide/svelte/icons/files";
	import X from "@lucide/svelte/icons/x";
	import { previewSettings } from "$lib/browser/preview-settings.svelte";
 import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { getChatSkin } from "$lib/chat-core";
	import {
		blocksOf,
		getCurrentPage, getPageRevision,
		packFilesFromPage,
		svelteFromPage
	} from "$lib/page-store";
	import CodeEditor from "./editor/CodeEditor.svelte";
	import { creatorLayout } from "$lib/creator-layout.svelte";
	import CodeFilePane, { type CodeTreeEntry } from "./CodeFilePane.svelte";
	import PaneSplitter from "./PaneSplitter.svelte";

	type CodeTab = { label: string; path: string; active: boolean };

	const page = $derived(getCurrentPage());
	const savedRevision = $derived(getPageRevision());
	const pack = $derived(page ? packFilesFromPage(page, packSkinOptions(getChatSkin())) : []);

	let openFolders = $state<Record<string, boolean>>({ "src/sections": true });

	const APP = "src/App.svelte";
	const tree = $derived.by((): CodeTreeEntry[] => {
		if (!page) return [];
		const entries: CodeTreeEntry[] = [
			{ id: APP, label: "App.svelte", kind: "file", path: APP },
			{ id: "src/sections", label: "sections", kind: "folder", path: "src/sections" }
		];
		for (const block of blocksOf(page)) {
			entries.push({
				id: `src/sections/${block.id}.svelte`,
				label: `${block.id}.svelte`,
				kind: "file",
				path: `src/sections/${block.id}.svelte`
			});
		}
		entries.push({ id: "manifest.json", label: "manifest.json", kind: "file", path: "manifest.json" });
		return entries;
	});

	const visibleTree = $derived(
		tree.filter(
			(entry) =>
				entry.kind === "folder" ||
				entry.path === APP ||
				entry.path === "manifest.json" ||
				(entry.path.startsWith("src/sections/") && !!openFolders["src/sections"])
		)
	);

	const treeCollapsed = $derived(creatorLayout.treeCollapsed);

	let pane = $state<"files" | "search">("files");
	let copyNote = $state("");
	let tabs = $state<CodeTab[]>([{ label: "App.svelte", path: APP, active: true }]);
	let selectedPath = $state(APP);
	let stage = $state<"files" | "editor">("editor");

	const activeTab = $derived(tabs.find((tab) => tab.active) ?? tabs[0]);
	const crumbs = $derived((activeTab?.path ?? APP).split("/"));
	const source = $derived.by(() => {
		if (!page) return t("workspace.empty");
		return (
			pack.find((file) => file.path === (activeTab?.path ?? APP))?.content ??
			svelteFromPage(page)
		);
	});
	const editorLanguage = $derived(
		(activeTab?.path ?? "").endsWith(".json") ? "json" : "svelte"
	);

	function openFile(entry: CodeTreeEntry) {
		selectedPath = entry.path;
		let index = tabs.findIndex((tab) => tab.path === entry.path);
		if (index < 0) {
			tabs = [...tabs, { label: entry.label, path: entry.path, active: false }];
			index = tabs.length - 1;
		}
		tabs = tabs.map((tab, i) => ({ ...tab, active: i === index }));
		stage = "editor";
	}

	function closeTab(index: number) {
		if (tabs.length === 1) return;
		const wasActive = tabs[index]?.active;
		const next = tabs.filter((_, i) => i !== index);
		if (wasActive) {
			const pick = Math.min(index, next.length - 1);
			tabs = next.map((tab, i) => ({ ...tab, active: i === pick }));
		} else {
			tabs = next;
		}
		selectedPath = (tabs.find((tab) => tab.active) ?? tabs[0])?.path ?? APP;
	}

	function activateTab(index: number) {
		tabs = tabs.map((tab, i) => ({ ...tab, active: i === index }));
		selectedPath = tabs[index]?.path ?? selectedPath;
	}

	async function copySource() {
		const text = source.trim();
		if (!text) {
			copyNote = t("code.copyEmpty");
			return;
		}
		try {
			if (!navigator.clipboard?.writeText) {
				copyNote = t("code.copyFailed");
				return;
			}
			await navigator.clipboard.writeText(source);
			copyNote = t("code.copyOk");
		} catch {
			copyNote = t("code.copyFailed");
		}
	}
</script>

<Block
	tag="section"
	class="mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded border border-border bg-card md:flex-row"
	aria-label={t("workspace.code")}
	data-page-id={page?.id ?? ""}
	data-page-revision={savedRevision ?? ""}
	data-block="code-pane"
	data-stage={stage}
>
	<CodeFilePane
		{pane}
		tree={visibleTree}
		{selectedPath}
		{openFolders}
		collapsed={treeCollapsed}
		onpane={(next) => (pane = next)}
		ontoggle={(id) => (openFolders[id] = !openFolders[id])}
		onopen={openFile}
		oncollapse={() => creatorLayout.toggleTree()}
	/>
	{#if !treeCollapsed}
		<PaneSplitter pane="tree" controls="code-file-pane" class="max-md:hidden" />
	{/if}

	<Stack align="stretch" class="flex min-h-0 min-w-0 flex-1 flex-col max-md:in-data-[stage=files]:hidden">
		<Stack align="stretch" class="hidden border-b border-border p-4 max-md:in-data-[stage=editor]:block">
			<Button
				class="inline-flex w-full items-center justify-center gap-2 rounded border border-border px-3 py-1 text-sm text-foreground hover:bg-accent"
				onclick={() => (stage = "files")}
			>
				<Icon size="sm" class="text-muted-foreground"><ChevronLeft /></Icon>
				<Text tag="span">{t("code.backFiles")}</Text>
			</Button>
		</Stack>
		<Group class="h-10 shrink-0 items-center overflow-hidden border-b border-border bg-muted">
			{#if treeCollapsed}
				<Button
					class="ml-1 hidden size-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground md:inline-flex"
					aria-label={t("code.showFiles")}
					title={t("code.showFiles")}
					onclick={() => creatorLayout.toggleTree()}
				>
					<Icon size="sm"><Files /></Icon>
				</Button>
			{/if}
			<Group
				class="h-full min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none]"
				role="tablist"
				aria-label={t("code.openFiles")}
			>
			{#each tabs as tab, i (tab.path)}
				<Group
					class={cn(
						"h-full shrink-0 items-center gap-0 border-r border-border px-2",
						tab.active ? "bg-card text-foreground" : "text-muted-foreground"
					)}
				>
					<Button
						class="inline-flex items-center gap-1 rounded px-1 py-1 text-xs"
						role="tab"
						aria-selected={tab.active ? "true" : "false"}
						onclick={() => activateTab(i)}
					>
						<Icon size="sm"><FileCode /></Icon>
						<Text tag="span">{tab.label}</Text>
					</Button>
					<Button
						class="inline-flex size-6 items-center justify-center rounded hover:bg-accent"
						aria-label={t("code.closeTab")}
						onclick={() => closeTab(i)}
					>
						<Icon size="sm"><X /></Icon>
					</Button>
				</Group>
			{/each}
			</Group>
		</Group>
		<Group class="h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-2" aria-label={t("code.path")}>
			{#each crumbs as crumb, i (crumb + i)}
				{#if i > 0}
					<Text tag="span" class="text-xs text-muted-foreground" aria-hidden="true">/</Text>
				{/if}
				<Text tag="span" class="text-xs text-foreground">{crumb}</Text>
			{/each}
			<Box class="min-w-0 flex-1"></Box>
			<Button
				class="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-accent"
				aria-label={t("code.copy")}
				onclick={copySource}
			>
				<Icon size="sm"><Copy /></Icon>
				<Text tag="span">{t("code.copy")}</Text>
			</Button>
		</Group>
		<Stack align="stretch" class="min-h-0 flex-1 gap-2 overflow-hidden bg-background p-4">
			{#if !previewSettings.hideServiceLabels}<Text tag="p" class="text-xs text-muted-foreground">{t("code.runtime")}</Text>{/if}
			{#if copyNote}
				<Text tag="p" class="text-xs text-muted-foreground" role="status">{copyNote}</Text>
			{/if}
			<CodeEditor
				doc={source}
				language={editorLanguage}
				editable={false}
			/>
		</Stack>
	</Stack>
</Block>

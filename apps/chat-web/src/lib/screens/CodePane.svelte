<script lang="ts">
	import ChevronLeft from "@lucide/svelte/icons/chevron-left";
	import FileCode from "@lucide/svelte/icons/file-code";
	import X from "@lucide/svelte/icons/x";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import {
		blocksOf,
		getCurrentPage,
		getSelectedBlockId,
		latteFromPage,
		packFilesFromPage,
		walkBlocks
	} from "../page-store";
	import CodeEditor from "../editor/CodeEditor.svelte";
	import CodeFilePane, { type CodeTreeEntry } from "./CodeFilePane.svelte";

	type CodeTab = { label: string; path: string; active: boolean };

	const page = $derived(getCurrentPage());
	const selectedId = $derived(getSelectedBlockId());
	const pack = $derived(packFilesFromPage(page, selectedId));

	let openFolders = $state<Record<string, boolean>>({ blocks: true });

	const tree = $derived.by((): CodeTreeEntry[] => {
		const entries: CodeTreeEntry[] = [
			{ id: "page.latte", label: "page.latte", kind: "file", path: "page.latte" },
			{ id: "blocks", label: "blocks", kind: "folder", path: "blocks" }
		];
		for (const block of walkBlocks(blocksOf(page))) {
			entries.push({
				id: `blocks/${block.id}.latte`,
				label: `${block.id}.latte`,
				kind: "file",
				path: `blocks/${block.id}.latte`
			});
		}
		entries.push({
			id: "manifest.json",
			label: "manifest.json",
			kind: "file",
			path: "manifest.json"
		});
		return entries;
	});

	const visibleTree = $derived(
		tree.filter((entry) => entry.kind === "folder" || entry.path === "page.latte" || entry.path === "manifest.json" || (entry.path.startsWith("blocks/") && !!openFolders["blocks"]))
	);

	let pane = $state<"files" | "search" | "apps">("files");
	let tabs = $state<CodeTab[]>([{ label: "page.latte", path: "page.latte", active: true }]);
	let selectedPath = $state("page.latte");
	let stage = $state<"files" | "editor">("editor");

	const activeTab = $derived(tabs.find((tab) => tab.active) ?? tabs[0]);
	const crumbs = $derived((activeTab?.path ?? "page.latte").split("/"));
	const source = $derived(
		pack.find((file) => file.path === (activeTab?.path ?? "page.latte"))?.content ??
			latteFromPage(page, selectedId)
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
		selectedPath = (tabs.find((tab) => tab.active) ?? tabs[0])?.path ?? "page.latte";
	}

	function activateTab(index: number) {
		tabs = tabs.map((tab, i) => ({ ...tab, active: i === index }));
		selectedPath = tabs[index]?.path ?? selectedPath;
	}
</script>

<Block
	tag="section"
	class="mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-default border border-border bg-card md:flex-row"
	aria-label={t("workspace.code")}
	data-block="code-pane"
	data-stage={stage}
>
	<CodeFilePane
		{pane}
		tree={visibleTree}
		{selectedPath}
		{openFolders}
		onpane={(next) => (pane = next)}
		ontoggle={(id) => (openFolders[id] = !openFolders[id])}
		onopen={openFile}
	/>

	<Block class="flex min-h-0 min-w-0 flex-1 flex-col max-md:in-data-[stage=files]:hidden">
		<Block class="hidden border-b border-border p-4 max-md:in-data-[stage=editor]:block">
			<Button
				class="inline-flex w-full items-center justify-center gap-2 rounded-default border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
				onclick={() => (stage = "files")}
			>
				<Icon size="sm" class="text-muted-foreground"><ChevronLeft /></Icon>
				<Text tag="span">{t("code.backFiles")}</Text>
			</Button>
		</Block>
		<Group
			class="h-10 shrink-0 items-center overflow-x-auto border-b border-border bg-muted [scrollbar-width:none]"
			role="tablist"
			aria-label={t("code.openFiles")}
		>
			{#each tabs as tab, i (tab.path)}
				<Group
					class={cn(
						"h-full shrink-0 items-center gap-1 border-r border-border px-2",
						tab.active ? "bg-card text-foreground" : "text-muted-foreground"
					)}
				>
					<Button
						class="inline-flex items-center gap-1 rounded-default px-1 py-1 text-xs"
						role="tab"
						aria-selected={tab.active ? "true" : "false"}
						onclick={() => activateTab(i)}
					>
						<Icon size="sm"><FileCode /></Icon>
						<Text tag="span">{tab.label}</Text>
					</Button>
					<Button
						class="inline-flex size-6 items-center justify-center rounded-default hover:bg-accent"
						aria-label={t("code.closeTab")}
						onclick={() => closeTab(i)}
					>
						<Icon size="sm"><X /></Icon>
					</Button>
				</Group>
			{/each}
		</Group>
		<Group class="h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-3" aria-label={t("code.path")}>
			{#each crumbs as crumb, i (crumb + i)}
				{#if i > 0}
					<Text tag="span" class="text-xs text-muted-foreground" aria-hidden="true">/</Text>
				{/if}
				<Text tag="span" class="text-xs text-foreground">{crumb}</Text>
			{/each}
		</Group>
		<Stack class="min-h-0 flex-1 gap-2 overflow-hidden p-4">
			<Text tag="p" class="text-xs text-muted-foreground">{t("code.runtime")}</Text>
			<CodeEditor
				doc={source}
				language={(activeTab?.path ?? "").endsWith(".json") ? "json" : "latte"}
				editable={false}
			/>
		</Stack>
	</Block>
</Block>

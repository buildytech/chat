<script lang="ts" module>
	export type CodeTreeEntry = {
		id: string;
		label: string;
		kind: "folder" | "file";
		path: string;
	};
</script>

<script lang="ts">
	import Box from "$registry/kit/ui/box/Box.svelte";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronRight from "@lucide/svelte/icons/chevron-right";
	import FileCode from "@lucide/svelte/icons/file-code";
	import Files from "@lucide/svelte/icons/files";
	import PanelLeft from "@lucide/svelte/icons/panel-left";
	import Search from "@lucide/svelte/icons/search";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Input from "$registry/kit/ui/input/Input.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { creatorLayout, INSPECTOR_COLUMN_MIN } from "$lib/creator-layout.svelte";

	let {
		pane,
		tree,
		selectedPath,
		openFolders,
		onpane,
		ontoggle,
		onopen,
		collapsed = false,
		oncollapse
	}: {
		pane: "files" | "search";
		tree: CodeTreeEntry[];
		selectedPath: string;
		openFolders: Record<string, boolean>;
		onpane: (pane: "files" | "search") => void;
		ontoggle: (id: string) => void;
		onopen: (entry: CodeTreeEntry) => void;
		collapsed?: boolean;
		oncollapse?: () => void;
	} = $props();

	let fileQuery = $state("");
	const visibleEntries = $derived.by(() => {
		if (pane !== "search") return tree;
		const needle = fileQuery.trim().toLowerCase();
		if (!needle) return tree.filter((entry) => entry.kind === "file");
		return tree.filter(
			(entry) => entry.kind === "file" && `${entry.label} ${entry.path}`.toLowerCase().includes(needle)
		);
	});
</script>

<Block
	id="code-file-pane"
	tag="aside"
	class={cn(
		"flex w-full shrink-0 flex-col overflow-y-auto border-b border-border bg-muted md:border-b-0 md:border-r max-md:flex-1 max-md:in-data-[stage=editor]:hidden",
		collapsed && "md:hidden"
	)}
	aria-label={t("code.tree")}
	style={creatorLayout.viewport >= INSPECTOR_COLUMN_MIN ? `width: ${creatorLayout.size("tree")}px` : undefined}
>
	<Group class="h-10 shrink-0 items-center gap-0 border-b border-border px-2">
		<Button
			class={cn(
				"inline-flex size-8 items-center justify-center rounded",
				pane === "files" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"
			)}
			aria-label={t("code.files")}
			pressed={pane === "files"}
			onclick={() => onpane("files")}
		>
			<Icon size="sm"><Files /></Icon>
		</Button>
		<Button
			class={cn(
				"inline-flex size-8 items-center justify-center rounded",
				pane === "search" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"
			)}
			aria-label={t("code.search")}
			pressed={pane === "search"}
			onclick={() => onpane("search")}
		>
			<Icon size="sm"><Search /></Icon>
		</Button>
		<Box class="min-w-0 flex-1"></Box>
		<Button
			class="hidden size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground md:inline-flex"
			aria-label={t("code.hideFiles")}
			title={t("code.hideFiles")}
			onclick={() => oncollapse?.()}
		>
			<Icon size="sm"><PanelLeft /></Icon>
		</Button>
	</Group>
	<Stack align="stretch" class="gap-0 p-2">
		{#if pane === "search"}
			<Input
				id="code-file-search"
				type="search"
				value={fileQuery}
				placeholder={t("code.searchPlaceholder")}
				aria-label={t("code.search")}
				class="w-full rounded border border-input bg-card px-2 py-1 text-sm"
				oninput={(event: Event) => {
					fileQuery = (event.currentTarget as HTMLInputElement).value;
				}}
			/>
		{/if}
		{#if visibleEntries.length === 0}
			<Text tag="p" class="px-2 py-2 text-sm text-muted-foreground">{t("code.searchEmpty")}</Text>
		{:else}
			{#each visibleEntries as entry (entry.id)}
				<Button
					class={cn(
						"w-full justify-start gap-2 rounded px-2 py-1 text-left text-sm",
						entry.kind === "file" && entry.path.startsWith("blocks/") && "pl-6",
						selectedPath === entry.path
							? "bg-accent text-accent-foreground"
							: "text-foreground hover:bg-accent/70"
					)}
					pressed={selectedPath === entry.path}
					title={entry.label}
					onclick={() => (entry.kind === "folder" ? ontoggle(entry.id) : onopen(entry))}
				>
					<Icon size="sm">
						{#if entry.kind === "folder"}
							{#if openFolders[entry.id]}
								<ChevronDown />
							{:else}
								<ChevronRight />
							{/if}
						{:else if entry.path.endsWith(".json")}
							<FileCode />
						{:else}
							<FileCode />
						{/if}
					</Icon>
					<Text tag="span" class="truncate">{entry.label}</Text>
				</Button>
			{/each}
		{/if}
	</Stack>
</Block>

<script lang="ts">
	import Code2 from "@lucide/svelte/icons/code-2";
	import Eye from "@lucide/svelte/icons/eye";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Text from "../../ui/text/Text.svelte";
	import Title from "../compose/Title.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import { getCurrentPage, getSelectedBlock } from "../page-store";
	import BlockTree from "./BlockTree.svelte";
	import CodePane from "./CodePane.svelte";
	import PreviewPane from "./PreviewPane.svelte";

	let { visible = true }: { visible?: boolean } = $props();

	let tab = $state<"preview" | "code">("preview");

	const page = $derived(getCurrentPage());
	const selected = $derived(getSelectedBlock());
</script>

<Block
	tag="main"
	id="main-content"
	class={cn(
		"min-h-0 min-w-0 flex-col bg-background",
		visible ? "flex flex-1" : "hidden",
		"lg:flex lg:flex-1"
	)}
>
	<Group class="shrink-0 justify-between gap-3 border-b border-border px-4 py-3">
		<Stack class="min-w-0 gap-1">
			<Title as={1} class="truncate text-lg font-semibold text-foreground">{page.title}</Title>
			<Group class="min-w-0 gap-2">
				<Text tag="span" class="truncate text-xs text-muted-foreground">{page.slug}</Text>
				{#if selected}
					<Text tag="span" class="text-xs text-muted-foreground">{t("workspace.selected")}</Text>
					<Text tag="span" class="truncate text-xs text-foreground">{selected.title}</Text>
				{/if}
			</Group>
		</Stack>
		<Group class="gap-2">
			<Button
				class={cn(
					"inline-flex items-center gap-2 rounded-default px-3 py-2 text-sm",
					tab === "preview"
						? "bg-accent text-accent-foreground"
						: "text-muted-foreground hover:bg-accent/70"
				)}
				aria-pressed={tab === "preview" ? "true" : "false"}
				onclick={() => (tab = "preview")}
			>
				<Icon size="sm"><Eye /></Icon>
				<Text tag="span">{t("workspace.preview")}</Text>
			</Button>
			<Button
				class={cn(
					"inline-flex items-center gap-2 rounded-default px-3 py-2 text-sm",
					tab === "code"
						? "bg-accent text-accent-foreground"
						: "text-muted-foreground hover:bg-accent/70"
				)}
				aria-pressed={tab === "code" ? "true" : "false"}
				onclick={() => (tab = "code")}
			>
				<Icon size="sm"><Code2 /></Icon>
				<Text tag="span">{t("workspace.code")}</Text>
			</Button>
		</Group>
	</Group>
	<Stack class="min-h-0 flex-1 lg:flex-row">
		<BlockTree />
		{#if tab === "preview"}
			<PreviewPane />
		{:else}
			<CodePane />
		{/if}
	</Stack>
</Block>

<script lang="ts">
	import { onMount } from "svelte";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import Title from "$registry/compose/Title.svelte";
	import { t } from "$lib/i18n/dictionary";
	import CodeEditor from "./editor/CodeEditor.svelte";

	let {
		title,
		description = "",
		body,
		json = false,
		onClose
	}: {
		title: string;
		description?: string;
		body: string;
		json?: boolean;
		onClose: () => void;
	} = $props();

	let copied = $state(false);

	onMount(() => {
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	async function copy() {
		try {
			await navigator.clipboard.writeText(body);
			copied = true;
			setTimeout(() => (copied = false), 1200);
		} catch {
			copied = false;
		}
	}
</script>

<Block class="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
	<Button class="absolute inset-0 h-full w-full bg-transparent" aria-label={t("modal.close")} onclick={onClose}>
		<Text tag="span" class="sr-only">{t("modal.close")}</Text>
	</Button>
	<Stack align="stretch"
		class="relative z-10 max-h-[90dvh] w-full max-w-3xl gap-4 overflow-hidden rounded-t-default border border-border bg-card p-4 sm:rounded sm:p-5"
		role="dialog"
		aria-modal="true"
		aria-label={title}
	>
		<Group class="items-start justify-between gap-3">
			<Stack align="stretch" class="gap-1">
				<Title as={2} class="text-base font-semibold text-foreground">{title}</Title>
				{#if description}
					<Text tag="p" class="text-xs text-muted-foreground">{description}</Text>
				{/if}
			</Stack>
			<Button
				class="rounded border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
				onclick={onClose}
				autofocus
			>
				<Text tag="span">{t("modal.close")}</Text>
			</Button>
		</Group>
		{#if json}
			<Block class="min-h-0 flex-1 overflow-auto rounded border border-border">
				<CodeEditor doc={body} language="json" editable={false} class="min-h-64" />
			</Block>
		{:else}
			<Text tag="pre" class="max-h-[60dvh] overflow-auto whitespace-pre-wrap text-sm text-foreground">{body}</Text>
		{/if}
		<Group class="justify-end gap-2">
			<Button
				class="rounded border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
				onclick={copy}
			>
				<Text tag="span">{copied ? t("modal.copied") : t("modal.copy")}</Text>
			</Button>
		</Group>
	</Stack>
</Block>

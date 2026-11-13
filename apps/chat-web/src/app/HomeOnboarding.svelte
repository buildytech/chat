<script lang="ts">
	import { onMount } from "svelte";
	import Block from "$registry/compose/Block.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import Title from "$registry/compose/Title.svelte";
	import { t } from "$lib/i18n/dictionary";
	import {
		ROTATION_MS,
		closeModelDialog,
		currentPlaceholder,
		getModelOpen,
		openModelDialog,
		rotatePlaceholder,
		sendBrief,
		setComposing,
		setFocused
	} from "$lib/browser/onboarding.svelte";
	import type { CreatorRuntimeStatus } from "$lib/chat-core";
	import type { GrokChatModel, SessionUsage } from "@buildytech/builder-core";
	import ChatComposer from "./ChatComposer.svelte";
	import AddModelDialog from "./AddModelDialog.svelte";

	let {
		busy = false,
		runtimeStatus = null,
		onSend,
		onCancel,
		onAddModel,
		onSelectModel,
		chatModels = [],
		selectedModelId = "",
		sessionUsage = null
	}: {
		busy?: boolean;
		runtimeStatus?: CreatorRuntimeStatus | null;
		onSend: (text: string) => void | Promise<void>;
		onCancel?: () => void;
		onAddModel?: () => void;
		onSelectModel?: (id: string) => void;
		chatModels?: readonly GrokChatModel[];
		selectedModelId?: string;
		sessionUsage?: SessionUsage | null;
	} = $props();

	let draft = $state("");
	const modelOpen = $derived(getModelOpen());
	const placeholder = $derived(currentPlaceholder());

	onMount(() => {
		const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduced) return;
		const timer = window.setInterval(() => {
			rotatePlaceholder(document.hidden, reduced);
		}, ROTATION_MS);
		return () => window.clearInterval(timer);
	});

	function submitDraft(text: string) {
		const ready = sendBrief(text);
		if (!ready.ok) return;
		onSend(ready.brief);
		draft = "";
	}
</script>

<Block tag="section" class="flex min-h-0 flex-1 flex-col bg-background" aria-label={t("empty.title")}>
	<Stack align="stretch" class="min-h-0 flex-1 overflow-y-auto">
		<Stack align="stretch" class="mx-auto w-full max-w-2xl gap-4 px-4 py-8">
			<Title as={1} class="text-2xl font-semibold text-foreground">{t("empty.title")}</Title>
			<Text tag="p" class="max-w-xl text-sm text-muted-foreground">{t("empty.subtitle")}</Text>
		</Stack>
	</Stack>
	<ChatComposer
		variant="onboarding"
		disabled={busy}
		sendDisabled={!draft.trim() || busy}
		{placeholder}
		{busy}
		{runtimeStatus}
		{chatModels}
		{selectedModelId}
		{sessionUsage}
		bind:draft
		onSend={submitDraft}
		{onCancel}
		onAddModel={() => {
			onAddModel?.();
			openModelDialog();
		}}
		{onSelectModel}
		onFocus={() => setFocused(true)}
		onBlur={() => setFocused(false)}
		onComposition={(next) => setComposing(next)}
	/>
</Block>

{#if modelOpen}
	<AddModelDialog onClose={closeModelDialog} />
{/if}

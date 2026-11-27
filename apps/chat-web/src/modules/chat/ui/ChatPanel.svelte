<script lang="ts">
	// The chat tab of the left panel: the thread of the selected project with its run state, model and usage. Stays mounted
	// while another tab is open, so the draft, scroll and a running turn survive (ADR 0024).
	import {
		abortInflightRun,
		applyProposal,
		discardProposal,
		getRuntimeStatus,
		getSelectedSession,
		sendMessage
	} from "../core";
	import { onMount } from "svelte";
	import { getSelectedModelId, listChatModels, setSelectedModelId } from "../browser/models.svelte.ts";
	import { refreshProviders } from "../browser/providers.svelte.ts";
	import ChatThread from "./ChatThread.svelte";
	import { getComposerMode } from "../core/composer-mode.svelte.ts";
	import { mediaSend } from "../media/media.svelte.ts";
	import { abortDesignTurn, designSend } from "../design/design.svelte.ts";

	let busy = $state(false);
	let modelEpoch = $state(0);

	const selected = $derived(getSelectedSession());
	const runtime = $derived(getRuntimeStatus());
	const selectedModelId = $derived.by(() => {
		void modelEpoch;
		return getSelectedModelId();
	});

	// The selector shows what the runtime's xAI key lists (one status read, no model call); a failed read changes nothing.
	onMount(() => {
		void refreshProviders().catch(() => undefined);
	});

	async function onSend(text: string) {
		busy = true;
		try {
			const mode = getComposerMode();
			if (mode === "media") await mediaSend(text);
			else if (mode === "design") await designSend(text);
			else await sendMessage(text);
		} catch {
			/* error surfaced via runtime.status */
		} finally {
			busy = false;
		}
	}

	function onCancel() {
		abortInflightRun();
		abortDesignTurn();
		busy = false;
	}

	function onSelectModel(id: string) {
		setSelectedModelId(id);
		modelEpoch += 1;
	}
</script>

<ChatThread
	session={selected}
	{busy}
	{onSend}
	{onCancel}
	{onSelectModel}
	onApply={() => applyProposal()}
	onDiscard={() => discardProposal()}
	chatModels={listChatModels()}
	{selectedModelId}
	sessionUsage={selected?.usage ?? null}
	runtimeStatus={runtime}
/>

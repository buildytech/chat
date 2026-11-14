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
	import { getSelectedModelId, listChatModels, setSelectedModelId } from "../browser/models.svelte.ts";
	import ChatThread from "./ChatThread.svelte";

	let busy = $state(false);
	let modelEpoch = $state(0);

	const selected = $derived(getSelectedSession());
	const runtime = $derived(getRuntimeStatus());
	const selectedModelId = $derived.by(() => {
		void modelEpoch;
		return getSelectedModelId();
	});

	async function onSend(text: string) {
		busy = true;
		try {
			await sendMessage(text);
		} catch {
			/* error surfaced via runtime.status */
		} finally {
			busy = false;
		}
	}

	function onCancel() {
		abortInflightRun();
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

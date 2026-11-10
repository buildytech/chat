<script lang="ts">
	import { onMount } from "svelte";
	import {
		abortInflightRun,
		applyProposal,
		applySessionFromUrl,
		createSession,
		deleteSession,
		discardProposal,
		getRuntimeStatus,
		getSelectedSession,
		hydrateSessions,
		listSessions,
		openCollectionParam,
		selectSession,
		sendMessage
	} from "$lib/chat-core";
	import { getSelectedModelId, listChatModels, setSelectedModelId } from "$lib/browser/models.svelte";
	import { installBuildyApi } from "$lib/browser/buildy-api";
	import { takeCollectionParam } from "$lib/browser/collection-intake";
	import { t } from "$lib/i18n/dictionary";
	import { theme } from "$lib/theme/theme.svelte";
	import CreatorShell from "./CreatorShell.svelte";

	let sidebarOpen = $state(false);
	let busy = $state(false);
	let modelEpoch = $state(0);

	onMount(() => {
		// Open in BuildY (?collection=, also on /build): read once before the session query is synced.
		const collection = takeCollectionParam();
		void hydrateSessions().then(() => (collection ? openCollectionParam(collection) : undefined));
		theme.init();
		installBuildyApi();
	});

	async function onPopState() {
		busy = true;
		try {
			await applySessionFromUrl();
		} finally {
			busy = false;
		}
	}

	const sessions = $derived(listSessions());
	const selected = $derived(getSelectedSession());
	const selectedId = $derived(selected?.id ?? null);
	const runtime = $derived(getRuntimeStatus());
	const chatModels = $derived(listChatModels());
	const selectedModelId = $derived.by(() => {
		void modelEpoch;
		return getSelectedModelId();
	});
	const sessionUsage = $derived(selected?.usage ?? null);

	async function onNew() {
		busy = true;
		try {
			await createSession();
			sidebarOpen = false;
		} finally {
			busy = false;
		}
	}

	async function onSelect(id: string) {
		busy = true;
		try {
			await selectSession(id);
			sidebarOpen = false;
		} finally {
			busy = false;
		}
	}

	function onDelete(id: string) {
		deleteSession(id);
	}

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

	function onApply() {
		applyProposal();
	}

	function onDiscard() {
		discardProposal();
	}
</script>

<svelte:window onpopstate={onPopState} />

<svelte:head>
	<title>{t("app.documentTitle")}</title>
</svelte:head>

<CreatorShell
	{sidebarOpen}
	{sessions}
	{selected}
	{selectedId}
	{busy}
	{runtime}
	{chatModels}
	{selectedModelId}
	{sessionUsage}
	{onNew}
	{onSelect}
	{onDelete}
	{onSend}
	{onCancel}
	{onSelectModel}
	{onApply}
	{onDiscard}
	onToggleSidebar={() => (sidebarOpen = !sidebarOpen)}
	onCloseSidebar={() => (sidebarOpen = false)}
/>

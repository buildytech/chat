<script lang="ts">
	import { onMount } from "svelte";
	import {
		createSession,
		deleteSession,
		getSelectedSession,
		hydrateSessions,
		listSessions,
		selectSession,
		sendMessage
	} from "../chat-core";
	import { t } from "../i18n/dictionary";
	import { theme } from "../theme/theme.svelte";
	import CreatorShell from "./CreatorShell.svelte";

	let sidebarOpen = $state(false);
	let busy = $state(false);

	onMount(() => {
		hydrateSessions();
		theme.init();
	});

	const sessions = $derived(listSessions());
	const selected = $derived(getSelectedSession());
	const selectedId = $derived(selected?.id ?? null);

	function onNew() {
		createSession();
		sidebarOpen = false;
	}

	function onSelect(id: string) {
		selectSession(id);
		sidebarOpen = false;
	}

	function onDelete(id: string) {
		deleteSession(id);
	}

	async function onSend(text: string) {
		busy = true;
		try {
			await sendMessage(text);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{t("app.documentTitle")}</title>
</svelte:head>

<CreatorShell
	{sidebarOpen}
	{sessions}
	{selected}
	{selectedId}
	{busy}
	{onNew}
	{onSelect}
	{onDelete}
	{onSend}
	onToggleSidebar={() => (sidebarOpen = !sidebarOpen)}
	onCloseSidebar={() => (sidebarOpen = false)}
/>

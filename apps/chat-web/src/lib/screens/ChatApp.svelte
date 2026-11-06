<script lang="ts">
	import { onMount } from "svelte";
	import {
		createSession,
		deleteSession,
		getRuntimeStatus,
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
		void hydrateSessions();
		theme.init();
	});

	const sessions = $derived(listSessions());
	const selected = $derived(getSelectedSession());
	const selectedId = $derived(selected?.id ?? null);
	const runtime = $derived(getRuntimeStatus());

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
	{runtime}
	{onNew}
	{onSelect}
	{onDelete}
	{onSend}
	onToggleSidebar={() => (sidebarOpen = !sidebarOpen)}
	onCloseSidebar={() => (sidebarOpen = false)}
/>

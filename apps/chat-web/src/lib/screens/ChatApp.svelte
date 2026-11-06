<script lang="ts">
	import { onMount } from "svelte";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import {
		createSession,
		deleteSession,
		getSelectedSession,
		hydrateSessions,
		listSessions,
		selectSession,
		sendMessage
	} from "../api/session.svelte";
	import { t } from "../i18n/dictionary";
	import { theme } from "../theme/theme.svelte";
	import ChatDrawer from "./ChatDrawer.svelte";
	import ChatNav from "./ChatNav.svelte";
	import ChatThread from "./ChatThread.svelte";

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

<Block class="flex h-dvh min-h-0 flex-col bg-background text-foreground">
	<ChatNav
		{sidebarOpen}
		isDark={theme.isDark}
		onToggleSidebar={() => (sidebarOpen = !sidebarOpen)}
		onToggleTheme={() => theme.toggle()}
	/>
	<Group class="relative min-h-0 flex-1 items-stretch">
		<ChatDrawer
			open={sidebarOpen}
			{sessions}
			{selectedId}
			{onNew}
			{onSelect}
			{onDelete}
			onClose={() => (sidebarOpen = false)}
		/>
		<ChatThread session={selected} {busy} {onSend} />
	</Group>
</Block>

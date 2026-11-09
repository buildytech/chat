<script lang="ts">
	import Menu from "@lucide/svelte/icons/menu";
	import X from "@lucide/svelte/icons/x";
	import Group from "../compose/Group.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { getCurrentPage } from "../page-store";

	let {
		sidebarOpen = false,
		onToggleSidebar
	}: {
		sidebarOpen?: boolean;
		onToggleSidebar?: () => void;
	} = $props();

	const page = $derived(getCurrentPage());
	const pageTitle = $derived(page?.title?.trim() ? page.title : t("thread.untitled"));
</script>

<Group
	class="w-full shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3"
	role="toolbar"
	aria-label={t("shell.topBar")}
	data-block="creator-top-bar"
>
	<Group class="min-w-0 items-center gap-2">
		<Button
			class="inline-flex size-8 items-center justify-center rounded-default text-foreground hover:bg-accent"
			aria-label={sidebarOpen ? t("sidebar.close") : t("shell.sidebarToggle")}
			aria-expanded={sidebarOpen ? "true" : "false"}
			aria-controls="chat-sidebar-drawer"
			onclick={onToggleSidebar}
		>
			<Icon size="sm">
				{#if sidebarOpen}
					<X />
				{:else}
					<Menu />
				{/if}
			</Icon>
		</Button>
		<Text tag="span" class="truncate font-semibold text-foreground">{pageTitle}</Text>
	</Group>
</Group>

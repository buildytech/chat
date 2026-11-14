<!-- The chat search field of the sidebar (Ctrl+K): filters the Recents list by title or id. -->
<script lang="ts">
	import { X } from "$lib/shell-icons";
	import Group from "$registry/compose/Group.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Input from "$registry/kit/ui/input/Input.svelte";
	import { t } from "$lib/i18n/dictionary";

	let { value = $bindable(""), onclose }: { value?: string; onclose: () => void } = $props();
</script>

<Group class="items-center gap-2">
	<Input
		id="sidebar-chat-search"
		type="search"
		{value}
		placeholder={t("sidebar.searchPlaceholder")}
		aria-label={t("sidebar.search")}
		class="h-8 min-w-0 flex-1 rounded border border-input bg-card px-2 text-xs"
		oninput={(event: Event) => (value = (event.currentTarget as HTMLInputElement).value)}
	/>
	<Button
		class="inline-flex size-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent"
		aria-label={t("sidebar.closeSearch")}
		title={t("sidebar.closeSearch")}
		onclick={onclose}><Icon size="sm"><X /></Icon></Button
	>
</Group>

<script lang="ts">
	import Menu from "@lucide/svelte/icons/menu";
	import Moon from "@lucide/svelte/icons/moon";
	import Sun from "@lucide/svelte/icons/sun";
	import X from "@lucide/svelte/icons/x";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";

	let {
		sidebarOpen,
		isDark,
		onToggleSidebar,
		onToggleTheme
	}: {
		sidebarOpen: boolean;
		isDark: boolean;
		onToggleSidebar: () => void;
		onToggleTheme: () => void;
	} = $props();
</script>

<Block
	tag="header"
	class="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:hidden"
>
	<Group class="gap-2">
		<Button
			class="rounded-default p-2 text-foreground hover:bg-accent"
			aria-label={sidebarOpen ? t("sidebar.close") : t("sidebar.open")}
			aria-expanded={sidebarOpen ? "true" : "false"}
			aria-controls="chat-sidebar-drawer"
			onclick={onToggleSidebar}
		>
			<Icon size="md">
				{#if sidebarOpen}
					<X />
				{:else}
					<Menu />
				{/if}
			</Icon>
		</Button>
		<Text tag="span" class="text-sm font-semibold">{t("nav.brand")}</Text>
	</Group>
	<Button
		class="rounded-default p-2 text-foreground hover:bg-accent"
		aria-label={isDark ? t("theme.toLight") : t("theme.toDark")}
		onclick={onToggleTheme}
	>
		<Icon size="md">
			{#if isDark}
				<Sun />
			{:else}
				<Moon />
			{/if}
		</Icon>
	</Button>
</Block>

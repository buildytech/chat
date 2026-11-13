<script lang="ts">
import { Menu, Moon, Sun, X } from "$lib/shell-icons";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";

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
	class="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:hidden"
>
	<Group class="gap-2">
		<Button
			class="rounded p-2 text-foreground hover:bg-accent"
			aria-label={sidebarOpen ? t("sidebar.close") : t("sidebar.open")}
			expanded={sidebarOpen}
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
		class="rounded p-2 text-foreground hover:bg-accent"
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

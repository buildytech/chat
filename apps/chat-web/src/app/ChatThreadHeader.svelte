<script lang="ts">
	import Moon from "@lucide/svelte/icons/moon";
	import Sun from "@lucide/svelte/icons/sun";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Title from "$registry/compose/Title.svelte";
	import { t } from "$lib/i18n/dictionary";

	let {
		title,
		isDark,
		onToggleTheme
	}: {
		title: string;
		isDark: boolean;
		onToggleTheme: () => void;
	} = $props();
</script>

<Block tag="header" class="flex h-10 items-center justify-between border-b border-border px-2">
	<Title as={2} class="truncate text-base font-semibold text-foreground">{title}</Title>
	<Group class="hidden lg:flex">
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
	</Group>
</Block>

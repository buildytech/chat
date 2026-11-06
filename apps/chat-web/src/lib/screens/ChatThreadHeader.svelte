<script lang="ts">
	import Moon from "@lucide/svelte/icons/moon";
	import Sun from "@lucide/svelte/icons/sun";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Title from "../compose/Title.svelte";
	import { t } from "../i18n/dictionary";

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

<Block tag="header" class="flex items-center justify-between border-b border-border px-4 py-4 md:px-8">
	<Title as={1} class="text-lg font-semibold text-foreground">{title}</Title>
	<Group class="hidden md:flex">
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
	</Group>
</Block>

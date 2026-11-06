<script lang="ts">
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import Menu from "@lucide/svelte/icons/menu";
	import Share2 from "@lucide/svelte/icons/share-2";
	import Upload from "@lucide/svelte/icons/upload";
	import X from "@lucide/svelte/icons/x";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Text from "../../ui/text/Text.svelte";
	import Title from "../compose/Title.svelte";
	import { t } from "../i18n/dictionary";
	import { getCurrentPage } from "../page-store";

	let {
		sidebarOpen = false,
		onToggleSidebar,
		onPublish
	}: {
		sidebarOpen?: boolean;
		onToggleSidebar?: () => void;
		onPublish?: () => void;
	} = $props();

	const page = $derived(getCurrentPage());
	let published = $state(false);
	let confirmOpen = $state(false);

	function confirmPublish() {
		published = true;
		confirmOpen = false;
		onPublish?.();
	}
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
		<Button
			class="inline-flex max-w-[10rem] items-center gap-2 rounded-default px-2 py-1.5 text-sm text-foreground hover:bg-accent max-md:hidden"
			disabled
			title={t("shell.workspaceSoon")}
		>
			<Text tag="span" class="truncate font-medium">{t("shell.workspace")}</Text>
			<Icon size="sm" class="text-muted-foreground"><ChevronDown /></Icon>
		</Button>
		<Text tag="span" class="text-muted-foreground max-md:hidden" aria-hidden="true">/</Text>
		<Button
			class="inline-flex max-w-[14rem] items-center gap-2 rounded-default px-2 py-1.5 text-sm text-foreground hover:bg-accent"
			disabled
			title={t("shell.projectSoon")}
		>
			<Text tag="span" class="truncate font-semibold">{page.title}</Text>
			<Icon size="sm" class="text-muted-foreground"><ChevronDown /></Icon>
		</Button>
	</Group>
	<Group class="items-center gap-2">
		<Button
			class="inline-flex size-8 items-center justify-center rounded-default border border-border text-foreground hover:bg-accent"
			aria-label={t("shell.share")}
			disabled
			title={t("shell.shareSoon")}
		>
			<Icon size="sm"><Share2 /></Icon>
		</Button>
		<Button
			class="inline-flex items-center gap-2 rounded-default bg-foreground px-3 py-1.5 text-sm text-background hover:bg-foreground/90 max-md:size-8 max-md:justify-center max-md:px-0"
			aria-label={t("shell.publish")}
			onclick={() => (confirmOpen = true)}
		>
			<Icon size="sm"><Upload /></Icon>
			<Text tag="span" class="max-md:hidden">{published ? t("shell.published") : t("shell.publish")}</Text>
		</Button>
		<Block
			class="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground"
			aria-label={t("shell.avatar")}
		>
			<Text tag="span">SI</Text>
		</Block>
	</Group>
</Group>

{#if confirmOpen}
	<Block class="fixed inset-0 z-40 flex items-center justify-center bg-foreground/30 p-4">
		<Stack class="w-full max-w-sm gap-4 rounded-default border border-border bg-card p-5 shadow-lg">
			<Title as={2} class="text-base font-semibold text-foreground">
				{t("shell.publishConfirm").replace("{title}", page.title)}
			</Title>
			<Text tag="p" class="text-sm text-muted-foreground">{t("shell.publishConfirmBody")}</Text>
			<Group class="justify-end gap-2">
				<Button
					class="rounded-default border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
					onclick={() => (confirmOpen = false)}
				>
					<Text tag="span">{t("shell.publishCancel")}</Text>
				</Button>
				<Button
					class="rounded-default bg-foreground px-3 py-1.5 text-sm text-background hover:bg-foreground/90"
					onclick={confirmPublish}
				>
					<Text tag="span">{t("shell.publish")}</Text>
				</Button>
			</Group>
		</Stack>
	</Block>
{/if}

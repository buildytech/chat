<script lang="ts">
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronUp from "@lucide/svelte/icons/chevron-up";
	import Circle from "@lucide/svelte/icons/circle";
	import House from "@lucide/svelte/icons/house";
	import PanelLeft from "@lucide/svelte/icons/panel-left";
	import Search from "@lucide/svelte/icons/search";
	import Settings from "@lucide/svelte/icons/settings";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import Zap from "@lucide/svelte/icons/zap";
	import type { Component } from "svelte";
	import Block from "../compose/Block.svelte";
	import Box from "../../ui/box/Box.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Input from "../../ui/input/Input.svelte";
	import Separator from "../../ui/separator/Separator.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { theme } from "../theme/theme.svelte";
	import { cn } from "../../utils/cn";
	import { deleteAllSessions, type SessionSummary } from "../chat-core";
	import { getSelectedModelId, listChatModels, setSelectedModelId } from "../browser/models.svelte";
	import ConfirmDialog from "./ConfirmDialog.svelte";

	type NavItem = {
		id: string;
		label: string;
		icon: Component;
		kbd?: string;
	};

	let {
		sessions,
		selectedId,
		onNew,
		onSelect,
		onDelete,
		onToggle,
		collapsed = false,
		canDelete = false
	}: {
		sessions: SessionSummary[];
		selectedId: string | null;
		onNew: () => void | Promise<void>;
		onSelect: (id: string) => void | Promise<void>;
		onDelete: (id: string) => void;
		onToggle?: () => void;
		collapsed?: boolean;
		canDelete?: boolean;
	} = $props();

	let active = $state("home");
	let recentsOpen = $state(true);
	let searchOpen = $state(false);
	let searchDraft = $state("");
	let settingsOpen = $state(false);
	let storageNote = $state("");
	let pendingDelete = $state<{ kind: "one"; id: string; title: string } | { kind: "all" } | null>(null);
	const chatModels = listChatModels();
	const selectedModelId = $derived(getSelectedModelId());

	const mainItems: NavItem[] = [
		{ id: "home", label: t("sidebar.home"), icon: House },
		{ id: "search", label: t("sidebar.search"), icon: Search, kbd: t("sidebar.searchKbd") }
	];

	const visibleSessions = $derived.by(() => {
		const needle = searchDraft.trim().toLowerCase();
		if (!needle) return sessions;
		return sessions.filter(
			(session) => session.title.toLowerCase().includes(needle) || session.id.toLowerCase().includes(needle)
		);
	});

	function pick(id: string) {
		active = id;
		if (id === "search") {
			searchOpen = true;
			queueMicrotask(() => document.getElementById("sidebar-chat-search")?.focus());
			return;
		}
		searchOpen = false;
		if (id === "settings") {
			settingsOpen = !settingsOpen;
			if (settingsOpen) {
				queueMicrotask(() => document.getElementById("creator-settings-model")?.focus());
			}
		}
	}

	function pickRecent(id: string) {
		active = id;
		onSelect(id);
	}

	function onSearchKey(event: KeyboardEvent) {
		if (pendingDelete) return;
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
			event.preventDefault();
			pick("search");
		}
		if (event.key === "Escape") {
			if (searchOpen) {
				searchOpen = false;
				searchDraft = "";
				active = "home";
				event.preventDefault();
			} else if (settingsOpen) {
				settingsOpen = false;
				active = "home";
				event.preventDefault();
			}
		}
	}

	function requestDelete(session: SessionSummary) {
		pendingDelete = { kind: "one", id: session.id, title: session.title };
	}

	function confirmPendingDelete() {
		if (!pendingDelete) return;
		if (pendingDelete.kind === "all") {
			deleteAllSessions();
			storageNote = t("sidebar.cleared");
		} else {
			onDelete(pendingDelete.id);
		}
		pendingDelete = null;
	}
</script>

<svelte:window onkeydown={onSearchKey} />

<Block
	tag="aside"
	class="flex h-full w-[248px] shrink-0 flex-col justify-between overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:w-[var(--creator-nav-w,248px)]"
	aria-label={t("sidebar.mainNav")}
	data-nav={collapsed ? "collapsed" : "expanded"}
>
	<Stack class="gap-3 p-3 in-data-[nav=collapsed]:items-center in-data-[nav=collapsed]:p-2">
		<Group class="justify-between gap-2 in-data-[nav=collapsed]:flex-col in-data-[nav=collapsed]:items-center">
			<Group class="min-w-0 gap-2 in-data-[nav=collapsed]:hidden">
				<Box
					class="flex size-8 items-center justify-center rounded-default bg-primary text-xs font-semibold text-primary-foreground"
					aria-hidden="true"
				>
					<Text tag="span">{t("sidebar.brandMark")}</Text>
				</Box>
				<Text tag="span" class="truncate text-sm font-semibold">{t("sidebar.brand")}</Text>
			</Group>
			<Group class="gap-1 in-data-[nav=collapsed]:flex-col">
				<Button
					class="inline-flex size-8 items-center justify-center rounded-default text-muted-foreground hover:bg-accent hover:text-foreground"
					aria-label={t("sidebar.newChat")}
					title={t("sidebar.newChat")}
					onclick={onNew}
				>
					<Icon size="sm"><Zap /></Icon>
				</Button>
				<Button
					class="inline-flex size-8 items-center justify-center rounded-default text-muted-foreground hover:bg-accent hover:text-foreground"
					aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
					aria-expanded={collapsed ? "false" : "true"}
					title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
					onclick={onToggle}
				>
					<Icon size="sm"><PanelLeft /></Icon>
				</Button>
			</Group>
		</Group>

		<Stack class="gap-1 in-data-[nav=collapsed]:items-center" tag="nav" aria-label={t("sidebar.mainNav")}>
			{#each mainItems as item (item.id)}
				<Button
					class={cn(
						"w-full justify-start gap-2 rounded-default px-3 py-2 text-sm",
						"in-data-[nav=collapsed]:size-8 in-data-[nav=collapsed]:justify-center in-data-[nav=collapsed]:px-0 in-data-[nav=collapsed]:py-0",
						active === item.id
							? "bg-accent text-accent-foreground"
							: "text-foreground hover:bg-accent/70"
					)}
					aria-pressed={active === item.id ? "true" : "false"}
					aria-expanded={item.id === "search" ? (searchOpen ? "true" : "false") : undefined}
					aria-controls={item.id === "search" ? "sidebar-chat-search" : undefined}
					title={item.label}
					onclick={() => pick(item.id)}
				>
					<Group class="min-w-0 w-full justify-between gap-2 in-data-[nav=collapsed]:w-auto in-data-[nav=collapsed]:justify-center">
						<Group class="min-w-0 gap-2 in-data-[nav=collapsed]:gap-0">
							<Icon size="sm"><item.icon /></Icon>
							<Text tag="span" class="truncate in-data-[nav=collapsed]:hidden">{item.label}</Text>
						</Group>
						{#if item.kbd}
							<Text
								tag="span"
								class="rounded-default border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground in-data-[nav=collapsed]:hidden"
							>
								{item.kbd}
							</Text>
						{/if}
					</Group>
				</Button>
			{/each}
		</Stack>

		{#if !collapsed}
		{#if searchOpen}
			<Stack class="gap-1 px-1">
				<Input
					id="sidebar-chat-search"
					type="search"
					value={searchDraft}
					placeholder={t("sidebar.searchPlaceholder")}
					aria-label={t("sidebar.search")}
					class="w-full rounded-default border border-input bg-card px-3 py-1.5 text-sm"
					oninput={(event: Event) => {
						searchDraft = (event.currentTarget as HTMLInputElement).value;
					}}
				/>
			</Stack>
		{/if}

		<Stack class="gap-1">
			<Button
				class="w-full justify-between rounded-default px-3 py-2 text-sm text-muted-foreground hover:bg-accent/70 hover:text-foreground"
				aria-expanded={recentsOpen ? "true" : "false"}
				aria-controls="creator-recents"
				onclick={() => (recentsOpen = !recentsOpen)}
			>
				<Text tag="span">{t("sidebar.recents")}</Text>
				<Icon size="sm">
					{#if recentsOpen}
						<ChevronUp />
					{:else}
						<ChevronDown />
					{/if}
				</Icon>
			</Button>
			<Stack id="creator-recents" class="min-h-0 gap-1" hidden={!recentsOpen}>
				{#if visibleSessions.length === 0}
					<Text tag="p" class="px-3 py-2 text-sm text-muted-foreground">
						{searchDraft.trim() ? t("sidebar.noMatches") : t("sidebar.empty")}
					</Text>
				{:else}
					{#each visibleSessions as session (session.id)}
						<Group class="gap-1">
							<Button
								class={cn(
									"min-w-0 flex-1 justify-start gap-2 rounded-default px-3 py-2 text-left text-sm",
									selectedId === session.id || active === session.id
										? "bg-accent text-accent-foreground"
										: "text-foreground hover:bg-accent/70"
								)}
								onclick={() => pickRecent(session.id)}
							>
								<Icon size="sm"><Circle /></Icon>
								<Text tag="span" class="truncate">{session.title}</Text>
							</Button>
							<Button
								class="shrink-0 rounded-default p-2 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-40"
								aria-label={t("sidebar.delete")}
								aria-haspopup="dialog"
								disabled={!canDelete}
								title={canDelete ? t("sidebar.delete") : t("sidebar.deleteUnavailable")}
								onclick={() => canDelete && requestDelete(session)}
							>
								<Icon size="sm"><Trash2 /></Icon>
							</Button>
						</Group>
					{/each}
				{/if}
			</Stack>
		</Stack>
		{/if}
	</Stack>

	<Stack class="gap-1 p-3 in-data-[nav=collapsed]:items-center in-data-[nav=collapsed]:p-2" tag="nav" aria-label={t("sidebar.preferences")}>
		<Separator class="in-data-[nav=collapsed]:hidden" />
		<Button
			class={cn(
				"w-full justify-start gap-2 rounded-default px-3 py-2 text-sm",
				"in-data-[nav=collapsed]:size-8 in-data-[nav=collapsed]:justify-center in-data-[nav=collapsed]:px-0 in-data-[nav=collapsed]:py-0",
				active === "settings" ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/70"
			)}
			title={t("sidebar.settings")}
			aria-expanded={settingsOpen ? "true" : "false"}
			aria-controls="creator-settings"
			onclick={() => {
				settingsOpen = !settingsOpen;
				active = settingsOpen ? "settings" : "home";
				if (settingsOpen) {
					queueMicrotask(() => document.getElementById("creator-settings-model")?.focus());
				}
			}}
		>
			<Icon size="sm"><Settings /></Icon>
			<Text tag="span" class="in-data-[nav=collapsed]:hidden">{t("sidebar.settings")}</Text>
		</Button>
		{#if settingsOpen && !collapsed}
			<Stack
				id="creator-settings"
				class="gap-2 rounded-default border border-border p-2"
				role="region"
				aria-label={t("sidebar.settingsRegion")}
			>
				<Text tag="p" class="text-xs text-muted-foreground">{t("sidebar.settingsHint")}</Text>
				<Text tag="p" class="text-xs font-medium text-foreground">{t("sidebar.settingsModel")}</Text>
				{#each chatModels as model, index (model.id)}
					<Button
						id={index === 0 ? "creator-settings-model" : undefined}
						class={cn(
							"w-full justify-start rounded-default px-2 py-1.5 text-left text-sm hover:bg-accent/70",
							model.id === selectedModelId ? "bg-accent text-accent-foreground" : "text-foreground"
						)}
						aria-pressed={model.id === selectedModelId ? "true" : "false"}
						onclick={() => setSelectedModelId(model.id)}
					>
						{model.label}
					</Button>
				{/each}
				<Button
					class="w-full justify-start rounded-default px-2 py-1.5 text-sm text-foreground hover:bg-accent/70"
					onclick={() => theme.toggle()}
				>
					{theme.isDark ? t("sidebar.useLight") : t("sidebar.useDark")}
				</Button>
				<Button
					class="w-full justify-start rounded-default px-2 py-1.5 text-sm text-destructive hover:bg-accent/70"
					aria-haspopup="dialog"
					onclick={() => (pendingDelete = { kind: "all" })}
				>
					{t("sidebar.clearStorage")}
				</Button>
				{#if storageNote}
					<Text tag="p" class="text-xs text-muted-foreground">{storageNote}</Text>
				{/if}
			</Stack>
		{/if}
		<Group class="justify-between gap-2 rounded-default px-3 py-2 in-data-[nav=collapsed]:justify-center in-data-[nav=collapsed]:px-0">
			<Group class="gap-2 in-data-[nav=collapsed]:gap-0">
				<Button
					class="relative h-5 w-9 rounded-full border border-border bg-muted p-0"
					role="switch"
					aria-checked={theme.isDark ? "true" : "false"}
					aria-label={t("sidebar.nightMode")}
					title={t("sidebar.nightMode")}
					onclick={() => theme.toggle()}
				>
					<Box
						class={cn(
							"absolute top-0.5 size-4 rounded-full bg-foreground transition-[left]",
							theme.isDark ? "left-4" : "left-0.5"
						)}
					></Box>
				</Button>
				<Text tag="span" class="text-sm in-data-[nav=collapsed]:hidden">{t("sidebar.nightMode")}</Text>
			</Group>
		</Group>
	</Stack>
</Block>

{#if pendingDelete}
	<ConfirmDialog
		title={pendingDelete.kind === "all" ? t("sidebar.deleteAllConfirmTitle") : t("sidebar.deleteConfirmTitle")}
		description={pendingDelete.kind === "all" ? t("sidebar.deleteAllConfirmBody") : t("sidebar.deleteConfirmBody")}
		confirmLabel={pendingDelete.kind === "all" ? t("sidebar.clearStorage") : t("sidebar.deleteConfirm")}
		onConfirm={confirmPendingDelete}
		onClose={() => (pendingDelete = null)}
	/>
{/if}

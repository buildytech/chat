<script lang="ts">
	import Boxes from "@lucide/svelte/icons/boxes";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronUp from "@lucide/svelte/icons/chevron-up";
	import Circle from "@lucide/svelte/icons/circle";
	import X from "@lucide/svelte/icons/x";
	import Search from "@lucide/svelte/icons/search";
	import Settings from "@lucide/svelte/icons/settings";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import MessageSquarePlus from "@lucide/svelte/icons/message-square-plus";
	import { tick, type Component } from "svelte";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Input from "$registry/kit/ui/input/Input.svelte";
	import Separator from "$registry/kit/ui/separator/Separator.svelte";
	import Title from "$registry/compose/Title.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { UI_LOCALES } from "$lib/i18n/locale-pref";
	import { uiLocale } from "$lib/i18n/locale.svelte";
	import { theme } from "$lib/theme/theme.svelte";
	import { THEME_PREFS } from "$lib/theme/theme-pref";
	import { cn } from "$registry/utils/cn";
	import { deleteAllSessions, type SessionSummary } from "$lib/chat-core";
	import ConfirmDialog from "./ConfirmDialog.svelte";
	import SettingsSessionFile from "./SettingsSessionFile.svelte";
	import SettingsThemeImport from "./SettingsThemeImport.svelte";
	import Checkbox from "$registry/compose/Checkbox.svelte";
	import Label from "$registry/compose/Label.svelte";
	import { previewSettings } from "$lib/browser/preview-settings.svelte";
	import { creatorLayout } from "$lib/creator-layout.svelte";
	import { PANE_RANGE } from "$lib/layout/prefs";

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
		onClose,
		collapsed = false,
		canDelete = false,
	}: {
		sessions: SessionSummary[];
		selectedId: string | null;
		onNew: () => void | Promise<void>;
		onSelect: (id: string) => void | Promise<void>;
		onDelete: (id: string) => void;
		onClose?: () => void;
		collapsed?: boolean;
		canDelete?: boolean;
	} = $props();

	let active = $state("");
	let recentsOpen = $state(true);
	let searchOpen = $state(false);
	let searchDraft = $state("");
	let settingsOpen = $state(false);
	let storageNote = $state("");
	let pendingDelete = $state<{ kind: "one"; id: string; title: string } | { kind: "all" } | null>(null);
	const mainItems = $derived<NavItem[]>([
		{ id: "search", label: t("sidebar.search"), icon: Search, kbd: t("sidebar.searchKbd") },
	]);

	const visibleSessions = $derived.by(() => {
		const needle = searchDraft.trim().toLowerCase();
		if (!needle) return sessions;
		return sessions.filter(
			(session) => session.title.toLowerCase().includes(needle) || session.id.toLowerCase().includes(needle),
		);
	});

	async function pick(id: string) {
		active = id;
		if (id === "search") {
			if (collapsed) creatorLayout.setCollapsed("nav", false);
			searchOpen = true;
			await tick();
			document.getElementById("sidebar-chat-search")?.focus();
		}
	}

	function closeSearch() {
		searchOpen = false;
		searchDraft = "";
		active = "";
		document.getElementById("sidebar-search-trigger")?.focus();
	}

	function closeSettings() {
		settingsOpen = false;
		active = "";
		document.getElementById("creator-settings-trigger")?.focus();
	}

	async function toggleSettings() {
		if (settingsOpen && !collapsed) {
			closeSettings();
			return;
		}
		if (collapsed) creatorLayout.setCollapsed("nav", false);
		settingsOpen = true;
		active = "settings";
		await tick();
		document.getElementById("creator-settings-close")?.focus();
	}

	function pickRecent(id: string) {
		active = id;
		onSelect(id);
	}

	function onSearchKey(event: KeyboardEvent) {
		if (pendingDelete || event.defaultPrevented || document.querySelector('[role="dialog"], dialog[open]')) return;
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
			event.preventDefault();
			pick("search");
		}
		if (event.key === "Escape") {
			if (searchOpen) {
				closeSearch();
				event.preventDefault();
			} else if (settingsOpen) {
				closeSettings();
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

	// Keyboard focus inside the scrolling Settings region: show the whole control, not only its caret (a tall textarea
	// was left half clipped by the browser's own focus scroll at 1024x640).
	function revealFocused(event: FocusEvent) {
		(event.target as HTMLElement | null)?.scrollIntoView?.({ block: "nearest" });
	}
</script>

<svelte:window onkeydown={onSearchKey} />

<Block
	tag="aside"
	class="flex h-full shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
	style={`width: ${creatorLayout.columns ? creatorLayout.widths.nav : PANE_RANGE.nav.default}px`}
	aria-label={t("sidebar.mainNav")}
	data-nav={collapsed ? "collapsed" : "expanded"}
>
	<Group class="h-10 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-2 in-data-[nav=collapsed]:justify-center">
		<Group class="min-w-0 items-center gap-2 in-data-[nav=collapsed]:hidden">
			<Icon size="sm"><Boxes /></Icon>
			<Text tag="span" class="truncate text-sm font-semibold">{t("sidebar.brand")}</Text>
		</Group>
		<Group class="items-center gap-0">
			<Button
				class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
				aria-label={t("sidebar.newChat")}
				title={t("sidebar.newChat")}
				onclick={onNew}
			>
				<Icon size="sm"><MessageSquarePlus /></Icon>
			</Button>
			{#if onClose}
				<Button class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent lg:hidden" aria-label={t("sidebar.close")} title={t("sidebar.close")} data-action="nav-close" onclick={onClose}>
					<Icon size="sm"><X /></Icon>
				</Button>
			{/if}
		</Group>
	</Group>
	<Stack align="stretch" class="min-h-0 flex-1 gap-2 overflow-y-auto p-2 in-data-[nav=collapsed]:items-center">
		<Stack
			align="stretch"
			class="gap-0 in-data-[nav=collapsed]:items-center"
			tag="nav"
			aria-label={t("sidebar.mainNav")}
		>
			{#each mainItems as item (item.id)}
				<Button
					id="sidebar-search-trigger"
					class={cn(
						"flex w-full items-center justify-start gap-2 rounded px-2 py-1 text-sm",
						"in-data-[nav=collapsed]:size-8 in-data-[nav=collapsed]:justify-center in-data-[nav=collapsed]:px-0 in-data-[nav=collapsed]:py-0",
						searchOpen && !collapsed ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/70",
					)}
					pressed={searchOpen && !collapsed}
					expanded={item.id === "search" ? searchOpen : undefined}
					aria-controls={item.id === "search" ? "sidebar-chat-search" : undefined}
					title={item.label}
					onclick={() => pick(item.id)}
				>
					<Group
						class="min-w-0 w-full justify-between gap-2 in-data-[nav=collapsed]:w-auto in-data-[nav=collapsed]:justify-center"
					>
						<Group class="min-w-0 gap-2 in-data-[nav=collapsed]:gap-0">
							<Icon size="sm"><item.icon /></Icon>
							<Text tag="span" class="truncate in-data-[nav=collapsed]:hidden">{item.label}</Text>
						</Group>
						{#if item.kbd}
							<Text
								tag="span"
								class="rounded border border-border px-2 text-xs text-muted-foreground in-data-[nav=collapsed]:hidden"
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
				<Group class="items-center gap-2">
					<Input
						id="sidebar-chat-search"
						type="search"
						value={searchDraft}
						placeholder={t("sidebar.searchPlaceholder")}
						aria-label={t("sidebar.search")}
						class="h-8 min-w-0 flex-1 rounded border border-input bg-card px-2 text-xs"
						oninput={(event: Event) => {
							searchDraft = (event.currentTarget as HTMLInputElement).value;
						}}
					/>
					<Button
						class="inline-flex size-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent"
						aria-label={t("sidebar.closeSearch")}
						title={t("sidebar.closeSearch")}
						onclick={closeSearch}><Icon size="sm"><X /></Icon></Button
					>
				</Group>
			{/if}

			<Stack align="stretch" class="gap-0">
				<Button
					class="flex w-full items-center justify-between rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent/70 hover:text-foreground"
					expanded={recentsOpen}
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
				<Stack align="stretch" id="creator-recents" class="min-h-0 gap-1" hidden={!recentsOpen}>
					{#if visibleSessions.length === 0}
						<Text tag="p" class="px-2 py-2 text-sm text-muted-foreground">
							{searchDraft.trim() ? t("sidebar.noMatches") : t("sidebar.empty")}
						</Text>
					{:else}
						{#each visibleSessions as session (session.id)}
							<Group class="relative min-w-0 gap-0" data-slot="recent-row">
								<Button
									class={cn(
										"flex min-w-0 flex-1 items-center justify-start gap-2 rounded py-1 pl-2 pr-10 text-left text-sm",
										selectedId === session.id || active === session.id
											? "bg-accent text-accent-foreground"
											: "text-foreground hover:bg-accent/70",
									)}
									onclick={() => pickRecent(session.id)}
								>
									<Icon size="sm"><Circle /></Icon>
									<Text tag="span" class="min-w-0 truncate">{session.title}</Text>
								</Button>
								<Button
									class="absolute right-0 top-0 shrink-0 rounded p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
									aria-label={t("sidebar.delete")}
									aria-haspopup="dialog"
									data-action="recent-delete"
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

	<!-- Preferences: at most 3/4 of the sidebar; an open Settings region scrolls on its own (ADR 0025, compact IDE density). -->
	<Stack
		align="stretch"
		class="max-h-3/4 min-h-0 shrink-0 gap-2 p-2 in-data-[nav=collapsed]:items-center"
		tag="nav"
		aria-label={t("sidebar.preferences")}
		data-slot="sidebar-preferences"
	>
		<Separator class="in-data-[nav=collapsed]:hidden" />
		<Button
			id="creator-settings-trigger"
			class={cn(
				"flex w-full items-center justify-start gap-2 rounded px-2 py-1 text-sm",
				"in-data-[nav=collapsed]:size-8 in-data-[nav=collapsed]:justify-center in-data-[nav=collapsed]:px-0 in-data-[nav=collapsed]:py-0",
				settingsOpen && !collapsed ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/70",
			)}
			title={t("sidebar.settings")}
			expanded={settingsOpen && !collapsed}
			aria-controls="creator-settings"
			onclick={toggleSettings}
		>
			<Icon size="sm"><Settings /></Icon>
			<Text tag="span" class="in-data-[nav=collapsed]:hidden">{t("sidebar.settings")}</Text>
		</Button>
		{#if settingsOpen && !collapsed}
			<Stack
				align="stretch"
				id="creator-settings"
				class="min-h-0 shrink gap-2 overflow-y-auto overscroll-contain rounded border border-border p-2 text-xs"
				role="region"
				tabindex={-1}
				aria-label={t("sidebar.settingsRegion")}
				data-slot="settings-region"
				onfocusin={revealFocused}
			>
				<Group class="sticky top-0 z-10 items-center justify-between gap-2 bg-card">
					<Title as={2} class="text-xs font-semibold">{t("sidebar.settings")}</Title>
					<Button
						id="creator-settings-close"
						class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
						aria-label={t("sidebar.closeSettings")}
						title={t("sidebar.closeSettings")}
						onclick={closeSettings}><Icon size="sm"><X /></Icon></Button
					>
				</Group>
				<!-- The chat UI theme (ADR 0026): system / dark / light; the preview keeps its own skin. -->
				<Text tag="p" class="text-xs font-medium text-foreground" id="creator-settings-theme-label"
					>{t("settings.theme")}</Text
				>
				<Group
					class="items-center gap-1 rounded-full bg-muted p-1"
					role="group"
					aria-labelledby="creator-settings-theme-label"
					data-slot="settings-theme"
				>
					{#each THEME_PREFS as option (option)}
						<Button
							class={cn(
								"flex-1 rounded-full px-2 py-1 text-xs",
								theme.pref === option
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
							pressed={theme.pref === option}
							data-action={`theme-${option}`}
							onclick={() => theme.setPref(option)}
						>
							{t(`settings.theme.${option}`)}
						</Button>
					{/each}
				</Group>
				<Text tag="p" class="text-xs font-medium text-foreground" id="creator-settings-locale-label"
					>{t("settings.locale")}</Text
				>
				<Group
					class="items-center gap-1 rounded-full bg-muted p-1"
					role="group"
					aria-labelledby="creator-settings-locale-label"
					data-slot="settings-locale"
				>
					{#each UI_LOCALES as option (option)}
						<Button
							class={cn(
								"flex-1 rounded-full px-2 py-1 text-xs",
								uiLocale.current === option
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
							pressed={uiLocale.current === option}
							data-action={`locale-${option}`}
							onclick={() => uiLocale.set(option)}
						>
							{t(`settings.locale.${option}`)}
						</Button>
					{/each}
				</Group>
				<Group class="items-center gap-2 px-2 py-1" data-slot="settings-preview-clean">
					<Checkbox
						id="creator-settings-preview-clean"
						checked={previewSettings.hideServiceLabels}
						onchange={(event: Event) =>
							previewSettings.setHideServiceLabels((event.currentTarget as HTMLInputElement).checked)}
					/>
					<Label for="creator-settings-preview-clean" class="text-xs text-foreground"
						>{t("settings.hidePreviewLabels")}</Label
					>
				</Group>
				<SettingsThemeImport />
				<SettingsSessionFile />
				<Button
					class="flex w-full items-center justify-start rounded px-2 py-1 text-xs text-destructive hover:bg-accent/70"
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

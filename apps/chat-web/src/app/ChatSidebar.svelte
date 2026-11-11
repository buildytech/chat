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
	import Block from "$registry/compose/Block.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Switch from "$registry/kit/ui/switch/Switch.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Input from "$registry/kit/ui/input/Input.svelte";
	import Separator from "$registry/kit/ui/separator/Separator.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { theme } from "$lib/theme/theme.svelte";
	import { THEME_PREFS } from "$lib/theme/theme-pref";
	import { cn } from "$registry/utils/cn";
	import { deleteAllSessions, type SessionSummary } from "$lib/chat-core";
	import { getSelectedModelId, isChatModelAvailable, listChatModels, setSelectedModelId } from "$lib/browser/models.svelte";
	import { modelUnavailableCode } from "@buildytech/builder-core";
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

	// Keyboard focus inside the scrolling Settings region: show the whole control, not only its caret (a tall textarea
	// was left half clipped by the browser's own focus scroll at 1024x640).
	function revealFocused(event: FocusEvent) {
		(event.target as HTMLElement | null)?.scrollIntoView?.({ block: "nearest" });
	}
</script>

<svelte:window onkeydown={onSearchKey} />

<Block
	tag="aside"
	class="flex h-full shrink-0 flex-col justify-between overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
	style={`width: ${creatorLayout.columns ? creatorLayout.widths.nav : PANE_RANGE.nav.default}px`}
	aria-label={t("sidebar.mainNav")}
	data-nav={collapsed ? "collapsed" : "expanded"}
>
	<Stack align="stretch" class="min-h-0 shrink gap-2 overflow-y-auto p-2 in-data-[nav=collapsed]:items-center">
		<Group class="justify-between gap-2 in-data-[nav=collapsed]:flex-col in-data-[nav=collapsed]:items-center">
			<Group class="min-w-0 gap-2 in-data-[nav=collapsed]:hidden">
				<Box
					class="flex size-8 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground"
					aria-hidden="true"
				>
					<Text tag="span">{t("sidebar.brandMark")}</Text>
				</Box>
				<Text tag="span" class="truncate text-sm font-semibold">{t("sidebar.brand")}</Text>
			</Group>
			<Group class="gap-0 in-data-[nav=collapsed]:flex-col">
				<Button
					class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
					aria-label={t("sidebar.newChat")}
					title={t("sidebar.newChat")}
					onclick={onNew}
				>
					<Icon size="sm"><Zap /></Icon>
				</Button>
				<Button
					class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
					aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
					expanded={!collapsed}
					title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
					onclick={onToggle}
				>
					<Icon size="sm"><PanelLeft /></Icon>
				</Button>
			</Group>
		</Group>

		<Stack align="stretch" class="gap-0 in-data-[nav=collapsed]:items-center" tag="nav" aria-label={t("sidebar.mainNav")}>
			{#each mainItems as item (item.id)}
				<Button
					class={cn(
						"flex w-full items-center justify-start gap-2 rounded px-2 py-1 text-sm",
						"in-data-[nav=collapsed]:size-8 in-data-[nav=collapsed]:justify-center in-data-[nav=collapsed]:px-0 in-data-[nav=collapsed]:py-0",
						active === item.id
							? "bg-accent text-accent-foreground"
							: "text-foreground hover:bg-accent/70"
					)}
					pressed={active === item.id}
					expanded={item.id === "search" ? searchOpen : undefined}
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
			<Stack align="stretch" class="gap-2">
				<Input
					id="sidebar-chat-search"
					type="search"
					value={searchDraft}
					placeholder={t("sidebar.searchPlaceholder")}
					aria-label={t("sidebar.search")}
					class="w-full rounded border border-input bg-card px-2 py-1 text-sm"
					oninput={(event: Event) => {
						searchDraft = (event.currentTarget as HTMLInputElement).value;
					}}
				/>
			</Stack>
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
			<Stack align="stretch" id="creator-recents" class="min-h-0 gap-0" hidden={!recentsOpen}>
				{#if visibleSessions.length === 0}
					<Text tag="p" class="px-2 py-2 text-sm text-muted-foreground">
						{searchDraft.trim() ? t("sidebar.noMatches") : t("sidebar.empty")}
					</Text>
				{:else}
					{#each visibleSessions as session (session.id)}
						<Group class="min-w-0 gap-0" data-slot="recent-row">
							<Button
								class={cn(
									"flex min-w-0 flex-1 items-center justify-start gap-2 rounded px-2 py-1 text-left text-sm",
									selectedId === session.id || active === session.id
										? "bg-accent text-accent-foreground"
										: "text-foreground hover:bg-accent/70"
								)}
								onclick={() => pickRecent(session.id)}
							>
								<Icon size="sm"><Circle /></Icon>
								<Text tag="span" class="min-w-0 truncate">{session.title}</Text>
							</Button>
							<Button
								class="shrink-0 rounded p-2 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-40"
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
	<Stack align="stretch" class="max-h-[75%] min-h-0 shrink-0 gap-0 p-2 in-data-[nav=collapsed]:items-center" tag="nav" aria-label={t("sidebar.preferences")} data-slot="sidebar-preferences">
		<Separator class="in-data-[nav=collapsed]:hidden" />
		<Button
			class={cn(
				"flex w-full items-center justify-start gap-2 rounded px-2 py-1 text-sm",
				"in-data-[nav=collapsed]:size-8 in-data-[nav=collapsed]:justify-center in-data-[nav=collapsed]:px-0 in-data-[nav=collapsed]:py-0",
				active === "settings" ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/70"
			)}
			title={t("sidebar.settings")}
			expanded={settingsOpen}
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
			<Stack align="stretch"
				id="creator-settings"
				class="min-h-0 shrink gap-2 overflow-y-auto overscroll-contain rounded border border-border p-2 text-xs"
				role="region"
				tabindex={-1}
				aria-label={t("sidebar.settingsRegion")}
				data-slot="settings-region"
				onfocusin={revealFocused}
			>
				<Text tag="p" class="text-xs text-muted-foreground">{t("sidebar.settingsHint")}</Text>
				<Text tag="p" class="text-xs font-medium text-foreground">{t("sidebar.settingsModel")}</Text>
				{#each chatModels as model, index (model.id)}
					<Button
						id={index === 0 ? "creator-settings-model" : undefined}
						class={cn(
							"flex w-full items-center justify-start rounded px-2 py-1 text-left text-xs",
							isChatModelAvailable(model.id) ? "hover:bg-accent/70" : "cursor-not-allowed opacity-60",
							model.id === selectedModelId ? "bg-accent text-accent-foreground" : "text-foreground"
						)}
						pressed={model.id === selectedModelId}
						disabled={!isChatModelAvailable(model.id)}
						title={isChatModelAvailable(model.id) ? undefined : t(modelUnavailableCode(model) === "model_too_slow" ? "composer.modelTooSlow" : "composer.modelUnavailable")}
						onclick={() => setSelectedModelId(model.id)}
					>
						{model.label}
					</Button>
					{#if !isChatModelAvailable(model.id)}
						<Text tag="p" class="px-2 text-xs text-muted-foreground">{t(modelUnavailableCode(model) === "model_too_slow" ? "composer.modelTooSlow" : "composer.modelUnavailable")}</Text>
					{/if}
				{/each}
				<!-- The chat UI theme (ADR 0026): system / dark / light; the preview keeps its own skin. -->
				<Text tag="p" class="text-xs font-medium text-foreground" id="creator-settings-theme-label">{t("settings.theme")}</Text>
				<Group class="items-center gap-1 rounded-full bg-muted p-1" role="group" aria-labelledby="creator-settings-theme-label" data-slot="settings-theme">
					{#each THEME_PREFS as option (option)}
						<Button
							class={cn(
								"flex-1 rounded-full px-2 py-1 text-xs",
								theme.pref === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
							)}
							pressed={theme.pref === option}
							data-action={`theme-${option}`}
							onclick={() => theme.setPref(option)}
						>
							{t(`settings.theme.${option}`)}
						</Button>
					{/each}
				</Group>
				<Group class="items-center gap-2 px-2 py-1" data-slot="settings-preview-clean">
					<Checkbox
						id="creator-settings-preview-clean"
						checked={previewSettings.hideServiceLabels}
						onchange={(event: Event) => previewSettings.setHideServiceLabels((event.currentTarget as HTMLInputElement).checked)}
					/>
					<Label for="creator-settings-preview-clean" class="text-xs text-foreground">{t("settings.hidePreviewLabels")}</Label>
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
		<Group class="justify-between gap-2 rounded p-2 in-data-[nav=collapsed]:justify-center in-data-[nav=collapsed]:px-0">
			<Group class="gap-2 in-data-[nav=collapsed]:gap-0">
				<Switch
					class="relative inline-flex h-6 w-12 items-center rounded-full border-4 border-muted bg-muted p-0 ring-1 ring-border in-data-[nav=collapsed]:w-8"
					checked={theme.isDark}
					aria-label={t("sidebar.nightMode")}
					title={t("sidebar.nightMode")}
					onclick={() => theme.toggle()}
				>
					<Box
						class={cn(
							"size-4 rounded-full bg-foreground transition-transform",
							theme.isDark ? "translate-x-6 in-data-[nav=collapsed]:translate-x-2" : "translate-x-0"
						)}
					></Box>
				</Switch>
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

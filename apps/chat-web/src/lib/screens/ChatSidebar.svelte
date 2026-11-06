<script lang="ts">
	import BookOpen from "@lucide/svelte/icons/book-open";
	import Cable from "@lucide/svelte/icons/cable";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronUp from "@lucide/svelte/icons/chevron-up";
	import Circle from "@lucide/svelte/icons/circle";
	import Folder from "@lucide/svelte/icons/folder";
	import FolderKanban from "@lucide/svelte/icons/folder-kanban";
	import Folders from "@lucide/svelte/icons/folders";
	import House from "@lucide/svelte/icons/house";
	import Languages from "@lucide/svelte/icons/languages";
	import PanelLeft from "@lucide/svelte/icons/panel-left";
	import Search from "@lucide/svelte/icons/search";
	import Settings from "@lucide/svelte/icons/settings";
	import Star from "@lucide/svelte/icons/star";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import Users from "@lucide/svelte/icons/users";
	import Zap from "@lucide/svelte/icons/zap";
	import type { Component } from "svelte";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Separator from "../../ui/separator/Separator.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { theme } from "../theme/theme.svelte";
	import { cn } from "../../utils/cn";
	import type { SessionSummary } from "../chat-core";

	type NavItem = {
		id: string;
		label: string;
		icon: Component;
		kbd?: string;
		stub?: boolean;
	};

	let {
		sessions,
		selectedId,
		onNew,
		onSelect,
		onDelete,
		onToggle,
		collapsed = false
	}: {
		sessions: SessionSummary[];
		selectedId: string | null;
		onNew: () => void;
		onSelect: (id: string) => void;
		onDelete: (id: string) => void;
		onToggle?: () => void;
		collapsed?: boolean;
	} = $props();

	let active = $state("home");
	let projectsOpen = $state(true);
	let recentsOpen = $state(true);

	const mainItems: NavItem[] = [
		{ id: "home", label: t("sidebar.home"), icon: House },
		{ id: "search", label: t("sidebar.search"), icon: Search, kbd: t("sidebar.searchKbd"), stub: true },
		{ id: "resources", label: t("sidebar.resources"), icon: Folder, stub: true },
		{ id: "connectors", label: t("sidebar.connectors"), icon: Cable, stub: true }
	];

	const projectItems: NavItem[] = [
		{ id: "all-projects", label: t("sidebar.allProjects"), icon: Folders, stub: true },
		{ id: "starred", label: t("sidebar.starred"), icon: Star, stub: true },
		{ id: "my-projects", label: t("sidebar.myProjects"), icon: FolderKanban, stub: true },
		{ id: "shared", label: t("sidebar.shared"), icon: Users, stub: true }
	];

	function pick(id: string, stub = false) {
		active = id;
		if (id === "home") return;
		void stub;
	}

	function pickRecent(id: string) {
		active = id;
		onSelect(id);
	}

	function onSearchKey(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
			event.preventDefault();
			active = "search";
		}
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
				<Block
					class="flex size-8 items-center justify-center rounded-default bg-primary text-xs font-semibold text-primary-foreground"
					aria-hidden="true"
				>
					<Text tag="span">C</Text>
				</Block>
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
					title={item.stub ? t("sidebar.comingSoon") : item.label}
					onclick={() => pick(item.id, item.stub)}
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
		<Stack class="gap-1">
			<Button
				class="w-full justify-between rounded-default px-3 py-2 text-sm text-muted-foreground hover:bg-accent/70 hover:text-foreground"
				aria-expanded={projectsOpen ? "true" : "false"}
				aria-controls="creator-projects"
				onclick={() => (projectsOpen = !projectsOpen)}
			>
				<Text tag="span">{t("sidebar.projects")}</Text>
				<Icon size="sm">
					{#if projectsOpen}
						<ChevronUp />
					{:else}
						<ChevronDown />
					{/if}
				</Icon>
			</Button>
			<Stack id="creator-projects" class="gap-1" hidden={!projectsOpen}>
				{#each projectItems as item (item.id)}
					<Button
						class={cn(
							"w-full justify-start gap-2 rounded-default px-3 py-2 text-sm",
							active === item.id
								? "bg-accent text-accent-foreground"
								: "text-foreground hover:bg-accent/70"
						)}
						aria-pressed={active === item.id ? "true" : "false"}
						title={t("sidebar.comingSoon")}
						onclick={() => pick(item.id, true)}
					>
						<Icon size="sm"><item.icon /></Icon>
						<Text tag="span" class="truncate">{item.label}</Text>
					</Button>
				{/each}
			</Stack>
		</Stack>

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
				{#if sessions.length === 0}
					<Text tag="p" class="px-3 py-2 text-sm text-muted-foreground">{t("sidebar.empty")}</Text>
				{:else}
					{#each sessions as session (session.id)}
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
								class="shrink-0 rounded-default p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
								aria-label={t("sidebar.delete")}
								onclick={() => onDelete(session.id)}
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
			title={t("sidebar.settingsSoon")}
			onclick={() => pick("settings", true)}
		>
			<Icon size="sm"><Settings /></Icon>
			<Text tag="span" class="in-data-[nav=collapsed]:hidden">{t("sidebar.settings")}</Text>
		</Button>
		<Button
			class={cn(
				"w-full justify-start gap-2 rounded-default px-3 py-2 text-sm",
				"in-data-[nav=collapsed]:size-8 in-data-[nav=collapsed]:justify-center in-data-[nav=collapsed]:px-0 in-data-[nav=collapsed]:py-0",
				active === "language" ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/70"
			)}
			title={t("sidebar.languageSoon")}
			onclick={() => pick("language", true)}
		>
			<Icon size="sm"><Languages /></Icon>
			<Text tag="span" class="in-data-[nav=collapsed]:hidden">{t("sidebar.language")}</Text>
		</Button>
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
					<Block
						class={cn(
							"absolute top-0.5 size-4 rounded-full bg-foreground transition-[left]",
							theme.isDark ? "left-4" : "left-0.5"
						)}
					></Block>
				</Button>
				<Text tag="span" class="text-sm in-data-[nav=collapsed]:hidden">{t("sidebar.nightMode")}</Text>
			</Group>
		</Group>
		<Button
			class={cn(
				"w-full justify-start gap-2 rounded-default px-3 py-2 text-sm",
				"in-data-[nav=collapsed]:size-8 in-data-[nav=collapsed]:justify-center in-data-[nav=collapsed]:px-0 in-data-[nav=collapsed]:py-0",
				active === "learn" ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/70"
			)}
			title={t("sidebar.learnSoon")}
			onclick={() => pick("learn", true)}
		>
			<Icon size="sm"><BookOpen /></Icon>
			<Text tag="span" class="in-data-[nav=collapsed]:hidden">{t("sidebar.learn")}</Text>
		</Button>
	</Stack>
</Block>

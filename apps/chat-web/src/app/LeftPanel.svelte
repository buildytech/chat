<script lang="ts">
import { Blocks, ListTree } from "$lib/shell-icons";
	import Block from "$registry/compose/Block.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { feed } from "$lib/feed/feed.svelte";
	import { feedDrag } from "$lib/feed/drag.svelte";
	import { CORE_LEFT_TABS, landingTab } from "$lib/feed/prefs";
	import { readPreviewPage } from "$lib/page-store";
	import { untrack } from "svelte";
	import SectionsList from "./SectionsList.svelte";
	import BlocksFeed from "./BlocksFeed.svelte";
	import { creatorLayout } from "$lib/creator-layout.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { leftSurface, moduleTabs, projectHasActivity } from "$lib/modules/registry.svelte";
	import { createdInThisTab, getWorkspaceProject } from "$lib/modules/workspace.svelte";

	let {
		visible = true,
		sideHidden = false
	}: {
		visible?: boolean;
		sideHidden?: boolean;
	} = $props();

	// Left panel (ADR 0024): Blocks feed and Sections (the sortable page sections) share the ~320px column, with the tabs a
	// loaded module adds (the chat). Every panel stays mounted, so a module keeps its draft, scroll and running work while
	// another tab is open.
	const coreIcons = { blocks: Blocks, sections: ListTree } as const;
	const tabs = $derived([
		...CORE_LEFT_TABS.map((name) => ({ id: name as string, label: t(`leftPanel.${name}`), icon: coreIcons[name], panel: null })),
		...moduleTabs().map((tab) => ({ id: tab.id, label: t(tab.labelKey), icon: tab.icon, panel: tab.panel }))
	]);
	const tab = $derived(feed.tab);
	// The tab a project opens on (landingTab): an empty project lands on Blocks, the remembered tab is kept only when it has
	// something to show. Runs when another project opens; one created in place (first message, first block) keeps the
	// tab the author is working in.
	let landedFor: string | null | undefined = undefined;
	$effect(() => {
		const project = getWorkspaceProject();
		const id = project?.id ?? null;
		if (id === landedFor) return;
		// Restored projects arrive after hydration (null -> id) and land like any other; only one made in this tab keeps the tab.
		const createdInPlace = landedFor === null && createdInThisTab(id);
		landedFor = id;
		if (createdInPlace) return;
		untrack(() => {
			const hasPage = Boolean(readPreviewPage(id)?.blocks.length);
			feed.land(landingTab(feed.savedTab, { hasPage, hasMessages: projectHasActivity(project) }));
		});
	});
	// A feed card dragged onto the Sections tab opens it after a short rest, so the card can drop between sections.
	let springTimer: ReturnType<typeof setTimeout> | null = null;
	function springOpen(name: string) {
		if (!feedDrag.active || name !== "sections" || tab === "sections") return;
		springTimer ??= setTimeout(() => {
			springTimer = null;
			if (feedDrag.active) feed.tab = "sections";
		}, 400);
	}
	// A drag that ends anywhere (drop, Escape, outside the window) clears the dragged card; drop targets read it first.
	$effect(() => {
		const end = () => setTimeout(() => feedDrag.end(), 0);
		window.addEventListener("dragend", end);
		window.addEventListener("drop", end);
		return () => {
			window.removeEventListener("dragend", end);
			window.removeEventListener("drop", end);
		};
	});
	function springCancel() {
		if (springTimer) clearTimeout(springTimer);
		springTimer = null;
	}
	// An inactive panel carries the native `hidden` attribute (display: none in the base styles), never removed from the DOM.
	const panelClass = "min-h-0 flex-1 flex-col flex";
</script>

<Block
	tag="section"
	id="creator-side-column"
	aria-label={t(leftSurface().regionKey)}
	class={cn(
		"min-h-0 min-w-0 flex-col bg-background",
		visible ? "flex flex-1" : "max-lg:hidden",
		sideHidden ? "lg:hidden" : "lg:flex lg:flex-none lg:shrink-0"
	)}
	style={creatorLayout.columns && !sideHidden ? `width: ${creatorLayout.widths.side}px` : undefined}
>
	<Group class="h-10 shrink-0 items-center gap-1 border-b border-border px-2" role="tablist" aria-label={t("leftPanel.tabs")} data-slot="left-tabs">
		{#each tabs as item (item.id)}
			{@const TabIcon = item.icon}
			<Button
				size="sm"
				variant="ghost"
				id={`left-tab-${item.id}`}
				class={cn("h-8 gap-1 px-2 text-xs", tab === item.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
				role="tab"
				aria-selected={tab === item.id}
				aria-controls={`left-panel-${item.id}`}
				data-tab={item.id}
				onclick={() => (feed.tab = item.id)}
				ondragenter={() => springOpen(item.id)}
				ondragleave={springCancel}
			>
				<Icon size="sm"><TabIcon /></Icon>
				<Text tag="span">{item.label}</Text>
			</Button>
		{/each}
	</Group>
	<Box id="left-panel-blocks" role="tabpanel" aria-labelledby="left-tab-blocks" hidden={tab !== "blocks"} class={panelClass}>
		<BlocksFeed />
	</Box>
	<Box id="left-panel-sections" role="tabpanel" aria-labelledby="left-tab-sections" hidden={tab !== "sections"} class={panelClass}>
		<SectionsList />
	</Box>
	{#each tabs as item (item.id)}
		{#if item.panel}
			{@const Panel = item.panel}
			<Box id={`left-panel-${item.id}`} role="tabpanel" aria-labelledby={`left-tab-${item.id}`} hidden={tab !== item.id} class={panelClass}>
				<Panel />
			</Box>
		{/if}
	{/each}
</Block>

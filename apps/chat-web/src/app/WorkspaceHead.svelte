<!--
  Workspace head (ADR 0017): one 40px tool bar. Left: left panel toggle (Ctrl+B) and the Preview / Code switch;
  right: the inspector toggle (Ctrl+I) and preview-only focus (Ctrl+\). Download ZIP lives on the project bar.
-->
<script lang="ts">
	import Box from "$registry/kit/ui/box/Box.svelte";
	import { leftSurface } from "$lib/modules/registry.svelte";
import { Maximize2, Minimize2, PanelLeft, PanelRight } from "$lib/shell-icons";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { creatorLayout } from "$lib/creator-layout.svelte";

	export type WorkspaceView = "preview" | "code";

	let {
		view = $bindable("preview"),
		inspectorOpen = false,
		ontogglechat,
		ontoggleinspector
	}: {
		view?: WorkspaceView;
		inspectorOpen?: boolean;
		ontogglechat?: () => void;
		ontoggleinspector?: () => void;
	} = $props();

	const names = $derived(leftSurface());
	const sideOpen = $derived(!creatorLayout.collapsed("side"));
	const focus = $derived(creatorLayout.focus);
</script>

<Group
	class="h-10 w-full shrink-0 items-center gap-2 border-b border-border px-2"
	role="toolbar"
	aria-label={t("workspace.head")}
	data-block="workspace-head"
	data-view={view}
>
	<Button
		size="sm"
		layout="icon"
		variant="ghost"
		class="max-lg:hidden"
		aria-label={sideOpen ? t(names.hideKey) : t(names.showKey)}
		title={`${sideOpen ? t(names.hideKey) : t(names.showKey)} (Ctrl+B)`}
		expanded={sideOpen}
		aria-controls="creator-side-column"
		data-action="chat-toggle"
		onclick={ontogglechat}
	>
		<PanelLeft />
	</Button>

	<Group class="gap-1 rounded bg-muted" role="tablist" aria-label={t("workspace.viewSwitcher")}>
		{#each ["preview", "code"] as const as option (option)}
			<Button
				size="sm"
				variant="ghost"
				class={cn("text-xs", view === option ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
				role="tab"
				aria-selected={view === option}
				aria-controls="pane-workspace"
				data-view={option}
				onclick={() => (view = option)}
			>
				<Text tag="span">{t(`workspace.${option}`)}</Text>
			</Button>
		{/each}
	</Group>

	<Box class="min-w-0 flex-1"></Box>
	<Group class="items-center gap-2">
		{#if view === "preview"}
			<Button
				size="sm"
				layout="icon"
				variant="ghost"
				aria-label={inspectorOpen ? t("inspector.collapse") : t("inspector.expand")}
				title={`${inspectorOpen ? t("inspector.collapse") : t("inspector.expand")} (Ctrl+I)`}
				expanded={inspectorOpen}
				aria-controls="creator-inspector"
				data-action="inspector-toggle"
				onclick={ontoggleinspector}
			>
				<PanelRight />
			</Button>
		{/if}
		<Button
			size="sm"
			layout="icon"
			variant="ghost"
			class="max-lg:hidden"
			aria-label={focus ? t("workspace.focusOff") : t("workspace.focusOn")}
			title={`${focus ? t("workspace.focusOff") : t("workspace.focusOn")} (Ctrl+\\)`}
			pressed={focus}
			data-action="focus-toggle"
			onclick={() => creatorLayout.toggleFocus()}
		>
			{#if focus}<Minimize2 />{:else}<Maximize2 />{/if}
		</Button>
	</Group>
</Group>

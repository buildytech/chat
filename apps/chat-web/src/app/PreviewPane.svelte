<script lang="ts">
	import { base } from "$app/paths";
import { ExternalLink, Monitor, Smartphone, Tablet } from "$lib/shell-icons";
	import { mount, unmount } from "svelte";
	import Block from "$registry/compose/Block.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Select from "$registry/compose/Select.svelte";
	import SelectOption from "$registry/compose/SelectOption.svelte";
	import OptGroup from "$registry/compose/OptGroup.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import ModuleSlot from "./ModuleSlot.svelte";
	import PreviewAddress from "./PreviewAddress.svelte";
	import { getProjectSkin, getSelectedProject, setProjectSkin } from "$lib/project";
	import { applySkin, forcedPreviewMode, skins } from "$lib/theme/skins";
	import { projectBrandSkins, projectBrandTheme } from "$lib/theme/brand-skins.svelte.ts";
	import {
		blocksOf,
		getCurrentPage,
		getCurrentProvenance,
		getPageRevision,
		getSelectedBlockId,
		hasUnappliedProposal,
	} from "$lib/page-store";
	import { topLevelBlockId } from "$lib/inspector/geometry";
	import CanvasOverlay from "./CanvasOverlay.svelte";
	import DropOverlay from "./DropOverlay.svelte";
	import { inspectorPanel } from "$lib/inspector/panel.svelte";
	import { inspector } from "$lib/inspector/inspector.svelte";
	import { itemInfo } from "@buildytech/builder-core";
	import PreviewFrame from "./PreviewFrame.svelte";
	import { previewSettings } from "$lib/browser/preview-settings.svelte";
	import { previewWindowUrl } from "$lib/browser/preview-settings";
	import { getBoundProjectId } from "$lib/page-store";
	import { forwardShortcut } from "$lib/layout/shortcuts";

	const page = $derived(getCurrentPage());
	const currentUrl = $derived(page ? `/${page.slug}` : "/");
	const savedRevision = $derived(getPageRevision());
	const unapplied = $derived(hasUnappliedProposal());
	const blocks = $derived(page ? blocksOf(page) : []);
	const provenance = $derived(getCurrentProvenance());
	const screenId = $derived(provenance?.screenId ?? "");
	const missingLabels = $derived((provenance?.missing ?? []).join(", "));

	type Device = "desktop" | "tablet" | "mobile";
	let device = $state<Device>("desktop");
	// Frame widths in CSS px: the kit breakpoints (sm 640, lg 1024) follow the iframe width, not the chat window.
	const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 768, mobile: 390 };
	const devices = $derived<Array<{ id: Device; label: string }>>([
		{ id: "desktop", label: t("preview.desktop") },
		{ id: "tablet", label: t("preview.tablet") },
		{ id: "mobile", label: t("preview.mobile") },
	]);

	let stageWidth = $state(0);
	let stageHeight = $state(0);
	const frameWidth = $derived(device === "desktop" ? Math.max(DEVICE_WIDTH.desktop, stageWidth) : DEVICE_WIDTH[device]);
	const frameScale = $derived(stageWidth > 0 ? Math.min(1, stageWidth / frameWidth) : 1);
	const frameHeight = $derived(stageHeight > 0 ? Math.round(stageHeight / frameScale) : 600);

	// The iframe document: blank srcdoc; its stylesheet (preview-frame.css: chat tokens + scoped kit theme) is injected
	// on load, and PreviewFrame is mounted into its body in this realm so stores and selection stay shared.
	const FRAME_DOC = '<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body></body></html>';
	const frame = $state({ reload: 0 });
	let frameEl = $state<HTMLIFrameElement | null>(null);
	// The frame document once PreviewFrame is mounted into it: the canvas overlay measures blocks there.
	let frameDoc = $state.raw<Document | null>(null);
	let mounted: Record<string, unknown> | null = null;
	let themeObserver: MutationObserver | null = null;

	function syncTheme(doc: Document) {
		const source = document.documentElement;
		const target = doc.documentElement;
		target.className = source.className;
		if (source.dataset.theme) target.dataset.theme = source.dataset.theme;
		else delete target.dataset.theme;
		target.style.colorScheme = source.style.colorScheme;
		// A Custom Skin (ADR 0025) fixes its own mode on the preview; the chat's mode never reaches it then.
		const forced = forcedPreviewMode(doc);
		if (forced) {
			target.classList.toggle("dark", forced === "dark");
			target.dataset.theme = forced;
			target.style.colorScheme = forced;
		}
	}

	async function onFrameLoad() {
		const doc = frameEl?.contentDocument;
		if (!doc) return;
		const css = (await import("../preview-frame.css?inline")).default;
		const style = doc.createElement("style");
		style.textContent = css;
		doc.head.appendChild(style);
		syncTheme(doc);
		themeObserver?.disconnect();
		themeObserver = new MutationObserver(() => syncTheme(doc));
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "data-theme", "style"],
		});
		if (mounted) void unmount(mounted);
		mounted = mount(PreviewFrame, { target: doc.body, props: { frame } });
		// Undo / redo of inspector edits also while focus is inside the preview frame.
		doc.addEventListener("keydown", inspector.onKey);
		// Layout shortcuts (Ctrl+B / Ctrl+I / Ctrl+\) also while focus is inside the frame (ADR 0017).
		doc.addEventListener("keydown", (event) => {
   if (event.key === "Escape" && !event.defaultPrevented && inspectorPanel.open) {
    event.preventDefault();
    inspectorPanel.close();
   } else forwardShortcut(event, window);
  });
		frameDoc = doc;
	}

	// Project Skin of this page (session `skin`): registry theme-<skin> or a per-project Brand Skin, preview only.
	const skinOptions = skins();
	const skin = $derived(getProjectSkin());
	const brandSkins = $derived(projectBrandSkins());
	const custom = $derived(projectBrandTheme(skin));
	const skinValue = $derived(skin && (skinOptions.some((option) => option.id === skin) || brandSkins.some((item) => item.id === skin)) ? skin : "");
	$effect(() => {
		const doc = frameDoc;
		const id = skin;
		const config = custom;
		if (doc) void applySkin(doc, id, config).then(() => syncTheme(doc));
	});

	function onSkin(event: Event) {
		setProjectSkin((event.currentTarget as HTMLSelectElement).value || null);
	}

	// Stage size (the frame scales down to fit; its CSS width stays the device width).
	$effect(() => {
		const stage = frameEl?.closest<HTMLElement>('[data-slot="preview-stage"]');
		if (!stage) return;
		const observer = new ResizeObserver(() => {
			stageWidth = stage.clientWidth;
			stageHeight = stage.clientHeight;
		});
		observer.observe(stage);
		return () => observer.disconnect();
	});

	$effect(() => {
		return () => {
			themeObserver?.disconnect();
			if (mounted) void unmount(mounted);
			mounted = null;
			frameDoc = null;
		};
	});
	function reload() {
		reloadKey += 1;
		frame.reload += 1;
	}
	let reloadKey = $state(0);

	const clean = $derived(previewSettings.hideServiceLabels);
	// Canvas selection is the top-level block that holds the selected node (rows select their block).
	const canvasSelectedId = $derived(topLevelBlockId(blocks, getSelectedBlockId()));
	const canvasSelectedLabel = $derived.by(() => {
		const block = blocks.find((node) => node.id === canvasSelectedId);
		return block ? (itemInfo(block.item)?.title ?? block.item) : "";
	});

	// The whole preview site as-is in a new window: the /preview route renders this chat's page (pending proposal, else
	// the applied page) with the registry blocks and kit theme, no chat UI and no service labels.
	function openNew() {
		window.open(
			previewWindowUrl(getSelectedProject()?.id ?? getBoundProjectId(), base, page?.slug),
			"_blank",
			"noopener",
		);
	}
</script>

<Block
	tag="section"
	class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card"
	aria-label={t("workspace.preview")}
	data-page-id={page?.id ?? ""}
	data-page-revision={savedRevision ?? ""}
	data-screen-id={screenId}
	data-block="preview-pane"
>
	<Group class="h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-2" data-slot="browser-head">
		<Group class="gap-0 rounded bg-muted" role="tablist" aria-label={t("preview.device")}>
			{#each devices as option (option.id)}
				<Button
					class={cn(
						"inline-flex size-8 items-center justify-center rounded",
						device === option.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
					)}
					aria-label={option.label}
					pressed={device === option.id}
					onclick={() => (device = option.id)}
				>
					<Icon size="sm">
						{#if option.id === "desktop"}<Monitor />{:else if option.id === "tablet"}<Tablet />{:else}<Smartphone
							/>{/if}
					</Icon>
				</Button>
			{/each}
		</Group>

		<PreviewAddress {currentUrl} onreload={reload} />

		<Group class="shrink-0 items-center gap-2">
			{#if skinOptions.length}
				<Select
					id="preview-skin"
					size="sm"
					class="w-auto"
					value={skinValue}
					aria-label={t("preview.skin")}
					title={t("preview.skin")}
					data-slot="preview-skin"
					onchange={onSkin}
				>
					<SelectOption value="">{t("preview.skinDefault")}</SelectOption>
					{#if brandSkins.length}
						<OptGroup label={t("preview.skinBrandGroup")} data-slot="preview-skin-brand">
							{#each brandSkins as item (item.id)}
								<SelectOption value={item.id} data-slot="preview-skin-brand-item">{item.name}</SelectOption>
							{/each}
						</OptGroup>
					{/if}
					<OptGroup label={t("preview.skinKitGroup")} data-slot="preview-skin-kit">
						{#each skinOptions as option (option.id)}
							<SelectOption value={option.id}>{option.title}</SelectOption>
						{/each}
					</OptGroup>
				</Select>
			{/if}
			<Button
				class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
				aria-label={t("preview.openNew")}
				onclick={openNew}
			>
				<Icon size="sm"><ExternalLink /></Icon>
			</Button>
		</Group>
	</Group>

	{#if unapplied || !clean}
		<Stack
			align="stretch"
			class="shrink-0 gap-2 border-b border-border p-2"
			data-slot="preview-status"
			data-clean={clean ? "true" : undefined}
		>
			<ModuleSlot name="preview.review" props={{}} />
			{#key reloadKey}
				{#if !clean}
					<Text tag="p" class="text-xs text-muted-foreground">{t("preview.runtime")}</Text>
					<Text tag="p" class="text-xs text-muted-foreground">
						{screenId || t("preview.noScreen")}
					</Text>
					{#if missingLabels}
						<Text tag="p" class="text-xs text-muted-foreground" role="status">
							{t("home.incompatible")}
							{t("home.missing").replace("{list}", missingLabels)}
						</Text>
					{/if}
				{/if}
			{/key}
		</Stack>
	{/if}

	<Box
		class="relative min-h-0 flex-1 overflow-hidden bg-muted"
		data-device={device}
		data-blocks={blocks.length}
		data-slot="preview-stage"
	>
		<Box class="relative mx-auto h-full overflow-hidden" style={`width: ${Math.round(frameWidth * frameScale)}px`}>
			<!-- Host element: the kit has no iframe tag. This frame is a separate document, not a shell composition. -->
			<iframe
				{@attach (element) => {
					frameEl = element as HTMLIFrameElement;
					return () => {
						frameEl = null;
					};
				}}
				title={t("preview.frame")}
				srcdoc={FRAME_DOC}
				class="block origin-top-left border-0 bg-background"
				style:width="{frameWidth}px"
				style:height="{frameHeight}px"
				style:transform="scale({frameScale})"
				data-frame-width={frameWidth}
				onload={onFrameLoad}
			></iframe>
			{#if frameDoc && !clean}
				<CanvasOverlay
					doc={frameDoc}
					scale={frameScale}
					width={frameWidth}
					height={frameHeight}
					selectedId={canvasSelectedId}
					selectedLabel={canvasSelectedLabel}
				/>
			{/if}
			<!-- Drops work with service labels hidden too (the layer exists only while a feed card is dragged). -->
			{#if frameDoc}
				<DropOverlay doc={frameDoc} scale={frameScale} />
			{/if}
		</Box>
	</Box>
</Block>

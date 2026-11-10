<script lang="ts">
	import ArrowLeft from "@lucide/svelte/icons/arrow-left";
	import ArrowRight from "@lucide/svelte/icons/arrow-right";
	import ExternalLink from "@lucide/svelte/icons/external-link";
	import Monitor from "@lucide/svelte/icons/monitor";
	import RefreshCw from "@lucide/svelte/icons/refresh-cw";
	import Smartphone from "@lucide/svelte/icons/smartphone";
	import Tablet from "@lucide/svelte/icons/tablet";
	import { mount, unmount } from "svelte";
	import Block from "$registry/compose/Block.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Input from "$registry/kit/ui/input/Input.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { applyProposal, discardProposal, getSelectedSession, proposalStatus } from "$lib/chat-core";
	import {
		blocksOf,
		getCurrentPage,
		getCurrentProvenance,
		getPageRevision,
		getSelectedBlockId,
		hasUnappliedProposal
	} from "$lib/page-store";
	import { topLevelBlockId } from "$lib/inspector/geometry";
	import CanvasOverlay from "./CanvasOverlay.svelte";
	import { recordedScreenId } from "@buildytech/builder-core";
	import PreviewFrame from "./PreviewFrame.svelte";
	import { previewSettings } from "$lib/browser/preview-settings.svelte";
	import { previewWindowUrl } from "$lib/browser/preview-settings";
	import { getBoundPageSessionId } from "$lib/page-store";

	const page = $derived(getCurrentPage());
	const savedRevision = $derived(getPageRevision());
	const unapplied = $derived(hasUnappliedProposal());
	const appliedLabel = $derived.by(() => {
		const last = getSelectedSession()?.messages.slice().reverse().find((message) => message.proposal);
		return last?.proposal && proposalStatus(last.proposal) === "applied" && !unapplied ? t("proposal.applied") : "";
	});
	const blocks = $derived(page ? blocksOf(page) : []);
	const slugUrl = $derived(page ? `/${page.slug}` : "/");
	const lastProposal = $derived.by(() => {
		return getSelectedSession()?.messages.slice().reverse().find((message) => message.proposal)?.proposal ?? null;
	});
	const provenance = $derived(getCurrentProvenance());
	const screenId = $derived(recordedScreenId(provenance?.screenId) ?? "");
	const missingLabels = $derived((provenance?.missing ?? []).join(", "));

	type Device = "desktop" | "tablet" | "mobile";
	let device = $state<Device>("desktop");
	// Frame widths in CSS px: the kit breakpoints (sm 640, lg 1024) follow the iframe width, not the chat window.
	const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 768, mobile: 390 };
	const devices: Array<{ id: Device; label: string }> = [
		{ id: "desktop", label: t("preview.desktop") },
		{ id: "tablet", label: t("preview.tablet") },
		{ id: "mobile", label: t("preview.mobile") }
	];

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
		themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
		if (mounted) void unmount(mounted);
		mounted = mount(PreviewFrame, { target: doc.body, props: { frame } });
		frameDoc = doc;
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
	let url = $state("");
	let draft = $state("");
	let history = $state<string[]>([]);
	let future = $state<string[]>([]);
	let reloadKey = $state(0);
	let spinning = $state(false);

	const currentUrl = $derived(url || slugUrl);

	function commit(next: string) {
		const value = next.trim() || slugUrl;
		if (value !== currentUrl) {
			history = [...history, currentUrl];
			future = [];
			url = value;
		}
		draft = value;
	}

	function back() {
		const prev = history.at(-1);
		if (prev === undefined) return;
		future = [currentUrl, ...future];
		history = history.slice(0, -1);
		url = prev;
		draft = prev;
	}

	function forward() {
		const next = future[0];
		if (next === undefined) return;
		history = [...history, currentUrl];
		future = future.slice(1);
		url = next;
		draft = next;
	}

	function reload() {
		spinning = true;
		reloadKey += 1;
		frame.reload += 1;
		draft = currentUrl;
		setTimeout(() => (spinning = false), 500);
	}

	function onAddressKey(event: KeyboardEvent) {
		if (event.key === "Enter") {
			event.preventDefault();
			commit(draft);
			(event.currentTarget as HTMLInputElement).blur();
		} else if (event.key === "Escape") {
			draft = currentUrl;
			(event.currentTarget as HTMLInputElement).blur();
			event.stopPropagation();
		}
	}

	const clean = $derived(previewSettings.hideServiceLabels);
	// Canvas selection is the top-level block that holds the selected node (rows select their block).
	const canvasSelectedId = $derived(topLevelBlockId(blocks, getSelectedBlockId()));
	const canvasSelectedLabel = $derived.by(() => {
		const block = blocks.find((node) => node.id === canvasSelectedId);
		return block ? `${block.kind} · ${block.title}` : "";
	});

	// The whole preview site as-is in a new window: the /preview route renders this chat's page (pending proposal, else
	// the applied page) with the registry blocks and kit theme, no chat UI and no service labels.
	function openNew() {
		window.open(previewWindowUrl(getSelectedSession()?.id ?? getBoundPageSessionId()), "_blank", "noopener");
	}
</script>

<Block
	tag="section"
	class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded border border-border bg-card"
	aria-label={t("workspace.preview")}
	data-page-id={page?.id ?? ""}
	data-page-revision={savedRevision ?? ""}
	data-screen-id={screenId}
	data-block="preview-pane"
>
	<Group
		class="shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border p-3"
		data-slot="browser-head"
	>
		<Group
			class="gap-1 rounded bg-muted p-1"
			role="tablist"
			aria-label={t("preview.device")}
		>
			{#each devices as option (option.id)}
				<Button
					class={cn(
						"inline-flex size-8 items-center justify-center rounded",
						device === option.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
					)}
					aria-label={option.label}
					pressed={device === option.id}
					onclick={() => (device = option.id)}
				>
					<Icon size="sm">
						{#if option.id === "desktop"}<Monitor />{:else if option.id === "tablet"}<Tablet />{:else}<Smartphone />{/if}
					</Icon>
				</Button>
			{/each}
		</Group>

		<Group
			class="min-w-0 flex-1 items-center justify-between gap-2 rounded border border-border bg-background px-2 py-1 max-md:order-3 max-md:basis-full"
			role="group"
			aria-label={t("preview.address")}
		>
			<Group class="min-w-0 flex-1 items-center gap-1">
				<Button
					class="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
					aria-label={t("preview.back")}
					disabled={history.length === 0}
					onclick={back}
				>
					<Icon size="sm"><ArrowLeft /></Icon>
				</Button>
				<Button
					class="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
					aria-label={t("preview.forward")}
					disabled={future.length === 0}
					onclick={forward}
				>
					<Icon size="sm"><ArrowRight /></Icon>
				</Button>
				<Text tag="span" class="shrink-0 text-xs text-muted-foreground" aria-hidden="true">{t("preview.site")}</Text>
				<Input
					class="min-w-0 flex-1 border-0 bg-transparent px-1 py-1 text-xs font-semibold text-foreground shadow-none outline-none"
					value={draft || slugUrl}
					aria-label={t("preview.address")}
					autocomplete="off"
					spellcheck="false"
					oninput={(event: Event) => {
						draft = (event.currentTarget as HTMLInputElement).value;
					}}
					onkeydown={onAddressKey}
					onfocus={(event: FocusEvent) => (event.currentTarget as HTMLInputElement).select()}
					onblur={() => (draft = currentUrl)}
				/>
			</Group>
			<Button
				class="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
				aria-label={t("preview.reload")}
				onclick={reload}
			>
				<Icon size="sm" class={spinning ? "animate-spin" : undefined}><RefreshCw /></Icon>
			</Button>
		</Group>

		<Group class="items-center gap-2 max-md:order-2">
			<Button
				class="inline-flex size-8 items-center justify-center rounded border border-border text-foreground hover:bg-accent"
				aria-label={t("preview.openNew")}
				onclick={openNew}
			>
				<Icon size="sm"><ExternalLink /></Icon>
			</Button>
		</Group>
	</Group>

	{#if unapplied || !clean}
	<Stack align="stretch" class="shrink-0 gap-2 border-b border-border px-4 py-2" data-slot="preview-status" data-clean={clean ? "true" : undefined}>
		{#if unapplied}
			<Group class="items-center justify-between gap-2 rounded border border-border bg-muted px-3 py-2">
				<Text tag="span" class="text-xs text-muted-foreground">{t("proposal.notApplied")}</Text>
				<Group class="gap-2">
					<Button
						class="rounded bg-foreground px-3 py-1.5 text-sm text-background hover:bg-foreground/90"
						onclick={() => applyProposal()}
					>
						<Text tag="span">{t("proposal.apply")}</Text>
					</Button>
					<Button
						class="rounded border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
						onclick={() => discardProposal()}
					>
						<Text tag="span">{t("proposal.discard")}</Text>
					</Button>
				</Group>
			</Group>
		{:else if appliedLabel && !clean}
			<Group class="items-center justify-between gap-2 rounded border border-border bg-muted px-3 py-2">
				<Text tag="span" class="text-xs text-muted-foreground">{appliedLabel}</Text>
			</Group>
		{/if}
		{#key reloadKey}
			{#if !clean}
			<Text tag="p" class="text-xs text-muted-foreground">{t("preview.runtime")}</Text>
			<Text tag="p" class="text-xs text-muted-foreground">
				{screenId || t("preview.noScreen")}
			</Text>
			{#if missingLabels}
				<Text tag="p" class="text-xs text-muted-foreground" role="status">
					{t("home.incompatible")} {t("home.missing").replace("{list}", missingLabels)}
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
			<iframe
				bind:this={frameEl}
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
		</Box>
	</Box>
</Block>

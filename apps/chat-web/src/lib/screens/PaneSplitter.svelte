<script lang="ts">
	import Block from "../compose/Block.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import {
		CREATOR_LAYOUT_CLAMP,
		creatorLayout,
		type CreatorLayoutPane
	} from "../creator-layout.svelte";

	let {
		pane,
		class: className
	}: {
		pane: CreatorLayoutPane;
		class?: string;
	} = $props();

	const labels = {
		nav: "splitter.nav",
		chat: "splitter.chat",
		tree: "splitter.tree"
	} as const;

	const controls = {
		nav: "chat-sidebar-drawer",
		chat: "creator-chat-column",
		tree: "code-file-pane"
	} as const;

	const range = $derived(CREATOR_LAYOUT_CLAMP[pane]);
	const value = $derived(creatorLayout.widthOf(pane));
	const label = $derived(t(labels[pane]));

	let dragging = $state(false);
	let originX = 0;
	let originWidth = 0;

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		dragging = true;
		originX = event.clientX;
		originWidth = creatorLayout.widthOf(pane);
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		creatorLayout.setResizing(true);
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging) return;
		creatorLayout.setWidth(pane, originWidth + (event.clientX - originX), false);
	}

	function endDrag() {
		if (!dragging) return;
		dragging = false;
		creatorLayout.setResizing(false);
		creatorLayout.setWidth(pane, creatorLayout.widthOf(pane));
	}

	function onDblClick() {
		creatorLayout.resetWidth(pane);
	}

	function onKeyDown(event: KeyboardEvent) {
		const step = event.shiftKey ? 32 : 8;
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			creatorLayout.setWidth(pane, value - step);
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			creatorLayout.setWidth(pane, value + step);
		} else if (event.key === "Home") {
			event.preventDefault();
			creatorLayout.setWidth(pane, range.min);
		} else if (event.key === "End") {
			event.preventDefault();
			creatorLayout.setWidth(pane, range.max);
		} else if (event.key === "Enter") {
			event.preventDefault();
			creatorLayout.resetWidth(pane);
		}
	}
</script>

<svelte:window
	onpointermove={dragging ? onPointerMove : undefined}
	onpointerup={dragging ? endDrag : undefined}
/>

<Block
	class={cn(
		"relative z-10 w-1.5 shrink-0 cursor-col-resize touch-none bg-transparent select-none",
		"hover:bg-border focus-visible:bg-ring focus-visible:outline-none",
		dragging && "bg-ring",
		className
	)}
	role="separator"
	aria-orientation="vertical"
	aria-label={label}
	aria-controls={controls[pane]}
	aria-valuemin={String(range.min)}
	aria-valuemax={String(range.max)}
	aria-valuenow={String(value)}
	tabindex={0}
	title={label}
	data-dragging={dragging ? "true" : "false"}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={() => endDrag()}
	onpointercancel={() => endDrag()}
	ondblclick={onDblClick}
	onkeydown={onKeyDown}
></Block>

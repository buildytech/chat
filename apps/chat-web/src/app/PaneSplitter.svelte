<!--
  Separator between two panes (ADR 0017), built from the registry Block in the app layer (the registry has no
  resizable primitive yet: alexy-os/chaosbun#150 for XGenBot). role=separator with aria-valuenow/min/max and
  aria-controls; drag with the pointer, arrows resize by 8px (Shift: 32px), Home/End go to min/max, Enter or a
  double click resets the default size. `edge="end"`: the pane sits after the handle (it grows when dragged back).
-->
<script lang="ts">
	import Block from "$registry/compose/Block.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { creatorLayout, type CreatorLayoutPane } from "$lib/creator-layout.svelte";
	import { PANE_RANGE, keyStep } from "$lib/layout/prefs";

	let {
		pane,
		controls,
		edge = "start",
		orientation = "vertical",
		class: className
	}: {
		pane: CreatorLayoutPane;
		controls: string;
		edge?: "start" | "end";
		orientation?: "vertical" | "horizontal";
		class?: string;
	} = $props();

	const range = $derived(PANE_RANGE[pane]);
	const value = $derived(creatorLayout.size(pane));
	const label = $derived(t(`splitter.${pane}`));
	const vertical = $derived(orientation === "vertical");
	const sign = $derived(edge === "start" ? 1 : -1);

	let dragging = $state(false);
	let origin = 0;
	let originSize = 0;

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		dragging = true;
		origin = vertical ? event.clientX : event.clientY;
		originSize = creatorLayout.size(pane);
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		creatorLayout.setResizing(true, vertical ? "x" : "y");
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging) return;
		const delta = (vertical ? event.clientX : event.clientY) - origin;
		creatorLayout.setSize(pane, originSize + sign * delta, false);
	}

	function endDrag() {
		if (!dragging) return;
		dragging = false;
		creatorLayout.setResizing(false);
		creatorLayout.save();
	}

	function onKeyDown(event: KeyboardEvent) {
		const step = keyStep(event.shiftKey);
		const grow = vertical ? (sign > 0 ? "ArrowRight" : "ArrowLeft") : sign > 0 ? "ArrowDown" : "ArrowUp";
		const shrink = vertical ? (sign > 0 ? "ArrowLeft" : "ArrowRight") : sign > 0 ? "ArrowUp" : "ArrowDown";
		let next: number | null = null;
		if (event.key === grow) next = value + step;
		else if (event.key === shrink) next = value - step;
		else if (event.key === "Home") next = range.min;
		else if (event.key === "End") next = range.max;
		else if (event.key === "Enter") {
			event.preventDefault();
			creatorLayout.resetSize(pane);
			return;
		}
		if (next === null) return;
		event.preventDefault();
		creatorLayout.setSize(pane, next);
	}
</script>

<Block
	class={cn(
		"relative z-10 shrink-0 touch-none bg-transparent select-none hover:bg-border focus-visible:bg-ring focus-visible:outline-none",
		vertical ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize",
		dragging && "bg-ring",
		className
	)}
	role="separator"
	aria-orientation={orientation}
	aria-label={label}
	aria-controls={controls}
	aria-valuemin={range.min}
	aria-valuemax={range.max}
	aria-valuenow={value}
	tabindex={0}
	title={`${label} (${t("splitter.hint")})`}
	data-slot="pane-splitter"
	data-pane={pane}
	data-dragging={dragging ? "true" : "false"}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={endDrag}
	onpointercancel={endDrag}
	onlostpointercapture={endDrag}
	ondblclick={() => creatorLayout.resetSize(pane)}
	onkeydown={onKeyDown}
></Block>

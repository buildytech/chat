<!--
  Drop layer of the Build preview (ADR 0024 step C). While a Blocks feed card is dragged, this host layer covers the
  preview iframe (drag events never cross into the frame document): it measures the page's top-level sections in the
  frame, draws the insertion line between them (or before the first / after the last), scrolls the frame near its
  top and bottom edges, and on drop runs the same inspector add operation as "+" at that slot. A card that cannot be
  added, or a slot it cannot take (above the header, below the footer), shows the reason and refuses the drop.
-->
<script lang="ts">
	import type { Attachment } from "svelte/attachments";
	import Badge from "$registry/compose/Badge.svelte";
	import Box from "$registry/compose/Box.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { FEED_DRAG_TYPE, feedDrag } from "$lib/feed/drag.svelte";
	import { dropAt, dropRefusal, refuseDrop } from "$lib/feed/drop.svelte";
	import { insertionSlot } from "$lib/feed/sections";
	import { blockSelector } from "$lib/inspector/geometry";
	import { blocksOf, getCurrentPage } from "$lib/page-store";

	let { doc, scale }: { doc: Document; scale: number } = $props();

	let target = $state<{ slot: number; lineY: number; refusal: string | null } | null>(null);
	let scrollStep = 0;
	let scrollTimer: ReturnType<typeof setInterval> | null = null;
	const EDGE = 48;

	const sections = $derived.by(() => {
		const page = getCurrentPage();
		return page ? blocksOf(page) : [];
	});

	/** Top-level section boxes in layer px (the layer shares the frame's top-left corner and scale). */
	function boxes(): Array<{ top: number; height: number }> {
		const out: Array<{ top: number; height: number }> = [];
		for (const node of sections) {
			const el = doc.querySelector(blockSelector(node.id));
			if (!el) continue;
			const r = el.getBoundingClientRect();
			out.push({ top: r.top * scale, height: r.height * scale });
		}
		return out;
	}

	function stopScroll() {
		scrollStep = 0;
		if (scrollTimer) clearInterval(scrollTimer);
		scrollTimer = null;
	}

	function edgeScroll(y: number, height: number) {
		scrollStep = y < EDGE ? -24 : y > height - EDGE ? 24 : 0;
		if (!scrollStep) return stopScroll();
		scrollTimer ??= setInterval(() => doc.defaultView?.scrollBy(0, scrollStep / (scale || 1)), 40);
	}

	function onDragOver(event: DragEvent) {
		if (!feedDrag.active) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const y = event.clientY - rect.top;
		edgeScroll(y, rect.height);
		const { slot, lineY } = insertionSlot(boxes(), y);
		const refusal = sections.length ? dropRefusal(slot) : dropRefusal(0);
		target = { slot, lineY: sections.length ? lineY : 0, refusal };
		// The drop is always taken, so a refused one is said (red line and label now, the reason in the status on release).
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		stopScroll();
		const at = target;
		target = null;
		if (!at) return;
		if (at.refusal) refuseDrop(at.refusal);
		else dropAt(at.slot);
	}

	function onDragLeave(event: DragEvent) {
		const layer = event.currentTarget as HTMLElement;
		if (event.relatedTarget instanceof Node && layer.contains(event.relatedTarget)) return;
		stopScroll();
		target = null;
	}

	// The drag ended anywhere (dropped elsewhere, Escape): clear the line.
	$effect(() => {
		if (!feedDrag.active) {
			stopScroll();
			target = null;
		}
	});

	/** Measured geometry: set on the element, never as a style attribute in markup. */
	function at(y: number): Attachment<HTMLElement> {
		return (el) => {
			el.style.transform = `translateY(${Math.round(y)}px)`;
		};
	}
	const accepts = (event: DragEvent) => event.dataTransfer?.types.includes(FEED_DRAG_TYPE) ?? false;
</script>

{#if feedDrag.active}
	<Box
		class="absolute inset-0 z-20"
		data-slot="drop-overlay"
		role="region"
		aria-label={t("dnd.region")}
		ondragenter={(event: DragEvent) => accepts(event) && event.preventDefault()}
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		{#if target}
			<Box
				class={cn("pointer-events-none absolute inset-x-2 top-0 h-1 -translate-y-0.5 rounded", target.refusal ? "bg-destructive" : "bg-primary")}
				data-slot="drop-line"
				data-slot-index={target.slot}
				data-refused={target.refusal ? "true" : undefined}
				{@attach at(target.lineY)}
			></Box>
			<Box class="pointer-events-none absolute left-2 top-0" {@attach at(Math.max(target.lineY - 28, 4))}>
				<Badge size="sm" variant={target.refusal ? "destructive" : "default"} data-slot="drop-label">
					{target.refusal ?? t("dnd.insertAt").replace("{position}", String(target.slot + 1))}
				</Badge>
			</Box>
		{/if}
	</Box>
{/if}

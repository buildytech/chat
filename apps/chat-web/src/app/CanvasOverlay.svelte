<!--
  Editor chrome of the Build canvas, drawn in the chat document over the preview iframe: the outline of the hovered
  block, the outline and label of the selected block, and the outline of the selected field (ADR 0021, found through the
  block's generated viewMap). Nothing is inserted into the page, so the frame DOM stays the registry output; PreviewPane does not mount this layer in clean mode (Settings) and /preview never has it.
  Rects are measured in the frame (getBoundingClientRect) and remeasured on scroll, resize and every frame render.
-->
<script lang="ts">
	import { untrack } from "svelte";
	import type { Attachment } from "svelte/attachments";
	import Badge from "$registry/compose/Badge.svelte";
	import Box from "$registry/compose/Box.svelte";
	import { canvas } from "$lib/inspector/canvas.svelte";
	import { fieldElement } from "$lib/inspector/field-select";
	import { blockSelector, overlayRect, sameRect, type CanvasRect } from "$lib/inspector/geometry";
	import { blocksOf, getCurrentPage } from "$lib/page-store";

	let {
		doc,
		scale,
		width,
		height,
		selectedId,
		selectedLabel
	}: {
		doc: Document;
		scale: number;
		/** Frame viewport in CSS px of the frame (before scale). */
		width: number;
		height: number;
		selectedId: string | null;
		selectedLabel: string;
	} = $props();

	let selectedRect = $state<CanvasRect | null>(null);
	let hoverRect = $state<CanvasRect | null>(null);
	let fieldRect = $state<CanvasRect | null>(null);
	const hoveredId = $derived(canvas.hovered);
	// The selected field of the selected block, with the block as the page has it now (its values locate the field).
	const field = $derived.by(() => {
		const pick = canvas.field;
		if (!pick || pick.blockId !== selectedId) return null;
		const page = getCurrentPage();
		const block = page ? blocksOf(page).find((node) => node.id === pick.blockId) : undefined;
		return block ? { block, pointer: pick.pointer } : null;
	});
	// The label sits on the outline's top edge, above it when there is room, and stays in view when the block top has
	// scrolled out of the frame. LABEL_HEIGHT is the Badge sm height (h-5).
	const LABEL_HEIGHT = 20;
	const labelAt = $derived.by((): CanvasRect | null => {
		if (!selectedRect) return null;
		const above = selectedRect.y - LABEL_HEIGHT;
		const y = above >= 0 ? above : Math.max(selectedRect.y, 0);
		return { x: selectedRect.x, y, width: 0, height: 0 };
	});

	function blockElement(id: string | null): Element | null {
		return id ? doc.querySelector(blockSelector(id)) : null;
	}

	function measure(id: string | null): CanvasRect | null {
		const el = blockElement(id);
		if (!el) return null;
		const r = el.getBoundingClientRect();
		return overlayRect({ x: r.left, y: r.top, width: r.width, height: r.height }, scale, { width, height });
	}

	function rectOf(el: Element | null): CanvasRect | null {
		if (!el) return null;
		const r = el.getBoundingClientRect();
		return overlayRect({ x: r.left, y: r.top, width: r.width, height: r.height }, scale, { width, height });
	}

	function remeasure() {
		const nextSelected = measure(selectedId);
		const nextHover = hoveredId && hoveredId !== selectedId ? measure(hoveredId) : null;
		const nextField = field ? rectOf(fieldElement(doc, field.block, field.pointer)) : null;
		untrack(() => {
			if (!sameRect(nextSelected, selectedRect)) selectedRect = nextSelected;
			if (!sameRect(nextHover, hoverRect)) hoverRect = nextHover;
			if (!sameRect(nextField, fieldRect)) fieldRect = nextField;
		});
	}

	// Selection, hover, scale or frame size changed.
	$effect(() => {
		remeasure();
	});

	// The frame scrolled, resized or re-rendered a block: remeasure once per animation frame.
	$effect(() => {
		const view = doc.defaultView;
		let pending = 0;
		const schedule = () => {
			if (pending) return;
			pending = requestAnimationFrame(() => {
				pending = 0;
				remeasure();
			});
		};
		const resize = new ResizeObserver(schedule);
		resize.observe(doc.documentElement);
		const mutations = new MutationObserver(schedule);
		mutations.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true });
		doc.addEventListener("scroll", schedule, { passive: true, capture: true });
		view?.addEventListener("resize", schedule);
		window.addEventListener("resize", schedule);
		return () => {
			if (pending) cancelAnimationFrame(pending);
			resize.disconnect();
			mutations.disconnect();
			doc.removeEventListener("scroll", schedule, { capture: true });
			view?.removeEventListener("resize", schedule);
			window.removeEventListener("resize", schedule);
		};
	});

	// A field focused in the inspector is brought into view in the frame (once per request).
	$effect(() => {
		const pick = canvas.field;
		if (!pick || pick.from !== "inspector") return;
		untrack(() => {
			if (field) fieldElement(doc, field.block, field.pointer)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
		});
	});

	// A block picked in the tree is brought into view in the frame (once per request).
	$effect(() => {
		const request = canvas.reveal;
		if (!request) return;
		untrack(() => blockElement(request.id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
	});

	/** Measured geometry, not design spacing: set on the element, never as a style attribute in markup. */
	function place(rect: CanvasRect, sized = true): Attachment<HTMLElement> {
		return (el) => {
			el.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
			if (!sized) return;
			el.style.width = `${rect.width}px`;
			el.style.height = `${rect.height}px`;
		};
	}
</script>

<Box class="pointer-events-none absolute inset-0 z-10 overflow-hidden" data-slot="canvas-overlay" aria-hidden="true">
	{#if hoverRect}
		<Box class="absolute left-0 top-0 rounded inset-ring inset-ring-primary" data-slot="canvas-hover" {@attach place(hoverRect)}></Box>
	{/if}
	{#if selectedRect}
		<Box class="absolute left-0 top-0 rounded inset-ring-2 inset-ring-primary" data-slot="canvas-selected" {@attach place(selectedRect)}></Box>
	{/if}
	{#if fieldRect}
		<Box class="absolute left-0 top-0 rounded outline-2 outline-offset-2 outline-dashed outline-primary" data-slot="canvas-field" {@attach place(fieldRect)}></Box>
	{/if}
	{#if labelAt && selectedLabel}
		<Box class="absolute left-0 top-0" data-slot="canvas-label" {@attach place(labelAt, false)}>
			<Badge size="sm">{selectedLabel}</Badge>
		</Box>
	{/if}
</Box>
